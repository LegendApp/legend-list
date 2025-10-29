import { type StateContext, set$ } from "@/state/state";
import type { InternalState } from "@/types";

export function finishScrollTo(ctx: StateContext, state: InternalState | null | undefined) {
    if (state) {
        state.scrollHistory.length = 0;
        state.initialScroll = undefined;
        state.isOptimizingItemPositions = false;
        set$(ctx, "scrollingTo", undefined);
        if (state.props?.data) {
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
        }
    }
}
