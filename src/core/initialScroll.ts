import { calculateOffsetForIndex } from "@/core/calculateOffsetForIndex";
import { calculateOffsetWithOffsetPosition } from "@/core/calculateOffsetWithOffsetPosition";
import { clampScrollOffset } from "@/core/clampScrollOffset";
import type { StateContext } from "@/state/state";
import type { ScrollIndexWithOffset, ScrollIndexWithOffsetAndContentOffset } from "@/types.base";
import { checkThresholds } from "@/utils/checkThresholds";
import { setInitialRenderState } from "@/utils/setInitialRenderState";

function clearInitialScrollState(ctx: StateContext) {
    const state = ctx.state;
    state.initialScroll = undefined;
    state.initialScrollUsesOffset = false;
    state.initialNativeScrollWatchdog = undefined;
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
        syncAnchor?: boolean;
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
        clearInitialScrollState(ctx);

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

export function finishInitialScrollWithoutScroll(
    ctx: StateContext,
    options?: {
        recalculateItems?: boolean;
        resolvedOffset?: number;
    },
) {
    finishInitialScroll(ctx, options);
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
