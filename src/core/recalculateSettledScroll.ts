import type { StateContext } from "@/state/state";
import { checkThresholds } from "@/utils/checkThresholds";

export function recalculateSettledScroll(ctx: StateContext) {
    const state = ctx.state;
    if (state.props?.data) {
        state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
    }

    checkThresholds(ctx);
}
