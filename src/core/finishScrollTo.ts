import { addTotalSize } from "@/core/addTotalSize";
import { PlatformAdjustBreaksScroll } from "@/platform/Platform";
import type { StateContext } from "@/state/state";
import { checkThresholds } from "@/utils/checkThresholds";
import { setInitialRenderState } from "@/utils/setInitialRenderState";

function finishBootstrapInitialScroll(ctx: StateContext, resolvePendingScroll?: () => void) {
    const state = ctx.state;
    const waitForRevealFrame = !!state.bootstrapInitialScroll?.waitForRevealFrame;

    const finishReveal = () => {
        state.bootstrapInitialScroll = undefined;
        state.bootstrapInitialScrollEvaluate = undefined;
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
    };

    if (waitForRevealFrame) {
        requestAnimationFrame(finishReveal);
    } else {
        finishReveal();
    }
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
