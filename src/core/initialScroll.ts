import { calculateOffsetForIndex } from "@/core/calculateOffsetForIndex";
import { calculateOffsetWithOffsetPosition } from "@/core/calculateOffsetWithOffsetPosition";
import { clampScrollOffset } from "@/core/clampScrollOffset";
import { Platform } from "@/platform/Platform";
import type { StateContext } from "@/state/state";
import type { ScrollIndexWithOffset, ScrollIndexWithOffsetAndContentOffset } from "@/types.base";
import { checkThresholds } from "@/utils/checkThresholds";
import { performInitialScroll } from "@/utils/performInitialScroll";
import { setInitialRenderState } from "@/utils/setInitialRenderState";

function clearInitialScrollState(ctx: StateContext, options?: { preserveTarget?: boolean }) {
    const state = ctx.state;
    state.initialNativeScrollWatchdog = undefined;
    if (!options?.preserveTarget) {
        state.initialScroll = undefined;
        state.initialScrollUsesOffset = false;
        state.pendingInitialScrollAtEndFooterLayout = undefined;
    }
}

function syncInitialScrollOffset(state: StateContext["state"], offset: number) {
    state.scroll = offset;
    state.scrollPending = offset;
    state.scrollPrev = offset;
}

function syncObservedInitialOffsetScroll(state: StateContext["state"]) {
    if (!state.initialScrollUsesOffset) {
        return;
    }

    const observedOffset = state.refScroller.current?.getCurrentScrollOffset?.();
    if (typeof observedOffset === "number" && Number.isFinite(observedOffset)) {
        syncInitialScrollOffset(state, observedOffset);
    }
}

export function setInitialScrollTarget(
    state: StateContext["state"],
    target: ScrollIndexWithOffsetAndContentOffset,
    options?: {
        resetDidFinish?: boolean;
        usesOffset?: boolean;
    },
) {
    const usesOffset = !!options?.usesOffset;

    state.initialScrollUsesOffset = usesOffset;
    state.initialScroll = target;

    if (options?.resetDidFinish && state.didFinishInitialScroll) {
        state.didFinishInitialScroll = false;
    }
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
    } else if (options?.syncObservedOffset) {
        syncObservedInitialOffsetScroll(state);
    }

    const complete = () => {
        clearInitialScrollState(ctx, { preserveTarget: options?.preserveTarget });

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
    return options?.useBootstrapInitialScroll && !state.initialScrollUsesOffset && Platform.OS === "web"
        ? undefined
        : resolvedOffset;
}

export function resolveInitialScrollOffset(ctx: StateContext, initialScroll: ScrollIndexWithOffset) {
    const state = ctx.state;
    if (state.initialScrollUsesOffset) {
        return (initialScroll as ScrollIndexWithOffsetAndContentOffset).contentOffset ?? 0;
    }

    const baseOffset = initialScroll.index !== undefined ? calculateOffsetForIndex(ctx, initialScroll.index) : 0;
    const resolvedOffset = calculateOffsetWithOffsetPosition(ctx, baseOffset, initialScroll);
    return clampScrollOffset(ctx, resolvedOffset, initialScroll);
}

export function advanceInitialScroll(
    ctx: StateContext,
    options?: {
        forceScroll?: boolean;
        waitForInitialLayout?: boolean;
    },
) {
    const state = ctx.state;
    const { didFinishInitialScroll, queuedInitialLayout, scrollingTo } = state;
    const initialScroll = state.initialScroll;
    const isInitialScrollInProgress = !!scrollingTo?.isInitialScroll;
    const needsContainerLayoutForInitialScroll = !state.initialScrollUsesOffset;
    const shouldWaitForInitialLayout =
        !!options?.waitForInitialLayout &&
        needsContainerLayoutForInitialScroll &&
        !queuedInitialLayout &&
        !isInitialScrollInProgress;

    if (
        !initialScroll ||
        shouldWaitForInitialLayout ||
        didFinishInitialScroll ||
        (scrollingTo && !isInitialScrollInProgress)
    ) {
        return false;
    }

    const resolvedOffset = resolveInitialScrollOffset(ctx, initialScroll);
    const activeInitialTargetOffset = isInitialScrollInProgress
        ? (scrollingTo.targetOffset ?? scrollingTo.offset)
        : undefined;
    const didOffsetChange =
        initialScroll.contentOffset === undefined || Math.abs(initialScroll.contentOffset - resolvedOffset) > 1;
    const didActiveInitialTargetChange =
        activeInitialTargetOffset !== undefined && Math.abs(activeInitialTargetOffset - resolvedOffset) > 1;
    const desiredInitialTargetOffset = state.initialScrollUsesOffset
        ? initialScroll.contentOffset
        : activeInitialTargetOffset;
    const isAlreadyAtDesiredInitialTarget =
        desiredInitialTargetOffset !== undefined &&
        Math.abs(state.scroll - desiredInitialTargetOffset) <= 1 &&
        Math.abs(state.scrollPending - desiredInitialTargetOffset) <= 1;

    if (!options?.forceScroll && !didOffsetChange && isInitialScrollInProgress && !didActiveInitialTargetChange) {
        return false;
    }

    if (options?.forceScroll && isAlreadyAtDesiredInitialTarget) {
        return false;
    }

    if (didOffsetChange && !state.initialScrollUsesOffset) {
        setInitialScrollTarget(state, { ...initialScroll, contentOffset: resolvedOffset });
    }

    const hasMeasuredScrollLayout = !!state.lastLayout && state.scrollLength > 0;
    const forceScroll =
        options?.forceScroll ??
        ((state.initialScrollUsesOffset && hasMeasuredScrollLayout) ||
            !!queuedInitialLayout ||
            (isInitialScrollInProgress && didOffsetChange));

    performInitialScroll(ctx, {
        forceScroll,
        initialScrollUsesOffset: state.initialScrollUsesOffset,
        resolvedOffset,
        target: initialScroll,
    });

    return true;
}
