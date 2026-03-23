import { addTotalSize } from "@/core/addTotalSize";
import { activateInitialBootstrap, canUseInitialBootstrapProjection } from "@/core/initialBootstrap";
import { PlatformAdjustBreaksScroll } from "@/platform/Platform";
import type { StateContext } from "@/state/state";
import { debugInitialScroll } from "@/utils/debugInitialScroll";
import { checkThresholds } from "@/utils/checkThresholds";
import { setInitialRenderState } from "@/utils/setInitialRenderState";

export function finishScrollTo(ctx: StateContext, params?: { bootstrapDesiredOffset?: number }) {
    const state = ctx.state;
    if (state?.scrollingTo) {
        const resolvePendingScroll = state.pendingScrollResolve;
        state.pendingScrollResolve = undefined;

        // Save scrollingTo before clearing it so we can pass it to commitPendingAdjust
        const scrollingTo = state.scrollingTo;
        const shouldEnterBootstrap =
            !!scrollingTo.isInitialScroll &&
            !state.initialScrollUsesOffset &&
            canUseInitialBootstrapProjection(state);

        if (scrollingTo.isInitialScroll) {
            debugInitialScroll("finishScrollTo", {
                bootstrapDesiredOffset: params?.bootstrapDesiredOffset,
                offset: scrollingTo.offset,
                shouldEnterBootstrap,
                targetOffset: scrollingTo.targetOffset,
            });
        }

        state.scrollHistory.length = 0;
        state.didDispatchNativeScroll = undefined;
        state.didRetrySilentInitialScroll = undefined;
        state.initialScroll = undefined;
        state.initialScrollUsesOffset = false;
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
            activateInitialBootstrap(
                ctx,
                params?.bootstrapDesiredOffset ?? scrollingTo.targetOffset ?? scrollingTo.offset,
            );
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
        } else {
            setInitialRenderState(ctx, { didInitialScroll: true });
            checkThresholds(ctx);
        }

        resolvePendingScroll?.();
    }
}
