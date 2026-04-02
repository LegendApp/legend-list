import { addTotalSize } from "@/core/addTotalSize";
import { finishBootstrapInitialScroll } from "@/core/bootstrapInitialScroll";
import { PlatformAdjustBreaksScroll } from "@/platform/Platform";
import type { StateContext } from "@/state/state";
import { checkThresholds } from "@/utils/checkThresholds";
import { setInitialRenderState } from "@/utils/setInitialRenderState";

function syncObservedInitialOffsetScroll(ctx: StateContext) {
    const state = ctx.state;
    if (!state.initialScrollUsesOffset) {
        return;
    }

    const readOffset = state.refScroller.current?.getCurrentScrollOffset;
    if (typeof readOffset !== "function") {
        return;
    }

    const observedOffset = readOffset();
    if (!Number.isFinite(observedOffset)) {
        return;
    }

    state.scroll = observedOffset;
    state.scrollPending = observedOffset;
    state.scrollPrev = observedOffset;
}

export function finishScrollTo(ctx: StateContext) {
    const state = ctx.state;
    if (state?.scrollingTo) {
        const resolvePendingScroll = state.pendingScrollResolve;
        state.pendingScrollResolve = undefined;

        // Save scrollingTo before clearing it so we can pass it to commitPendingAdjust
        const scrollingTo = state.scrollingTo;
        const shouldFinishBootstrapReveal = !!state.bootstrapInitialScroll?.pendingFinalCorrection;

        state.scrollHistory.length = 0;
        state.scrollingTo = undefined;

        if (state.pendingTotalSize !== undefined) {
            addTotalSize(ctx, null, state.pendingTotalSize);
        }

        if (PlatformAdjustBreaksScroll) {
            state.scrollAdjustHandler.commitPendingAdjust(scrollingTo);
        }

        if (shouldFinishBootstrapReveal) {
            finishBootstrapInitialScroll(ctx, resolvePendingScroll);
            return;
        }

        syncObservedInitialOffsetScroll(ctx);
        state.initialScroll = undefined;
        state.initialScrollUsesOffset = false;
        state.initialAnchor = undefined;
        state.initialNativeScrollWatchdog = undefined;

        if (state.props?.data) {
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
        }

        setInitialRenderState(ctx, { didInitialScroll: true });

        checkThresholds(ctx);

        resolvePendingScroll?.();
    }
}
