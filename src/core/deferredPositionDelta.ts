import type { DeferredGeometryBoundaryReason } from "@/core/deferredGeometryFlush";
import { INTERNAL_PERF_CONFIG } from "@/core/internalPerfConfig";
import type { StateContext } from "@/state/state";
import type { InternalState } from "@/types.base";
import { requestAdjust } from "@/utils/requestAdjust";

export type DeferredPositionFlushReason = DeferredGeometryBoundaryReason | "data-change" | "hard-cap" | "top-cap";
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

function isDeferredPositionDeltaBlockedByScrollMode(state: InternalState) {
    return !!state.initialScroll || !state.didFinishInitialScroll || !!state.scrollingTo;
}

function isDeferredPositionDeltaSupportedLayout(state: InternalState, numColumns: number) {
    return !state.props.horizontal && numColumns === 1 && state.props.stickyIndicesArr.length === 0;
}

export function canUseDeferredPositionDelta(state: InternalState, numColumns: number) {
    const canUseDeferredPositionDeltaForPass =
        !isDeferredPositionDeltaBlockedByScrollMode(state) && isDeferredPositionDeltaSupportedLayout(state, numColumns);

    if (INTERNAL_PERF_CONFIG.log && state.scrollingTo) {
        console.log(
            "[legend-list][perf]",
            JSON.stringify({
                canUseDeferredPositionDelta: canUseDeferredPositionDeltaForPass,
                didFinishInitialScroll: state.didFinishInitialScroll,
                event: "deferred-position-delta-gate",
                horizontal: !!state.props.horizontal,
                initialScroll: !!state.initialScroll,
                isBlockedByScrollMode: isDeferredPositionDeltaBlockedByScrollMode(state),
                isSupportedLayout: isDeferredPositionDeltaSupportedLayout(state, numColumns),
                numColumns,
                scrollingTo: {
                    animated: !!state.scrollingTo.animated,
                    index: state.scrollingTo.index,
                    isInitialScroll: !!state.scrollingTo.isInitialScroll,
                    offset: state.scrollingTo.offset,
                    targetOffset: state.scrollingTo.targetOffset,
                    viewPosition: state.scrollingTo.viewPosition,
                },
                stickyCount: state.props.stickyIndicesArr.length,
            }),
        );
    }

    return canUseDeferredPositionDeltaForPass;
}

export function shouldDeferPositionDeltaVisualAdjust(state: InternalState, numColumns: number) {
    return (
        !state.postInitialSettleTarget &&
        !state.deferredPositionNeedsStablePass &&
        canUseDeferredPositionDelta(state, numColumns)
    );
}

export function resetDeferredPositionDelta(
    state: InternalState,
    deferredPositionBaseline = state.deferredPositionBaseline,
) {
    state.deferredPositionDelta = 0;
    state.deferredPositionNeedsStablePass = true;
    deferredPositionBaseline.clear();
}

export function setupDeferredPositionPass(params: {
    ctx: StateContext;
    dataChanged?: boolean;
    numColumns: number;
    queuedBoundaryReason?: DeferredGeometryBoundaryReason;
    scrollLength: number;
    scrollState: number;
}): DeferredPositionPassSetup {
    const { ctx, dataChanged, numColumns, queuedBoundaryReason, scrollLength, scrollState } = params;
    const state = ctx.state;
    const canDeferPositionDelta = canUseDeferredPositionDelta(state, numColumns);
    const shouldDeferPositionDeltaVisualAdjustForPass =
        shouldDeferPositionDeltaVisualAdjust(state, numColumns) && !dataChanged;
    const deferredPositionBaseline = state.deferredPositionBaseline;
    const rebaseDeferredPositionPass = (reason: DeferredPositionFlushReason): DeferredPositionPassSetup => {
        const deferredPositionDeltaBefore = state.deferredPositionDelta;

        resetDeferredPositionDelta(state, deferredPositionBaseline);
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

    if (queuedBoundaryReason && hasDeferredPositionState) {
        return rebaseDeferredPositionPass(queuedBoundaryReason);
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

export function resolveDeferredPositionDelta(deltas: number[]): DeferredPositionDeltaMatch | null {
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

export function applyDeferredPositionDelta(params: {
    canUseDeferredPositionDelta: boolean;
    deferredPositionDeltaBefore: number;
    deferredPositionDeltaCandidates: number[];
}): DeferredPositionDeltaResult {
    const { canUseDeferredPositionDelta, deferredPositionDeltaBefore, deferredPositionDeltaCandidates } = params;

    if (!canUseDeferredPositionDelta) {
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
