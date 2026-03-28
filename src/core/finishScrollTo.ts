import { PlatformAdjustBreaksScroll } from "@/platform/Platform";
import { type StateContext, set$ } from "@/state/state";
import { checkThresholds } from "@/utils/checkThresholds";
import { setInitialRenderState } from "@/utils/setInitialRenderState";

export function finishScrollTo(ctx: StateContext) {
    const state = ctx.state;
    if (state?.scrollingTo) {
        const resolvePendingScroll = state.pendingScrollResolve;
        state.pendingScrollResolve = undefined;

        // Save scrollingTo before clearing it so we can pass it to commitPendingAdjust
        const scrollingTo = state.scrollingTo;
        const shouldKeepDeferredInitialScrollActive =
            !!scrollingTo.isInitialScroll && state.deferredPositions?.desiredScrollOffset !== undefined;
        console.log(`${Date.now()} [debug initial-blank] finishScrollTo`, {
            desiredScrollOffset: state.deferredPositions?.desiredScrollOffset,
            didContainersLayout: state.didContainersLayout,
            isInitialScroll: scrollingTo.isInitialScroll,
            offset: scrollingTo.offset,
            shouldKeepDeferredInitialScrollActive,
            targetOffset: scrollingTo.targetOffset,
        });

        state.scrollHistory.length = 0;
        state.initialNativeScrollWatchdog = undefined;
        state.scrollingTo = undefined;

        if (state.pendingTotalSize !== undefined) {
            state.pendingTotalSize = undefined;
            set$(ctx, "totalSize", state.totalSizeExact);
        }

        if (shouldKeepDeferredInitialScrollActive) {
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
            resolvePendingScroll?.();
            return;
        }

        state.initialScroll = undefined;
        state.initialScrollUsesOffset = false;
        state.initialAnchor = undefined;

        if (state.props?.data) {
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
        }

        if (PlatformAdjustBreaksScroll) {
            state.scrollAdjustHandler.commitPendingAdjust(scrollingTo);
        }

        setInitialRenderState(ctx, { didInitialScroll: true });

        checkThresholds(ctx);

        resolvePendingScroll?.();
    }
}
