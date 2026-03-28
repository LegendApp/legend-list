import { calculateItemsInView } from "@/core/calculateItemsInView";
import { getDataChangeReconcileRequest } from "@/core/calculateItemsInViewRequests";
import { doMaintainScrollAtEnd } from "@/core/doMaintainScrollAtEnd";
import type { StateContext } from "@/state/state";
import { checkThresholds } from "@/utils/checkThresholds";

export function reconcileDataChange(ctx: StateContext) {
    calculateItemsInView(ctx, getDataChangeReconcileRequest());
}

export function finalizeDataChangeSideEffects(
    ctx: StateContext,
    dataLength = ctx.state.props.data.length,
    previousData = ctx.state.previousData,
    options?: {
        skipThresholds?: boolean;
    },
) {
    const state = ctx.state;

    const didMaintainScrollAtEnd = state.props.maintainScrollAtEnd?.onDataChange ? doMaintainScrollAtEnd(ctx) : false;

    if (!didMaintainScrollAtEnd && previousData && dataLength > previousData.length) {
        state.isEndReached = false;
    }

    if (!didMaintainScrollAtEnd && !options?.skipThresholds) {
        checkThresholds(ctx);
    }

    delete state.previousData;
}

export function finalizeDataChange(ctx: StateContext, dataLength = ctx.state.props.data.length) {
    reconcileDataChange(ctx);
    finalizeDataChangeSideEffects(ctx, dataLength);
}
