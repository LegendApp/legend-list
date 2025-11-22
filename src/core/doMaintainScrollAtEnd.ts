import type { StateContext } from "@/state/state";
import { peek$ } from "@/state/state";
import type { InternalState } from "@/types";

export function doMaintainScrollAtEnd(ctx: StateContext, state: InternalState, animated: boolean) {
    const {
        refScroller,
        props: { maintainScrollAtEnd },
    } = state;
    // Run this only if scroll is at the bottom and after initial layout
    if (state?.isAtEnd && maintainScrollAtEnd && peek$(ctx, "containersDidLayout")) {
        // Set scroll to the bottom of the list so that checkAtTop/checkAtBottom is correct
        const paddingTop = peek$(ctx, "alignItemsPaddingTop");
        if (paddingTop > 0) {
            // if paddingTop exists, list is shorter then a screen, so scroll should be 0 anyways
            state.scroll = 0;
        }

        requestAnimationFrame(() => {
            // Make sure we're still at the end after the animation frame, before scrolling to the end
            if (state?.isAtEnd) {
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
}
