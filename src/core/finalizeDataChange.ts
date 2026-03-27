import { calculateItemsInView } from "@/core/calculateItemsInView";
import { getDataChangeReconcileRequest } from "@/core/calculateItemsInViewRequests";
import { doMaintainScrollAtEnd } from "@/core/doMaintainScrollAtEnd";
import type { StateContext } from "@/state/state";
import { checkThresholds } from "@/utils/checkThresholds";

export function finalizeDataChange(ctx: StateContext, dataLength = ctx.state.props.data.length) {
    const state = ctx.state;
    const previousData = state.previousData;

    calculateItemsInView(ctx, getDataChangeReconcileRequest());

    const didMaintainScrollAtEnd = state.props.maintainScrollAtEnd?.onDataChange ? doMaintainScrollAtEnd(ctx) : false;

    if (!didMaintainScrollAtEnd && previousData && dataLength > previousData.length) {
        state.isEndReached = false;
    }

    if (!didMaintainScrollAtEnd) {
        checkThresholds(ctx);
    }

    delete state.previousData;
}
