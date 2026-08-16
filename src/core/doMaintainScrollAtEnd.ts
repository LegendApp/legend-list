import { clampScrollOffset } from "@/core/clampScrollOffset";
import { getScrollRequestTracker } from "@/core/scrollRequestTracker";
import { getAlignItemsAtEndPadding } from "@/core/updateContentMetricsState";
import { getContentSize } from "@/state/getContentSize";
import { peek$, type StateContext, set$ } from "@/state/state";
import { requestAdjust } from "@/utils/requestAdjust";

export function finishMaintainScrollAtEnd(ctx: StateContext) {
    const { state } = ctx;
    const currentPadding = peek$(ctx, "alignItemsAtEndPadding") || 0;
    const nextPadding = getAlignItemsAtEndPadding(ctx);
    state.maintainingScrollAtEnd = undefined;
    state.pendingMaintainScrollAtEnd = false;
    if (currentPadding !== nextPadding) {
        set$(ctx, "alignItemsAtEndPadding", nextPadding);
        state.scrollForNextCalculateItemsInView = undefined;
        state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
        const nextScroll = clampScrollOffset(ctx, state.scroll + nextPadding - currentPadding);
        requestAdjust(ctx, nextScroll - state.scroll);
    }
}

export function doMaintainScrollAtEnd(ctx: StateContext) {
    const state = ctx.state;
    const {
        didContainersLayout,
        didFinishInitialScroll,
        pendingNativeMVCPAdjust,
        props: { maintainScrollAtEnd },
    } = state;
    const isWithinMaintainScrollAtEndThreshold = peek$(ctx, "isWithinMaintainScrollAtEndThreshold");
    const isReplayingPendingMaintain = !!state.pendingMaintainScrollAtEnd;
    const shouldMaintainScrollAtEnd = !!(
        (isWithinMaintainScrollAtEndThreshold || isReplayingPendingMaintain) &&
        maintainScrollAtEnd &&
        didFinishInitialScroll
    );

    if (shouldMaintainScrollAtEnd && !didContainersLayout) {
        state.pendingMaintainScrollAtEnd = true;
        return false;
    }

    // Native MVCP can still be finishing its own clamp after data changes. Defer the end-anchor scroll
    // until that settles so maintainScrollAtEnd does not fight the platform's pending adjustment.
    if (pendingNativeMVCPAdjust) {
        state.pendingMaintainScrollAtEnd = shouldMaintainScrollAtEnd;
        return false;
    }

    // Run this only if scroll is at the bottom and after initial layout
    if (shouldMaintainScrollAtEnd && didContainersLayout) {
        state.pendingMaintainScrollAtEnd = false;
        // Set scroll to the bottom of the list so that checkAtTop/checkAtBottom is correct
        const contentSize = getContentSize(ctx);
        if (contentSize < state.scrollLength) {
            // If content fits within the viewport, we should be at scroll 0.
            state.scroll = 0;
        }

        if (!state.maintainingScrollAtEnd) {
            const pendingState = maintainScrollAtEnd.animated ? "pending-animated" : "pending-instant";
            const activeState = maintainScrollAtEnd.animated ? "animated" : "instant";
            const scrollAtRequest = state.scroll;
            state.maintainingScrollAtEnd = pendingState;
            requestAnimationFrame(() => {
                if (state.maintainingScrollAtEnd !== pendingState) {
                    return;
                }

                const isStillWithinThreshold = peek$(ctx, "isWithinMaintainScrollAtEndThreshold");
                const didScrollSinceRequest = state.scroll !== scrollAtRequest;
                // Layout and content changes can move the end beyond the threshold while this request is pending.
                // Keep the original end anchor unless the scroll position changed in the meantime.
                if (isReplayingPendingMaintain || isStillWithinThreshold || !didScrollSinceRequest) {
                    state.maintainingScrollAtEnd = activeState;
                    const scrollPromise = getScrollRequestTracker(ctx).runNowIfIdle(() =>
                        ctx.scrollToEnd!({ animated: maintainScrollAtEnd.animated }),
                    );

                    void scrollPromise.then(() => {
                        if (state.maintainingScrollAtEnd !== activeState) {
                            return;
                        }
                        if (state.pendingMaintainScrollAtEnd) {
                            state.maintainingScrollAtEnd = undefined;
                            doMaintainScrollAtEnd(ctx);
                        } else {
                            finishMaintainScrollAtEnd(ctx);
                        }
                    });
                } else if (state.maintainingScrollAtEnd === pendingState) {
                    finishMaintainScrollAtEnd(ctx);
                }
            });
        } else {
            // Coalesce follow-up requests while the current maintain pass is still settling.
            state.pendingMaintainScrollAtEnd = true;
        }

        return true;
    }

    finishMaintainScrollAtEnd(ctx);
    return false;
}
