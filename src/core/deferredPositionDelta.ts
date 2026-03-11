import { flushRenderedTotalSize } from "@/core/renderedTotalSize";
import type { StateContext } from "@/state/state";
import type { InternalState } from "@/types.base";
import { requestAdjust } from "@/utils/requestAdjust";

export type DeferredPositionFlushReason = "boundary" | "data-change" | "hard-cap" | "top-cap";
export type DeferredPositionDeltaMatch = { count: number; delta: number };
export type DeferredPositionDeltaResult = {
    deferredPositionDelta: number;
    deltaApplied: number;
    matchCount: number;
};
export type DeferredPositionPassSetup = {
    canUseDeferredPositionDelta: boolean;
    deferredPositionBaseline: Map<number, number>;
    deferredPositionDeltaBefore: number;
    deferredPositionFlushReason: DeferredPositionFlushReason | undefined;
    shouldDeferPositionDeltaVisualAdjust: boolean;
};

const DEFERRED_POSITION_FLUSH_HARD_CAP_PX = 800;
const DEFERRED_POSITION_FLUSH_SAFETY_THRESHOLD_PX = 400;

// Gating check for whether this pass can keep downstream position shifts in logical
// deferred state instead of immediately rebasing all local positions.
export function canUseDeferredPositionDelta(state: InternalState, numColumns: number) {
    return (
        !state.initialScroll &&
        !!state.didFinishInitialScroll &&
        !state.scrollingTo &&
        !state.props.horizontal &&
        numColumns === 1 &&
        state.props.stickyIndicesArr.length === 0
    );
}

// Narrower gate for visual deferral: this keeps logical deferral active only while
// the pass is stable enough to preserve the user's current scroll geometry.
export function shouldDeferPositionDeltaVisualAdjust(state: InternalState, numColumns: number) {
    return (
        !state.postInitialSettleTarget &&
        !state.deferredPositionNeedsStablePass &&
        canUseDeferredPositionDelta(state, numColumns)
    );
}

// Clears the pending deferred delta and baseline so the next pass rebuilds from
// local positions again.
export function resetDeferredPositionDelta(
    state: InternalState,
    deferredPositionBaseline = state.deferredPositionBaseline,
) {
    state.deferredPositionDelta = 0;
    state.deferredPositionNeedsStablePass = true;
    deferredPositionBaseline.clear();
}

// Imperative scroll APIs must commit any pending deferred rebase before they
// mark scroll ownership, otherwise the next layout pass drops the delta without
// compensating scroll and target offsets stay in the stale local coordinate space.
export function flushDeferredPositionRebaseBeforeScroll(ctx: StateContext) {
    const state = ctx.state;
    const { deferredPositionBaseline, deferredPositionDelta, triggerCalculateItemsInView } = state;
    const hasDeferredPositionState = Math.abs(deferredPositionDelta) > 0.1 || deferredPositionBaseline.size > 0;

    if (!hasDeferredPositionState) {
        return false;
    }

    resetDeferredPositionDelta(state, deferredPositionBaseline);
    state.pendingDeferredGeometryFlush = false;
    flushRenderedTotalSize(ctx);

    if (deferredPositionDelta !== 0) {
        requestAdjust(ctx, deferredPositionDelta);
    }

    triggerCalculateItemsInView?.({ forceFullItemPositions: true });
    return true;
}

