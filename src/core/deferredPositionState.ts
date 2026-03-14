import { isInitialScrollMVCPAnchorActive } from "@/core/initialScrollMVCPAnchor";
import type { StateContext } from "@/state/state";
import type { InternalState } from "@/types.base";
import { hasActiveMVCPAnchorLock } from "@/utils/hasActiveMVCPAnchorLock";
import { requestAdjust } from "@/utils/requestAdjust";

const DEFERRED_POSITION_FLUSH_HARD_CAP_PX = 800;
const DEFERRED_POSITION_FLUSH_SAFETY_THRESHOLD_PX = 400;

export function resetDeferredPositionState(state: InternalState) {
    state.deferredPositionDelta = 0;
    state.pendingDeferredSizeShift = 0;
}

export function hasDeferredPositionState(state: InternalState) {
    return Math.abs(state.deferredPositionDelta) > 0.1 || state.pendingDeferredSizeShift !== 0;
}

export function shouldDeferDeferredPositionRebaseForActiveMVCP(state: InternalState) {
    return (
        !!state.nativeMVCPSettling ||
        !!state.dataChangeNeedsScrollUpdate ||
        hasActiveMVCPAnchorLock(state) ||
        isInitialScrollMVCPAnchorActive(state)
    );
}

export function rebaseDeferredPositionState(ctx: StateContext, _reason: string) {
    const state = ctx.state;
    const didHaveDeferredState = hasDeferredPositionState(state);
    const deferredPositionDelta = state.deferredPositionDelta;

    resetDeferredPositionState(state);
    if (deferredPositionDelta !== 0) {
        requestAdjust(ctx, deferredPositionDelta);
    }

    return didHaveDeferredState;
}

export function flushDeferredPositionStateBoundary(ctx: StateContext, reason: string) {
    if (!rebaseDeferredPositionState(ctx, reason)) {
        return false;
    }

    ctx.state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
    return true;
}

export function flushDeferredPositionStateBeforeScroll(ctx: StateContext) {
    if (!flushDeferredPositionStateBoundary(ctx, "scrollTo")) {
        return false;
    }

    return true;
}

export function shouldFlushDeferredPositionForCap(params: {
    deferredPositionDelta: number;
    scrollLength: number;
    scrollState: number;
}) {
    const { deferredPositionDelta, scrollLength, scrollState } = params;
    const absDeferredPositionDelta = Math.abs(deferredPositionDelta);
    const hardCapPx = Math.max(scrollLength, DEFERRED_POSITION_FLUSH_HARD_CAP_PX);
    const relativeCapPx = Math.max(0, scrollState - DEFERRED_POSITION_FLUSH_SAFETY_THRESHOLD_PX);

    if (absDeferredPositionDelta >= hardCapPx) {
        return true;
    }
    if (absDeferredPositionDelta > relativeCapPx) {
        return true;
    }
    return false;
}
