import type { StateContext } from "@/state/state";
import type { InternalState } from "@/types.base";
import { requestAdjust } from "@/utils/requestAdjust";

export function resetDeferredPositionState(state: InternalState) {
    state.deferredPositionDelta = 0;
    state.pendingDeferredSizeShift = 0;
    state.pendingDeferredSizeShiftMinIndex = Infinity;
}

export function hasDeferredPositionState(state: InternalState) {
    return Math.abs(state.deferredPositionDelta) > 0.1 || state.pendingDeferredSizeShift !== 0;
}

export function rebaseDeferredPositionState(ctx: StateContext) {
    const state = ctx.state;
    const didHaveDeferredState = hasDeferredPositionState(state);
    const deferredPositionDelta = state.deferredPositionDelta;

    resetDeferredPositionState(state);
    if (deferredPositionDelta !== 0) {
        requestAdjust(ctx, deferredPositionDelta);
    }

    return didHaveDeferredState;
}

export function flushDeferredPositionStateBeforeScroll(ctx: StateContext) {
    const state = ctx.state;
    const didHaveDeferredState = hasDeferredPositionState(state);
    if (!didHaveDeferredState) {
        return false;
    }

    rebaseDeferredPositionState(ctx);
    state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
    return true;
}
