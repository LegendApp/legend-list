import { addTotalSize } from "@/core/addTotalSize";
import { Platform } from "@/platform/Platform";
import { type StateContext, set$ } from "@/state/state";
import { setInitialRenderState } from "@/utils/setInitialRenderState";

export function finishScrollTo(ctx: StateContext) {
    const state = ctx.state;
    if (state?.scrollingTo) {
        state.scrollHistory.length = 0;
        state.initialScroll = undefined;
        state.initialAnchor = undefined;
        state.scrollingTo = undefined;

        if (state.pendingTotalSize !== undefined) {
            addTotalSize(ctx, null, state.pendingTotalSize);
        }

        if (state.props?.data) {
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
        }

        if (Platform.OS === "web") {
            state.scrollAdjustHandler.commitPendingAdjust();
        }

        setInitialRenderState(ctx, { didInitialScroll: true });
    }
}