// Classifies the current pass as deferred, rebased, or flushed based on queued
// boundaries, data changes, and safety caps before calculateItemsInView uses it.
export function setupDeferredPositionPass(params: {
    ctx: StateContext;
    dataChanged?: boolean;
    numColumns: number;
    queuedBoundary?: boolean;
    scrollLength: number;
    scrollState: number;
}): DeferredPositionPassSetup {
    const { ctx, dataChanged, numColumns, queuedBoundary, scrollLength, scrollState } = params;
    const state = ctx.state;
    const canDeferPositionDelta = canUseDeferredPositionDelta(state, numColumns);
    const shouldDeferPositionDeltaVisualAdjustForPass =
        shouldDeferPositionDeltaVisualAdjust(state, numColumns) && !dataChanged;
    const deferredPositionBaseline = state.deferredPositionBaseline;
    const rebaseDeferredPositionPass = (reason: DeferredPositionFlushReason): DeferredPositionPassSetup => {
        const deferredPositionDeltaBefore = state.deferredPositionDelta;

        resetDeferredPositionDelta(state, deferredPositionBaseline);
        flushRenderedTotalSize(ctx);
        if (deferredPositionDeltaBefore !== 0) {
            requestAdjust(ctx, deferredPositionDeltaBefore);
        }

        return {
            canUseDeferredPositionDelta: false,
            deferredPositionBaseline,
            deferredPositionDeltaBefore: 0,
            deferredPositionFlushReason: reason,
            shouldDeferPositionDeltaVisualAdjust: false,
        };
    };
    const deferredPositionDelta = state.deferredPositionDelta;
    const hasDeferredPositionState =
        canDeferPositionDelta && (deferredPositionDelta !== 0 || deferredPositionBaseline.size > 0);

    if (dataChanged && hasDeferredPositionState) {
        return rebaseDeferredPositionPass("data-change");
    }

    if (queuedBoundary && hasDeferredPositionState) {
        return rebaseDeferredPositionPass("boundary");
    }

    if (!canDeferPositionDelta) {
        resetDeferredPositionDelta(state, deferredPositionBaseline);
    }

    const deferredPositionDeltaBefore = canDeferPositionDelta ? state.deferredPositionDelta : 0;
    let deferredPositionFlushReason: DeferredPositionFlushReason | undefined;

    if (
        canDeferPositionDelta &&
        deferredPositionDeltaBefore !== 0 &&
        (shouldDeferPositionDeltaVisualAdjustForPass || dataChanged)
    ) {
        deferredPositionFlushReason = getDeferredPositionFlushReason({
            pendingDeferredPositionDelta: deferredPositionDeltaBefore,
            scrollLength,
            scrollState,
        });

        if (deferredPositionFlushReason) {
            return rebaseDeferredPositionPass(deferredPositionFlushReason);
        }
    }

    return {
        canUseDeferredPositionDelta: canDeferPositionDelta,
        deferredPositionBaseline,
        deferredPositionDeltaBefore,
        deferredPositionFlushReason,
        shouldDeferPositionDeltaVisualAdjust: shouldDeferPositionDeltaVisualAdjustForPass,
    };
}

// Finds the dominant repeated delta across mounted containers so the pass can
// treat a shared downstream shift as one logical offset.
export function resolveDeferredPositionDelta(deltas: number[]): DeferredPositionDeltaMatch | null {
    if (deltas.length === 1 && deltas[0]) {
        return { count: 1, delta: deltas[0] };
    }

    const counts = new Map<number, number>();

    for (const delta of deltas) {
        if (!delta) continue;
        counts.set(delta, (counts.get(delta) ?? 0) + 1);
    }

    let bestDelta = 0;
    let bestCount = 0;
    for (const [delta, count] of counts) {
        if (count > bestCount) {
            bestDelta = delta;
            bestCount = count;
        }
    }

    return bestCount > 1 ? { count: bestCount, delta: bestDelta } : null;
}

// Applies the dominant shared delta, if any, onto the running deferred offset for
// this pass without rewriting local positions yet.
export function applyDeferredPositionDelta(params: {
    canUseDeferredPositionDelta: boolean;
    deferredPositionDeltaBefore: number;
    deferredPositionDeltaCandidates: number[];
}): DeferredPositionDeltaResult {
    const {
        canUseDeferredPositionDelta: canUseDeferredPositionDeltaForPass,
        deferredPositionDeltaBefore,
        deferredPositionDeltaCandidates,
    } = params;

    if (!canUseDeferredPositionDeltaForPass) {
        return {
            deferredPositionDelta: 0,
            deltaApplied: 0,
            matchCount: 0,
        };
    }

    let deferredPositionDelta = deferredPositionDeltaBefore;
    let deltaApplied = 0;
    let matchCount = 0;

    const deferredPositionMatch = resolveDeferredPositionDelta(deferredPositionDeltaCandidates);
    if (deferredPositionMatch) {
        deferredPositionDelta += deferredPositionMatch.delta;
        deltaApplied = deferredPositionMatch.delta;
        matchCount = deferredPositionMatch.count;
    }

    return {
        deferredPositionDelta,
        deltaApplied,
        matchCount,
    };
}

// Chooses the safety boundary that forces a rebase once the deferred offset grows
// too large relative to the viewport or current scroll position.
export function getDeferredPositionFlushReason(params: {
    pendingDeferredPositionDelta: number;
    scrollLength: number;
    scrollState: number;
}): DeferredPositionFlushReason | undefined {
    const { pendingDeferredPositionDelta, scrollLength, scrollState } = params;
    const absPendingDeferredPositionDelta = Math.abs(pendingDeferredPositionDelta);
    const hardCapPx = Math.max(scrollLength, DEFERRED_POSITION_FLUSH_HARD_CAP_PX);
    const relativeCapPx = Math.max(0, scrollState - DEFERRED_POSITION_FLUSH_SAFETY_THRESHOLD_PX);

    if (absPendingDeferredPositionDelta >= hardCapPx) {
        return "hard-cap";
    }
    if (absPendingDeferredPositionDelta > relativeCapPx) {
        return "top-cap";
    }
    return undefined;
}
