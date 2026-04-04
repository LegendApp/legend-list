import { calculateOffsetForIndex } from "@/core/calculateOffsetForIndex";
import { calculateOffsetWithOffsetPosition } from "@/core/calculateOffsetWithOffsetPosition";
import { clampScrollOffset } from "@/core/clampScrollOffset";
import {
    getInitialScrollSessionKind,
    isOffsetInitialScrollSession,
    setInitialScrollSession,
    setInitialScrollSessionWatchdog,
} from "@/core/initialScrollSession";
import { Platform } from "@/platform/Platform";
import type { StateContext } from "@/state/state";
import type { ScrollIndexWithOffset, ScrollIndexWithOffsetAndContentOffset } from "@/types.base";
import { checkThresholds } from "@/utils/checkThresholds";
import { performInitialScroll } from "@/utils/performInitialScroll";
import { setInitialRenderState } from "@/utils/setInitialRenderState";

type InternalInitialScrollTarget = NonNullable<StateContext["state"]["initialScroll"]>;

function syncInitialScrollOffset(state: StateContext["state"], offset: number) {
    state.scroll = offset;
    state.scrollPending = offset;
    state.scrollPrev = offset;
}

export function setInitialScrollTarget(
    state: StateContext["state"],
    target: InternalInitialScrollTarget,
    options?: {
        resetDidFinish?: boolean;
    },
) {
    state.initialScroll = target;

    if (options?.resetDidFinish && state.didFinishInitialScroll) {
        state.didFinishInitialScroll = false;
    }

    setInitialScrollSession(state, {
        kind: getInitialScrollSessionKind(state) === "offset" ? "offset" : "bootstrap",
    });
}

export function finishInitialScroll(
    ctx: StateContext,
    options?: {
        recalculateItems?: boolean;
        resolvedOffset?: number;
        preserveTarget?: boolean;
        syncObservedOffset?: boolean;
        waitForCompletionFrame?: boolean;
        onFinished?: () => void;
    },
) {
    const state = ctx.state;

    if (options?.resolvedOffset !== undefined) {
        syncInitialScrollOffset(state, options.resolvedOffset);
    } else if (options?.syncObservedOffset && getInitialScrollSessionKind(state) === "offset") {
        const observedOffset = state.refScroller.current?.getCurrentScrollOffset?.();
        if (typeof observedOffset === "number" && Number.isFinite(observedOffset)) {
            syncInitialScrollOffset(state, observedOffset);
        }
    }

    const complete = () => {
        setInitialScrollSessionWatchdog(state, undefined);
        if (!options?.preserveTarget) {
            state.initialScroll = undefined;
        }
        setInitialScrollSession(state);

        if (options?.recalculateItems && state.props?.data) {
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
        }

        setInitialRenderState(ctx, { didInitialScroll: true });

        if (options?.recalculateItems) {
            checkThresholds(ctx);
        }

        options?.onFinished?.();
    };

    if (options?.waitForCompletionFrame) {
        requestAnimationFrame(complete);
        return;
    }

    complete();
}

export function getInitialContentOffsetForMount(ctx: StateContext, options?: { useBootstrapInitialScroll?: boolean }) {
    const state = ctx.state;
    const initialScroll = state.initialScroll;
    if (!initialScroll) {
        return undefined;
    }

    const resolvedOffset = initialScroll.contentOffset ?? resolveInitialScrollOffset(ctx, initialScroll);
    return options?.useBootstrapInitialScroll &&
        getInitialScrollSessionKind(state) === "bootstrap" &&
        Platform.OS === "web"
        ? undefined
        : resolvedOffset;
}

export function resolveInitialScrollOffset(ctx: StateContext, initialScroll: ScrollIndexWithOffset) {
    const state = ctx.state;
    if (isOffsetInitialScrollSession(state)) {
        return (initialScroll as ScrollIndexWithOffsetAndContentOffset).contentOffset ?? 0;
    }

    const baseOffset = initialScroll.index !== undefined ? calculateOffsetForIndex(ctx, initialScroll.index) : 0;
    const resolvedOffset = calculateOffsetWithOffsetPosition(ctx, baseOffset, initialScroll);
    return clampScrollOffset(ctx, resolvedOffset, initialScroll);
}

function getAdvanceableInitialScrollState(
    state: StateContext["state"],
    options?: {
        waitForInitialLayout?: boolean;
        requiresMeasuredLayout?: boolean;
    },
) {
    const { didFinishInitialScroll, queuedInitialLayout, scrollingTo } = state;
    const initialScroll = state.initialScroll;
    const isInitialScrollInProgress = !!scrollingTo?.isInitialScroll;
    const shouldWaitForInitialLayout =
        !!options?.waitForInitialLayout &&
        !!options?.requiresMeasuredLayout &&
        !queuedInitialLayout &&
        !isInitialScrollInProgress;

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
        waitForInitialLayout?: boolean;
    },
) {
    const state = ctx.state;
    const advanceableState = getAdvanceableInitialScrollState(state, {
        requiresMeasuredLayout: true,
        waitForInitialLayout: options?.waitForInitialLayout,
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
        Math.abs(state.scroll - activeInitialTargetOffset) <= 1 &&
        Math.abs(state.scrollPending - activeInitialTargetOffset) <= 1;

    if (!options?.forceScroll && !didOffsetChange && isInitialScrollInProgress && !didActiveInitialTargetChange) {
        return false;
    }

    if (options?.forceScroll && isAlreadyAtDesiredInitialTarget) {
        return false;
    }

    if (didOffsetChange && !isOffsetInitialScrollSession(state)) {
        setInitialScrollTarget(state, { ...initialScroll, contentOffset: resolvedOffset });
    }

    const forceScroll =
        options?.forceScroll ?? (!!queuedInitialLayout || (isInitialScrollInProgress && didOffsetChange));

    performInitialScroll(ctx, {
        forceScroll,
        initialScrollUsesOffset: false,
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

    performInitialScroll(ctx, {
        forceScroll,
        initialScrollUsesOffset: true,
        resolvedOffset,
        target: initialScroll,
    });

    return true;
}

export function advanceCurrentInitialScrollSession(
    ctx: StateContext,
    options?: {
        forceScroll?: boolean;
        waitForInitialLayout?: boolean;
    },
) {
    return getInitialScrollSessionKind(ctx.state) === "offset"
        ? advanceOffsetInitialScroll(ctx, {
              forceScroll: options?.forceScroll,
          })
        : advanceMeasuredInitialScroll(ctx, {
              forceScroll: options?.forceScroll,
              waitForInitialLayout: options?.waitForInitialLayout,
          });
}
