import { calculateOffsetForIndex } from "@/core/calculateOffsetForIndex";
import { calculateOffsetWithOffsetPosition } from "@/core/calculateOffsetWithOffsetPosition";
import { clampScrollOffset } from "@/core/clampScrollOffset";
import { isEndOfContentTarget } from "@/core/endOfContentTarget";
import { finishInitialScroll } from "@/core/finishInitialScroll";
import { setInitialScrollSession } from "@/core/initialScrollSession";
import { getObservedScrollOffset } from "@/core/observedScroll";
import { scrollTo } from "@/core/scrollTo";
import { Platform } from "@/platform/Platform";
import type { StateContext } from "@/state/state";
import type { ScrollIndexWithOffset, ScrollIndexWithOffsetAndContentOffset } from "@/types.base";
import { clampScrollIndex } from "@/utils/clampScrollIndex";
import { getItemSizeAtIndex } from "@/utils/getItemSize";
import { resetInitialRenderState } from "@/utils/setInitialRenderState";

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
        clampToContentContainerMinSize:
            ctx.state.initialScrollSession?.kind === "offset" ||
            isEndOfContentTarget(target, ctx.state.props.data.length),
        forceScroll,
        index: index !== undefined && index >= 0 ? index : undefined,
        isInitialScroll: true,
        itemSize,
        offset: resolvedOffset,
        precomputedWithViewOffset: true,
        viewOffset: target.viewOffset,
        viewPosition: target.viewPosition,
        viewPositionFallback: target.viewPositionFallback,
        waitForInitialScrollCompletionFrame: waitForCompletionFrame,
    });
}

export function setInitialScrollTarget(
    ctx: StateContext,
    target: InternalInitialScrollTarget,
    options?: {
        resetDidFinish?: boolean;
    },
) {
    const { state } = ctx;
    state.clearPreservedInitialScrollOnNextFinish = undefined;
    state.scheduledWork.cancel("preservedInitialScroll");
    state.initialScroll = target;

    if (options?.resetDidFinish) {
        resetInitialRenderState(ctx, { resetInitialScroll: true });
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
    const target = {
        ...initialScroll,
        clampToContentContainerMinSize: isEndOfContentTarget(initialScroll, state.props.data.length),
    };
    const resolvedOffset = calculateOffsetWithOffsetPosition(ctx, baseOffset, target);
    return clampScrollOffset(ctx, resolvedOffset, target);
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
    // An instant web request can be clamped before a footer's new extent commits.
    // Its optimistic cache is not evidence that the browser applied that offset.
    const observedOffset = options?.forceScroll && Platform.OS === "web" ? getObservedScrollOffset(ctx) : undefined;
    const isAlreadyAtDesiredInitialTarget =
        activeInitialTargetOffset !== undefined &&
        Math.abs(state.scroll - resolvedOffset) <= 1 &&
        Math.abs(state.scrollPending - resolvedOffset) <= 1 &&
        (observedOffset === undefined || Math.abs(observedOffset - resolvedOffset) <= 1);

    if (!options?.forceScroll && !didOffsetChange && isInitialScrollInProgress && !didActiveInitialTargetChange) {
        return false;
    }

    if (options?.forceScroll && isAlreadyAtDesiredInitialTarget) {
        return false;
    }

    if (didOffsetChange && state.initialScrollSession?.kind !== "offset") {
        setInitialScrollTarget(ctx, { ...initialScroll, contentOffset: resolvedOffset });
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

    if (
        options?.forceScroll &&
        isAlreadyAtDesiredInitialTarget &&
        Math.abs(getObservedScrollOffset(ctx) - resolvedOffset) <= 1
    ) {
        if (!state.scrollingTo) {
            // No native event or active scroll will complete an already aligned session.
            finishInitialScroll(ctx, {
                preserveTarget: state.props.data.length === 0,
                recalculateItems: true,
                syncObservedOffset: true,
            });
        }
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
        ? advanceOffsetInitialScroll(ctx, options)
        : advanceMeasuredInitialScroll(ctx, options);
}
