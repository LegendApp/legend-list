import { getContentSize } from "@/state/getContentSize";
import type { StateContext } from "@/state/state";
import type { MaintainScrollAtEndOptions } from "@/types.base";

export function doMaintainScrollAtEnd(ctx: StateContext) {
    const state = ctx.state;
    const {
        didContainersLayout,
        isAtEnd,
        pendingNativeMVCPAdjust,
        refScroller,
        props: { maintainScrollAtEnd },
    } = state;

    // Run this only if scroll is at the bottom and after initial layout
    if (!pendingNativeMVCPAdjust && isAtEnd && maintainScrollAtEnd && didContainersLayout) {
        const animated =
            maintainScrollAtEnd !== true ? ((maintainScrollAtEnd as MaintainScrollAtEndOptions).animated ?? false) : false;
        // Set scroll to the bottom of the list so that checkAtTop/checkAtBottom is correct
        const contentSize = getContentSize(ctx);
        if (contentSize < state.scrollLength) {
            // If content fits within the viewport, we should be at scroll 0.
            state.scroll = 0;
        }

        requestAnimationFrame(() => {
            // Make sure we're still at the end after the animation frame, before scrolling to the end
            if (state.isAtEnd) {
                state.maintainingScrollAtEnd = true;
                refScroller.current?.scrollToEnd({
                    animated,
                });
                setTimeout(
                    () => {
                        state.maintainingScrollAtEnd = false;
                    },
                    animated ? 500 : 0,
                );
            }
        });

        return true;
    }

    return false;
}
