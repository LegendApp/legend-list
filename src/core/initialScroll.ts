import { calculateOffsetForIndex } from "@/core/calculateOffsetForIndex";
import { calculateOffsetWithOffsetPosition } from "@/core/calculateOffsetWithOffsetPosition";
import { clampScrollOffset } from "@/core/clampScrollOffset";
import { setInitialScrollSession } from "@/core/initialScrollSession";
import { scrollTo } from "@/core/scrollTo";
import { clampScrollIndex } from "@/core/scrollToIndex";
import type { StateContext } from "@/state/state";
import type { ScrollIndexWithOffset, ScrollIndexWithOffsetAndContentOffset } from "@/types.base";
import { getItemSizeAtIndex } from "@/utils/getItemSize";

type InternalInitialScrollTarget = NonNullable<StateContext["state"]["initialScroll"]>;

export function dispatchInitialScroll(
    ctx: StateContext,
    params: {
        forceScroll: boolean;
        resolvedOffset: number;
        target: InternalInitialScrollTarget;
        waitForCompletionFrame?: boolean;
    },
) {
    const { forceScroll, resolvedOffset, target, waitForCompletionFrame } = params;
    const requestedIndex = target.index;
    const index =
        requestedIndex !== undefined ? clampScrollIndex(requestedIndex, ctx.state.props.data.length) : undefined;
    const itemSize = getItemSizeAtIndex(ctx, index);

    scrollTo(ctx, {
        animated: false,
        forceScroll,
        index: index !== undefined && index >= 0 ? index : undefined,
        isInitialScroll: true,
        itemSize,
        offset: resolvedOffset,
        precomputedWithViewOffset: true,
        viewOffset: target.viewOffset,
        viewPosition: target.viewPosition,
        waitForInitialScrollCompletionFrame: waitForCompletionFrame,
    });
}

export function setInitialScrollTarget(
    state: StateContext["state"],
    target: InternalInitialScrollTarget,
    options?: {
        ctx?: StateContext;
        resetDidFinish?: boolean;
    },
) {
    state.clearPreservedInitialScrollOnNextFinish = undefined;
    if (state.timeoutPreservedInitialScrollClear !== undefined) {
        clearTimeout(state.timeoutPreservedInitialScrollClear);
        state.timeoutPreservedInitialScrollClear = undefined;
    }
    state.initialScroll = target;

    if (options?.resetDidFinish && state.didFinishInitialScroll) {
        state.didFinishInitialScroll = false;
    }

    setInitialScrollSession(state, {
        kind: state.initialScrollSession?.kind === "offset" ? "offset" : "bootstrap",
    });
}

export function resolveInitialScrollOffset(ctx: StateContext, initialScroll: ScrollIndexWithOffset) {
    const state = ctx.state;
    if (state.initialScrollSession?.kind === "offset") {
        return (initialScroll as ScrollIndexWithOffsetAndContentOffset).contentOffset ?? 0;
    }

    const baseOffset = initialScroll.index !== undefined ? calculateOffsetForIndex(ctx, initialScroll.index) : 0;
    const resolvedOffset = calculateOffsetWithOffsetPosition(ctx, baseOffset, initialScroll);
    return clampScrollOffset(ctx, resolvedOffset, initialScroll);
}

function getAdvanceableInitialScrollState(
    state: StateContext["state"],
    options?: {
        requiresMeasuredLayout?: boolean;
    },
) {
    const { didFinishInitialScroll, queuedInitialLayout, scrollingTo } = state;
    const initialScroll = state.initialScroll;
    const isInitialScrollInProgress = !!scrollingTo?.isInitialScroll;
    const shouldWaitForInitialLayout =
        !!options?.requiresMeasuredLayout && !queuedInitialLayout && !isInitialScrollInProgress;

    if (
        !initialScroll ||
        shouldWaitForInitialLayout ||
        didFinishInitialScroll ||
        (scrollingTo && !isInitialScrollInProgress)
    ) {
        return undefined;
    }

    return {
        initialScroll,
        isInitialScrollInProgress,
        queuedInitialLayout,
        scrollingTo,
    };
}

function advanceMeasuredInitialScroll(
    ctx: StateContext,
    options?: {
        forceScroll?: boolean;
    },
) {
    const state = ctx.state;
    const advanceableState = getAdvanceableInitialScrollState(state, {
        requiresMeasuredLayout: true,
    });
    if (!advanceableState) {
        return false;
    }

    const { initialScroll, isInitialScrollInProgress, queuedInitialLayout } = advanceableState;
    const scrollingTo = isInitialScrollInProgress ? advanceableState.scrollingTo! : undefined;
    const resolvedOffset = resolveInitialScrollOffset(ctx, initialScroll);
    const activeInitialTargetOffset = scrollingTo ? (scrollingTo.targetOffset ?? scrollingTo.offset) : undefined;
    const didOffsetChange =
        initialScroll.contentOffset === undefined || Math.abs(initialScroll.contentOffset - resolvedOffset) > 1;
    const didActiveInitialTargetChange =
        activeInitialTargetOffset !== undefined && Math.abs(activeInitialTargetOffset - resolvedOffset) > 1;
    const isAlreadyAtDesiredInitialTarget =
        activeInitialTargetOffset !== undefined &&
        Math.abs(state.scroll - resolvedOffset) <= 1 &&
        Math.abs(state.scrollPending - resolvedOffset) <= 1;

    if (!options?.forceScroll && !didOffsetChange && isInitialScrollInProgress && !didActiveInitialTargetChange) {
        return false;
    }

    if (options?.forceScroll && isAlreadyAtDesiredInitialTarget) {
        return false;
    }

    if (didOffsetChange && state.initialScrollSession?.kind !== "offset") {
        setInitialScrollTarget(state, { ...initialScroll, contentOffset: resolvedOffset });
    }

    const forceScroll =
        options?.forceScroll ?? (!!queuedInitialLayout || (isInitialScrollInProgress && didOffsetChange));

    dispatchInitialScroll(ctx, {
        forceScroll,
        resolvedOffset,
        target: initialScroll,
    });

    return true;
}

function advanceOffsetInitialScroll(
    ctx: StateContext,
    options?: {
        forceScroll?: boolean;
    },
) {
    const state = ctx.state;
    const advanceableState = getAdvanceableInitialScrollState(state);
    if (!advanceableState) {
        return false;
    }

    const { initialScroll, queuedInitialLayout } = advanceableState;
    const resolvedOffset = initialScroll.contentOffset ?? 0;
    const isAlreadyAtDesiredInitialTarget =
        Math.abs(state.scroll - resolvedOffset) <= 1 && Math.abs(state.scrollPending - resolvedOffset) <= 1;

    if (options?.forceScroll && isAlreadyAtDesiredInitialTarget) {
        return false;
    }

    const hasMeasuredScrollLayout = !!state.lastLayout && state.scrollLength > 0;
    const forceScroll = options?.forceScroll ?? (hasMeasuredScrollLayout || !!queuedInitialLayout);

    dispatchInitialScroll(ctx, {
        forceScroll,
        resolvedOffset,
        target: initialScroll,
    });

    return true;
}

export function advanceCurrentInitialScrollSession(
    ctx: StateContext,
    options?: {
        forceScroll?: boolean;
    },
) {
    return ctx.state.initialScrollSession?.kind === "offset"
        ? advanceOffsetInitialScroll(ctx, {
              forceScroll: options?.forceScroll,
          })
        : advanceMeasuredInitialScroll(ctx, {
              forceScroll: options?.forceScroll,
          });
}
