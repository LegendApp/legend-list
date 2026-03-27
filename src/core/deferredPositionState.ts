import { runRuntimeRequestAdjust } from "@/core/runtimeCallbacks";
import { hasBootstrapScrollOwnership, hasMVCPScrollOwnership } from "@/core/scrollOwnership";
import type { StateContext } from "@/state/state";
import type { InternalState } from "@/types.base";
import type { DeferredGeometryAnchorState } from "@/typesInternal";
import { logInitialScrollDebug } from "@/utils/debugInitialScroll";

const DEFERRED_POSITION_FLUSH_HARD_CAP_PX = 800;
const DEFERRED_POSITION_FLUSH_SAFETY_THRESHOLD_PX = 400;

function createDeferredGeometryAnchorState(): DeferredGeometryAnchorState {
    return {
        desiredViewportOffset: undefined,
        indexHint: undefined,
        key: undefined,
        lastMeasuredViewportOffset: undefined,
    };
}

export function ensureDeferredGeometryState(state: InternalState) {
    state.deferredGeometry ??= {
        anchor: createDeferredGeometryAnchorState(),
        delta: 0,
        pendingSizeShift: 0,
        residualAnchorError: 0,
    };
    state.deferredGeometry.anchor ??= createDeferredGeometryAnchorState();
    state.deferredGeometry.residualAnchorError ??= 0;
    return state.deferredGeometry;
}

export function resetDeferredGeometryAnchor(state: InternalState) {
    const deferredGeometry = ensureDeferredGeometryState(state);
    deferredGeometry.anchor = createDeferredGeometryAnchorState();
    deferredGeometry.residualAnchorError = 0;
}

export function setDeferredGeometryAnchor(
    state: InternalState,
    anchor: Partial<DeferredGeometryAnchorState>,
) {
    const deferredGeometry = ensureDeferredGeometryState(state);
    deferredGeometry.anchor = {
        ...deferredGeometry.anchor,
        ...anchor,
    };
    return deferredGeometry.anchor;
}

export function hasDeferredGeometryAnchorMeasurement(state: InternalState) {
    const deferredGeometry = ensureDeferredGeometryState(state);
    return (
        deferredGeometry.anchor.desiredViewportOffset !== undefined &&
        deferredGeometry.anchor.lastMeasuredViewportOffset !== undefined
    );
}

export function syncDeferredGeometryAnchorMeasurement(
    state: InternalState,
    measuredViewportOffset: number | undefined,
) {
    const deferredGeometry = ensureDeferredGeometryState(state);
    deferredGeometry.anchor.lastMeasuredViewportOffset = measuredViewportOffset;
    if (
        measuredViewportOffset === undefined ||
        deferredGeometry.anchor.desiredViewportOffset === undefined
    ) {
        deferredGeometry.residualAnchorError = 0;
        return 0;
    }

    deferredGeometry.residualAnchorError =
        measuredViewportOffset - deferredGeometry.anchor.desiredViewportOffset;
    return deferredGeometry.residualAnchorError;
}

export function getDeferredGeometrySettleAdjust(state: InternalState) {
    const deferredGeometry = ensureDeferredGeometryState(state);
    if (hasDeferredGeometryAnchorMeasurement(state)) {
        return deferredGeometry.residualAnchorError;
    }
    return deferredGeometry.delta;
}

export function resetDeferredPositionState(state: InternalState) {
    const deferredGeometry = ensureDeferredGeometryState(state);
    deferredGeometry.delta = 0;
    deferredGeometry.pendingSizeShift = 0;
    resetDeferredGeometryAnchor(state);
}

export function hasDeferredPositionState(state: InternalState) {
    const deferredGeometry = ensureDeferredGeometryState(state);
    return (
        Math.abs(deferredGeometry.delta) > 0.1 ||
        deferredGeometry.pendingSizeShift !== 0 ||
        Math.abs(deferredGeometry.residualAnchorError) > 0.1
    );
}

export function shouldDeferDeferredPositionRebaseForActiveMVCP(state: InternalState) {
    return hasMVCPScrollOwnership(state) || hasBootstrapScrollOwnership(state);
}

export function canFlushDeferredPositionStateBoundary(state: InternalState) {
    return hasDeferredPositionState(state) && !shouldDeferDeferredPositionRebaseForActiveMVCP(state);
}

export function rebaseDeferredPositionState(ctx: StateContext) {
    const state = ctx.state;
    const didHaveDeferredState = hasDeferredPositionState(state);
    const deferredGeometry = ensureDeferredGeometryState(state);
    const deferredPositionDelta = deferredGeometry.delta;
    const settleAdjust = getDeferredGeometrySettleAdjust(state);

    resetDeferredPositionState(state);
    if (settleAdjust !== 0) {
        logInitialScrollDebug("rebase-deferred-position-state", {
            deferredPositionDelta,
            didHaveDeferredState,
            residualAnchorError: deferredGeometry.residualAnchorError,
            settleAdjust,
        });
        runRuntimeRequestAdjust(ctx, settleAdjust);
    }

    return didHaveDeferredState;
}

export function flushDeferredPositionStateBoundary(ctx: StateContext) {
    const deferredGeometry = ensureDeferredGeometryState(ctx.state);
    logInitialScrollDebug("flush-deferred-position-boundary", {
        deferredAnchor: deferredGeometry.anchor,
        deferredPositionDelta: deferredGeometry.delta,
        pendingSizeShift: deferredGeometry.pendingSizeShift,
        residualAnchorError: deferredGeometry.residualAnchorError,
        settleAdjust: getDeferredGeometrySettleAdjust(ctx.state),
    });
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
