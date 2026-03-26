import { addTotalSize } from "@/core/addTotalSize";
import { activateInitialBootstrap, canUseInitialBootstrapProjection } from "@/core/initialBootstrap";
import { getScrollTargetOffset } from "@/core/scrollTarget";
import { Platform, PlatformAdjustBreaksScroll } from "@/platform/Platform";
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
        const shouldEnterBootstrap =
            !!scrollingTo.isInitialScroll && !state.initialScrollUsesOffset && canUseInitialBootstrapProjection(state);
        const shouldDeferIndexedWebInitialScrollFinish =
            Platform.OS === "web" &&
            !!scrollingTo.isInitialScroll &&
            !!state.initialScroll &&
            !state.initialScrollUsesOffset &&
            !shouldEnterBootstrap;

        state.scrollHistory.length = 0;
        state.didDispatchNativeScroll = undefined;
        state.didRetrySilentInitialScroll = undefined;
        if (!shouldDeferIndexedWebInitialScrollFinish) {
            state.initialScroll = undefined;
            state.initialScrollUsesOffset = false;
        }
        state.pendingCorrectiveInitialClamp = undefined;
        state.scrollingTo = undefined;

        if (state.pendingTotalSize !== undefined) {
            addTotalSize(ctx, null, state.pendingTotalSize);
        }

        if (state.props?.data) {
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
        }

        if (PlatformAdjustBreaksScroll) {
            state.scrollAdjustHandler.commitPendingAdjust(scrollingTo);
        }

        if (shouldEnterBootstrap) {
            activateInitialBootstrap(ctx, getScrollTargetOffset(scrollingTo));
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
        } else if (!shouldDeferIndexedWebInitialScrollFinish) {
            setInitialRenderState(ctx, { didInitialScroll: true });
            checkThresholds(ctx);
        } else {
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
        }

        resolvePendingScroll?.();
    }
}
