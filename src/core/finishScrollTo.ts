import { addTotalSize } from "@/core/addTotalSize";
import { openInitialScrollRetryWindow } from "@/core/initialScrollMVCPAnchor";
import { Platform, PlatformAdjustBreaksScroll } from "@/platform/Platform";
import type { StateContext } from "@/state/state";
import { checkThresholds } from "@/utils/checkThresholds";
import { setInitialRenderState } from "@/utils/setInitialRenderState";

const INITIAL_SCROLL_RETRY_WINDOW_MS = 2000;

export function finishScrollTo(ctx: StateContext) {
    const state = ctx.state;
    if (state?.scrollingTo) {
        const resolvePendingScroll = state.pendingScrollResolve;
        state.pendingScrollResolve = undefined;

        // Save scrollingTo before clearing it so we can pass it to commitPendingAdjust
        const scrollingTo = state.scrollingTo;

        if (scrollingTo.isInitialScroll && state.initialScrollLastTarget && !state.initialScrollLastTargetUsesOffset) {
            state.initialScrollLastTarget = {
                ...state.initialScrollLastTarget,
                contentOffset: scrollingTo.targetOffset ?? scrollingTo.offset,
            };
        }

        state.scrollHistory.length = 0;
        state.initialScroll = undefined;
        state.initialScrollUsesOffset = false;
        state.initialAnchor = undefined;
        state.initialNativeScrollWatchdog = undefined;
        state.scrollingTo = undefined;
        if (
            (Platform.OS === "web" || Platform.OS === "ios") &&
            scrollingTo.isInitialScroll &&
            scrollingTo.index !== undefined
        ) {
            openInitialScrollRetryWindow(state, INITIAL_SCROLL_RETRY_WINDOW_MS);
        } else {
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
