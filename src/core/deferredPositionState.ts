import { isInitialBootstrapActive } from "@/core/initialBootstrap";
import { runRuntimeRequestAdjust } from "@/core/runtimeCallbacks";
import type { StateContext } from "@/state/state";
import type { InternalState } from "@/types.base";
import { hasActiveMVCPAnchorLock } from "@/utils/hasActiveMVCPAnchorLock";

const DEFERRED_POSITION_FLUSH_HARD_CAP_PX = 800;
const DEFERRED_POSITION_FLUSH_SAFETY_THRESHOLD_PX = 400;

export function ensureDeferredGeometryState(state: InternalState) {
    state.deferredGeometry ??= {
        delta: 0,
        pendingSizeShift: 0,
    };
    return state.deferredGeometry;
}

export function resetDeferredPositionState(state: InternalState) {
    const deferredGeometry = ensureDeferredGeometryState(state);
    deferredGeometry.delta = 0;
    deferredGeometry.pendingSizeShift = 0;
}

export function hasDeferredPositionState(state: InternalState) {
    const deferredGeometry = ensureDeferredGeometryState(state);
    return Math.abs(deferredGeometry.delta) > 0.1 || deferredGeometry.pendingSizeShift !== 0;
}

export function shouldDeferDeferredPositionRebaseForActiveMVCP(state: InternalState) {
    return (
        !!state.ignoreScrollFromMVCP ||
        !!state.pendingNativeMVCPAdjust ||
        !!state.dataChangeNeedsScrollUpdate ||
        hasActiveMVCPAnchorLock(state) ||
        isInitialBootstrapActive(state)
    );
}

export function rebaseDeferredPositionState(ctx: StateContext) {
    const state = ctx.state;
    const didHaveDeferredState = hasDeferredPositionState(state);
    const deferredGeometry = ensureDeferredGeometryState(state);
    const deferredPositionDelta = deferredGeometry.delta;

    resetDeferredPositionState(state);
    if (deferredPositionDelta !== 0) {
        runRuntimeRequestAdjust(ctx, deferredPositionDelta);
    }

    return didHaveDeferredState;
}

export function flushDeferredPositionStateBoundary(ctx: StateContext) {
    if (!rebaseDeferredPositionState(ctx)) {
        return false;
    }

    ctx.state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
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
