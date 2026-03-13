import { getContentSize } from "@/state/getContentSize";
import type { StateContext } from "@/state/state";
import { logScrollControllerDebug } from "@/utils/debugScrollControllers";

export function doMaintainScrollAtEnd(ctx: StateContext) {
    const state = ctx.state;
    const {
        didContainersLayout,
        isAtEnd,
        pendingNativeMVCPAdjust,
        refScroller,
        props: { maintainScrollAtEnd },
    } = state;
    const shouldMaintainScrollAtEnd = !!(isAtEnd && maintainScrollAtEnd && didContainersLayout);

    logScrollControllerDebug("maintain:end-check", {
        didContainersLayout,
        hasPendingNativeMVCPAdjust: !!pendingNativeMVCPAdjust,
        isAtEnd,
        scroll: state.scroll,
        scrollLength: state.scrollLength,
        shouldMaintainScrollAtEnd,
    });

    // Native MVCP can still be finishing its own clamp after data changes. Defer the end-anchor scroll
    // until that settles so maintainScrollAtEnd does not fight the platform's pending adjustment.
    if (pendingNativeMVCPAdjust) {
        state.pendingMaintainScrollAtEnd = shouldMaintainScrollAtEnd;
        logScrollControllerDebug("maintain:end-defer", {
            isAtEnd,
            pendingMaintainScrollAtEnd: state.pendingMaintainScrollAtEnd,
            scroll: state.scroll,
        });
        return false;
    }

    state.pendingMaintainScrollAtEnd = false;

    // Run this only if scroll is at the bottom and after initial layout
    if (shouldMaintainScrollAtEnd) {
        // Set scroll to the bottom of the list so that checkAtTop/checkAtBottom is correct
        const contentSize = getContentSize(ctx);
        if (contentSize < state.scrollLength) {
            // If content fits within the viewport, we should be at scroll 0.
            state.scroll = 0;
        }

        logScrollControllerDebug("maintain:end-schedule", {
            animated: maintainScrollAtEnd.animated,
            contentSize,
            scroll: state.scroll,
            scrollLength: state.scrollLength,
        });

        requestAnimationFrame(() => {
            // Make sure we're still at the end after the animation frame, before scrolling to the end
            if (state.isAtEnd) {
                state.maintainingScrollAtEnd = true;
                logScrollControllerDebug("maintain:end-fire", {
                    animated: maintainScrollAtEnd.animated,
                    scroll: state.scroll,
                    scrollLength: state.scrollLength,
                });
                refScroller.current?.scrollToEnd({
                    animated: maintainScrollAtEnd.animated,
                });
                setTimeout(
                    () => {
                        state.maintainingScrollAtEnd = false;
                        logScrollControllerDebug("maintain:end-complete", {
                            animated: maintainScrollAtEnd.animated,
                            scroll: state.scroll,
                        });
                    },
                    maintainScrollAtEnd.animated ? 500 : 0,
                );
            } else {
                logScrollControllerDebug("maintain:end-cancel", {
                    reason: "no-longer-at-end-before-raf",
                    scroll: state.scroll,
                });
            }
        });

        return true;
    }

    return false;
}
