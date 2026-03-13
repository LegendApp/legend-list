import { addTotalSize } from "@/core/addTotalSize";
import { Platform, PlatformAdjustBreaksScroll } from "@/platform/Platform";
import type { StateContext } from "@/state/state";
import { checkThresholds } from "@/utils/checkThresholds";
import { logScrollControllerDebug } from "@/utils/debugScrollControllers";
import { setInitialRenderState } from "@/utils/setInitialRenderState";

const INITIAL_SCROLL_MVCP_ANCHOR_TTL_MS = 2000;

export function finishScrollTo(ctx: StateContext) {
    const state = ctx.state;
    if (state?.scrollingTo) {
        const resolvePendingScroll = state.pendingScrollResolve;
        state.pendingScrollResolve = undefined;

        // Save scrollingTo before clearing it so we can pass it to commitPendingAdjust
        const scrollingTo = state.scrollingTo;

        logScrollControllerDebug("scrollTo:finish", {
            didFinishInitialScroll: state.didFinishInitialScroll,
            isInitialScroll: !!scrollingTo.isInitialScroll,
            offset: scrollingTo.offset,
            scroll: state.scroll,
            scrollPending: state.scrollPending,
            targetOffset: scrollingTo.targetOffset,
        });

        state.scrollHistory.length = 0;
        state.initialScroll = undefined;
        state.initialScrollUsesOffset = false;
        state.initialAnchor = undefined;
        state.initialNativeScrollWatchdog = undefined;
        state.scrollingTo = undefined;
        if (Platform.OS === "web" && scrollingTo.isInitialScroll && scrollingTo.index !== undefined) {
            const retryWindowUntil = Date.now() + INITIAL_SCROLL_MVCP_ANCHOR_TTL_MS;
            state.initialScrollMVCPAnchorUntil = retryWindowUntil;
            state.initialScrollRetryWindowUntil = Math.max(state.initialScrollRetryWindowUntil, retryWindowUntil);
        } else {
            state.initialScrollMVCPAnchorUntil = 0;
            state.initialScrollRetryWindowUntil = 0;
        }

        if (state.pendingTotalSize !== undefined) {
            addTotalSize(ctx, null, state.pendingTotalSize);
        }

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
