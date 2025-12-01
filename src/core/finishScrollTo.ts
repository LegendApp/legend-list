import { addTotalSize } from "@/core/addTotalSize";
import { peek$, type StateContext, set$ } from "@/state/state";
import type { InternalState } from "@/types";

export function finishScrollTo(ctx: StateContext, state: InternalState | null | undefined) {
    if (state) {
        state.scrollHistory.length = 0;
        state.initialScroll = undefined;
        state.initialAnchor = undefined;
        set$(ctx, "scrollingTo", undefined);
        if (state.pendingTotalSize !== undefined) {
            addTotalSize(ctx, state, null, state.pendingTotalSize);
        }
        if (state.props?.data) {
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
        }
    }
}
