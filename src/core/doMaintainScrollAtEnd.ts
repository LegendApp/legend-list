import { getContentSize } from "@/state/getContentSize";
import { peek$, type StateContext } from "@/state/state";

export function doMaintainScrollAtEnd(ctx: StateContext) {
    const state = ctx.state;
    const {
        didContainersLayout,
        pendingNativeMVCPAdjust,
        refScroller,
        props: { maintainScrollAtEnd },
    } = state;
    const isWithinMaintainScrollAtEndThreshold = peek$(ctx, "isWithinMaintainScrollAtEndThreshold");
    const shouldMaintainScrollAtEnd = !!(
        isWithinMaintainScrollAtEndThreshold &&
        maintainScrollAtEnd &&
        didContainersLayout
    );

    // Native MVCP can still be finishing its own clamp after data changes. Defer the end-anchor scroll
    // until that settles so maintainScrollAtEnd does not fight the platform's pending adjustment.
    if (pendingNativeMVCPAdjust) {
        state.pendingMaintainScrollAtEnd = shouldMaintainScrollAtEnd;
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

        if (!state.maintainingScrollAtEnd) {
            state.maintainingScrollAtEnd = true;

            requestAnimationFrame(() => {
                // Make sure we're still at the end after the animation frame, before scrolling to the end
                if (peek$(ctx, "isWithinMaintainScrollAtEndThreshold")) {
                    refScroller.current?.scrollToEnd({
                        animated: maintainScrollAtEnd.animated,
                    });
                    setTimeout(
                        () => {
                            state.maintainingScrollAtEnd = false;
                        },
                        maintainScrollAtEnd.animated ? 500 : 0,
                    );
                } else {
                    state.maintainingScrollAtEnd = false;
                }
            });
        }

        return true;
    }

    return false;
}
