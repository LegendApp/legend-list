import { addTotalSize } from "@/core/addTotalSize";
import { peek$, type StateContext, set$ } from "@/state/state";

export function finishScrollTo(ctx: StateContext) {
    const state = ctx.state;
    if (state && peek$(ctx, "scrollingTo")) {
        state.scrollHistory.length = 0;
        state.initialScroll = undefined;
        state.initialAnchor = undefined;
        set$(ctx, "scrollingTo", undefined);

        if (state.pendingTotalSize !== undefined) {
            addTotalSize(ctx, null, state.pendingTotalSize);
        }
        if (state.props?.data) {
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
        }
    }
}
