import { addTotalSize } from "@/core/addTotalSize";
import { PlatformAdjustBreaksScroll } from "@/platform/Platform";
import type { StateContext } from "@/state/state";
import { checkThresholds } from "@/utils/checkThresholds";
import { setInitialRenderState } from "@/utils/setInitialRenderState";

export function finishScrollTo(ctx: StateContext) {
    const state = ctx.state;
    if (state?.scrollingTo) {
        const resolvePendingScroll = state.pendingScrollResolve;
        state.pendingScrollResolve = undefined;

        // Save scrollingTo before clearing it so we can pass it to commitPendingAdjust
        const scrollingTo = state.scrollingTo;
        const shouldDelayVisualAdjustUntilStable = !!scrollingTo.isInitialScroll;

        state.scrollHistory.length = 0;
        state.initialScroll = undefined;
        state.initialScrollUsesOffset = false;
        state.initialAnchor = undefined;
        state.initialNativeScrollWatchdog = undefined;
        state.postInitialSettleTarget = shouldDelayVisualAdjustUntilStable ? { ...scrollingTo } : undefined;
        state.scrollingTo = undefined;

        if (state.pendingTotalSize !== undefined) {
            addTotalSize(ctx, null, state.pendingTotalSize);
        }

        if (state.props?.data) {
            state.triggerCalculateItemsInView?.({
                doMVCP: shouldDelayVisualAdjustUntilStable,
                forceFullItemPositions: true,
            });
        }

        if (PlatformAdjustBreaksScroll) {
            state.scrollAdjustHandler.commitPendingAdjust(scrollingTo);
        }

        setInitialRenderState(ctx, { didInitialScroll: true });

        checkThresholds(ctx);

        resolvePendingScroll?.();
    }
}
