import { runRuntimeRequestAdjust } from "@/core/runtimeCallbacks";
import { hasBootstrapScrollOwnership, hasMVCPScrollOwnership } from "@/core/scrollOwnership";
import { Platform } from "@/platform/Platform";
import type { StateContext } from "@/state/state";
import type { InternalState } from "@/types.base";
import type { DeferredGeometryAnchorState } from "@/typesInternal";
import { logInitialScrollDebug } from "@/utils/debugInitialScroll";

const DEFERRED_POSITION_FLUSH_HARD_CAP_PX = 800;
const DEFERRED_POSITION_FLUSH_SAFETY_THRESHOLD_PX = 400;
const DEFERRED_POSITION_BOUNDARY_HANDOFF_EPSILON = 1;
const DEFERRED_POSITION_BOUNDARY_HANDOFF_FALLBACK_MS = 48;

function createDeferredGeometryAnchorState(): DeferredGeometryAnchorState {
    return {
        desiredViewportOffset: undefined,
        indexHint: undefined,
        key: undefined,
        lastMeasuredViewportOffset: undefined,
    };
}

function clearPendingDeferredBoundaryHandoffTimeout(state: InternalState) {
    const pendingBoundaryHandoff = ensureDeferredGeometryState(state).pendingBoundaryHandoff;
    if (pendingBoundaryHandoff?.fallbackTimeout !== undefined) {
        clearTimeout(pendingBoundaryHandoff.fallbackTimeout);
        pendingBoundaryHandoff.fallbackTimeout = undefined;
    }
}

export function ensureDeferredGeometryState(state: InternalState) {
    state.deferredGeometry ??= {
        anchor: createDeferredGeometryAnchorState(),
        delta: 0,
        pendingBoundaryHandoff: undefined,
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
        return deferredGeometry.delta + deferredGeometry.residualAnchorError;
    }
    return deferredGeometry.delta;
}

export function resetDeferredPositionState(state: InternalState) {
    const deferredGeometry = ensureDeferredGeometryState(state);
    clearPendingDeferredBoundaryHandoffTimeout(state);
    deferredGeometry.delta = 0;
    deferredGeometry.pendingBoundaryHandoff = undefined;
    deferredGeometry.pendingSizeShift = 0;
    resetDeferredGeometryAnchor(state);
}

export function hasPendingDeferredGeometryBoundaryHandoff(state: InternalState) {
    return !!ensureDeferredGeometryState(state).pendingBoundaryHandoff;
}

export function hasDeferredPositionState(state: InternalState) {
    const deferredGeometry = ensureDeferredGeometryState(state);
    return (
        Math.abs(deferredGeometry.delta) > 0.1 ||
        !!deferredGeometry.pendingBoundaryHandoff ||
        deferredGeometry.pendingSizeShift !== 0 ||
        Math.abs(deferredGeometry.residualAnchorError) > 0.1
    );
}

export function shouldDeferDeferredPositionRebaseForActiveMVCP(state: InternalState) {
    return (
        hasPendingDeferredGeometryBoundaryHandoff(state) ||
        hasMVCPScrollOwnership(state) ||
        hasBootstrapScrollOwnership(state)
    );
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
    const rawScroll = state.scroll;

    if (Platform.OS !== "web" && Math.abs(settleAdjust) > 0.1) {
        deferredGeometry.pendingBoundaryHandoff = {
            startScroll: rawScroll,
            targetScroll: rawScroll + settleAdjust,
        };
        deferredGeometry.pendingBoundaryHandoff.fallbackTimeout = setTimeout(() => {
            const latestDeferredGeometry = ensureDeferredGeometryState(ctx.state);
            const pendingBoundaryHandoff = latestDeferredGeometry.pendingBoundaryHandoff;
            if (
                !pendingBoundaryHandoff ||
                pendingBoundaryHandoff.startScroll !== rawScroll ||
                pendingBoundaryHandoff.targetScroll !== rawScroll + settleAdjust
            ) {
                return;
            }

            ctx.state.scroll = pendingBoundaryHandoff.targetScroll;
            ctx.state.scrollPending = pendingBoundaryHandoff.targetScroll;
            ctx.state.scrollForNextCalculateItemsInView = undefined;
            resetDeferredPositionState(ctx.state);
            ctx.state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
        }, DEFERRED_POSITION_BOUNDARY_HANDOFF_FALLBACK_MS);
        runRuntimeRequestAdjust(ctx, settleAdjust, undefined, {
            mutateScrollState: false,
            source: "deferred-boundary-flush",
        });
        return didHaveDeferredState;
    }

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

export function resolvePendingDeferredPositionBoundaryHandoff(state: InternalState, scroll: number) {
    const deferredGeometry = ensureDeferredGeometryState(state);
    const pendingBoundaryHandoff = deferredGeometry.pendingBoundaryHandoff;
    if (!pendingBoundaryHandoff) {
        return false;
    }

    deferredGeometry.delta = pendingBoundaryHandoff.targetScroll - scroll;

    const didReachTarget =
        Math.abs(scroll - pendingBoundaryHandoff.targetScroll) <= DEFERRED_POSITION_BOUNDARY_HANDOFF_EPSILON;
    if (!didReachTarget) {
        return false;
    }

    resetDeferredPositionState(state);
    return true;
}

export function flushDeferredPositionStateBoundary(ctx: StateContext) {
    if (!hasDeferredPositionState(ctx.state)) {
        return false;
    }

    // Sync one last deferred-geometry pass against the latest raw scroll before
    // converting deferred state into a settled adjustment.
    if (!hasPendingDeferredGeometryBoundaryHandoff(ctx.state)) {
        ctx.state.triggerCalculateItemsInView?.({});
    }

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

    if (!hasPendingDeferredGeometryBoundaryHandoff(ctx.state)) {
        ctx.state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
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
