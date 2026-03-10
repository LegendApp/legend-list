import { resolveDeferredGeometryFlushPlan } from "@/core/deferredGeometryFlush";
import { INTERNAL_PERF_CONFIG } from "@/core/internalPerfConfig";
import type { StateContext } from "@/state/state";
import type { InternalState } from "@/types.base";
import { requestAdjust } from "@/utils/requestAdjust";

export type SharedOriginFlushReason =
    | "data-change"
    | "hard-cap"
    | "settle-rebase"
    | "top-cap";
export type SharedOriginResolvedDelta = { count: number; delta: number };
export type SharedOriginAppliedDelta = {
    appliedSharedOriginOffset: number;
    pendingSharedOriginOffset: number;
    sharedOriginDeltaApplied: number;
    sharedOriginMatchCount: number;
    sharedOriginOffset: number;
};
export type SharedOriginPassSetup = {
    canUseSharedOrigin: boolean;
    logicalSharedOriginOffsetBefore: number;
    pendingSharedOriginOffsetBefore: number;
    sharedContainerAbsolutePositions: Map<number, number>;
    sharedOriginFlushReason: SharedOriginFlushReason | undefined;
    shouldDeferSharedOriginVisualAdjust: boolean;
    shouldSuppressVisualAdjustForPass: boolean;
};

const SHARED_ORIGIN_FLUSH_HARD_CAP_PX = 800;
const SHARED_ORIGIN_FLUSH_SAFETY_THRESHOLD_PX = 400;

function isSharedOriginBlockedByScrollMode(state: InternalState) {
    return !!state.initialScroll || !state.didFinishInitialScroll || !!state.scrollingTo;
}

function isSharedOriginSupportedLayout(state: InternalState, numColumns: number) {
    return !state.props.horizontal && numColumns === 1 && state.props.stickyIndicesArr.length === 0;
}

export function canUseSharedContainerOrigin(state: InternalState, numColumns: number) {
    const { sharedOriginEnabled } = INTERNAL_PERF_CONFIG;
    const canUse =
        sharedOriginEnabled &&
        !isSharedOriginBlockedByScrollMode(state) &&
        isSharedOriginSupportedLayout(state, numColumns);

    if (INTERNAL_PERF_CONFIG.log && state.scrollingTo) {
        console.log(
            "[legend-list][perf]",
            JSON.stringify({
                canUseSharedOrigin: canUse,
                didFinishInitialScroll: state.didFinishInitialScroll,
                event: "shared-origin-gate",
                horizontal: !!state.props.horizontal,
                initialScroll: !!state.initialScroll,
                isBlockedByScrollMode: isSharedOriginBlockedByScrollMode(state),
                isSupportedLayout: isSharedOriginSupportedLayout(state, numColumns),
                numColumns,
                scrollingTo: {
                    animated: !!state.scrollingTo.animated,
                    index: state.scrollingTo.index,
                    isInitialScroll: !!state.scrollingTo.isInitialScroll,
                    offset: state.scrollingTo.offset,
                    targetOffset: state.scrollingTo.targetOffset,
                    viewPosition: state.scrollingTo.viewPosition,
                },
                sharedOriginEnabled,
                stickyCount: state.props.stickyIndicesArr.length,
            }),
        );
    }

    return canUse;
}

export function shouldUseDeferredSharedOriginVisualAdjust(state: InternalState, numColumns: number) {
    return (
        INTERNAL_PERF_CONFIG.deferSharedOriginVisualAdjust &&
        !state.postInitialSettleTarget &&
        !state.sharedContainerNeedsStablePass &&
        canUseSharedContainerOrigin(state, numColumns)
    );
}

export function ensureSharedContainerAbsolutePositions(state: InternalState) {
    const sharedContainerAbsolutePositions = state.sharedContainerAbsolutePositions ?? new Map<number, number>();
    state.sharedContainerAbsolutePositions = sharedContainerAbsolutePositions;
    return sharedContainerAbsolutePositions;
}

export function resetSharedContainerOrigin(
    _ctx: StateContext,
    state: InternalState,
    sharedContainerAbsolutePositions = ensureSharedContainerAbsolutePositions(state),
) {
    state.sharedContainerRebasePending = false;
    state.sharedContainerLogicalOriginOffset = 0;
    state.sharedContainerNeedsStablePass = true;
    sharedContainerAbsolutePositions.clear();
}

export function setupSharedOriginPass(params: {
    ctx: StateContext;
    dataChanged?: boolean;
    numColumns: number;
    scrollLength: number;
    scrollState: number;
}): SharedOriginPassSetup {
    const { ctx, dataChanged, numColumns, scrollLength, scrollState } = params;
    const state = ctx.state;
    const canUseSharedOrigin = canUseSharedContainerOrigin(state, numColumns);
    const shouldDeferSharedOriginVisualAdjust =
        shouldUseDeferredSharedOriginVisualAdjust(state, numColumns) && !dataChanged;
    const sharedContainerAbsolutePositions = ensureSharedContainerAbsolutePositions(state);
    const rebaseSharedOriginPass = (reason: SharedOriginFlushReason): SharedOriginPassSetup => {
        const logicalSharedOriginOffsetBefore = state.sharedContainerLogicalOriginOffset ?? 0;
        const pendingSharedOriginOffsetBefore = logicalSharedOriginOffsetBefore;

        resetSharedContainerOrigin(ctx, state, sharedContainerAbsolutePositions);
        if (pendingSharedOriginOffsetBefore !== 0) {
            requestAdjust(ctx, pendingSharedOriginOffsetBefore);
        }

        return {
            canUseSharedOrigin: false,
            logicalSharedOriginOffsetBefore: 0,
            pendingSharedOriginOffsetBefore: 0,
            sharedContainerAbsolutePositions,
            sharedOriginFlushReason: reason,
            shouldDeferSharedOriginVisualAdjust: false,
            shouldSuppressVisualAdjustForPass: false,
        };
    };
    const logicalSharedOriginOffset = state.sharedContainerLogicalOriginOffset ?? 0;
    const hasSharedOriginState = canUseSharedOrigin && (logicalSharedOriginOffset !== 0 || sharedContainerAbsolutePositions.size > 0);

    if (dataChanged && hasSharedOriginState) {
        return rebaseSharedOriginPass("data-change");
    }

    const settleRebasePlan =
        canUseSharedOrigin && state.sharedContainerRebasePending
            ? resolveDeferredGeometryFlushPlan({
                  canUseSharedOrigin,
                  ctx,
                  reason: "settle-rebase",
              })
            : undefined;

    if (settleRebasePlan?.rebaseSharedOrigin) {
        return rebaseSharedOriginPass("settle-rebase");
    }

    if (!canUseSharedOrigin) {
        resetSharedContainerOrigin(ctx, state, sharedContainerAbsolutePositions);
    }

    const logicalSharedOriginOffsetBefore = canUseSharedOrigin ? (state.sharedContainerLogicalOriginOffset ?? 0) : 0;
    const pendingSharedOriginOffsetBefore = logicalSharedOriginOffsetBefore;
    let sharedOriginFlushReason: SharedOriginFlushReason | undefined;

    if (canUseSharedOrigin && pendingSharedOriginOffsetBefore !== 0 && (shouldDeferSharedOriginVisualAdjust || dataChanged)) {
        sharedOriginFlushReason = getSharedOriginFlushReason({
            pendingSharedOriginOffset: pendingSharedOriginOffsetBefore,
            scrollLength,
            scrollState,
        });

        const flushPlan = sharedOriginFlushReason
            ? resolveDeferredGeometryFlushPlan({
                  canUseSharedOrigin,
                  ctx,
                  reason: sharedOriginFlushReason,
              })
            : undefined;

        if (sharedOriginFlushReason && flushPlan?.rebaseSharedOrigin) {
            return rebaseSharedOriginPass(sharedOriginFlushReason);
        }
    }

    return {
        canUseSharedOrigin,
        logicalSharedOriginOffsetBefore,
        pendingSharedOriginOffsetBefore,
        sharedContainerAbsolutePositions,
        sharedOriginFlushReason,
        shouldDeferSharedOriginVisualAdjust,
        shouldSuppressVisualAdjustForPass: shouldDeferSharedOriginVisualAdjust && !sharedOriginFlushReason,
    };
}

export function resolveSharedOriginDelta(deltas: number[]): SharedOriginResolvedDelta | null {
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

export function applySharedOriginDelta(params: {
    canUseSharedOrigin: boolean;
    sharedOriginBefore: number;
    sharedOriginCandidateDeltas: number[];
}): SharedOriginAppliedDelta {
    const { canUseSharedOrigin, sharedOriginBefore, sharedOriginCandidateDeltas } = params;

    if (!canUseSharedOrigin) {
        return {
            appliedSharedOriginOffset: 0,
            pendingSharedOriginOffset: 0,
            sharedOriginDeltaApplied: 0,
            sharedOriginMatchCount: 0,
            sharedOriginOffset: 0,
        };
    }

    let sharedOriginOffset = sharedOriginBefore;
    let sharedOriginDeltaApplied = 0;
    let sharedOriginMatchCount = 0;

    const sharedOriginDelta = resolveSharedOriginDelta(sharedOriginCandidateDeltas);
    if (sharedOriginDelta) {
        sharedOriginOffset += sharedOriginDelta.delta;
        sharedOriginDeltaApplied = sharedOriginDelta.delta;
        sharedOriginMatchCount = sharedOriginDelta.count;
    }

    return {
        appliedSharedOriginOffset: 0,
        pendingSharedOriginOffset: sharedOriginOffset,
        sharedOriginDeltaApplied,
        sharedOriginMatchCount,
        sharedOriginOffset,
    };
}

export function getSharedOriginFlushReason(params: {
    pendingSharedOriginOffset: number;
    scrollLength: number;
    scrollState: number;
}): SharedOriginFlushReason | undefined {
    const { pendingSharedOriginOffset, scrollLength, scrollState } = params;
    const absPendingSharedOriginOffset = Math.abs(pendingSharedOriginOffset);
    const hardCapPx = Math.max(scrollLength, SHARED_ORIGIN_FLUSH_HARD_CAP_PX);
    const relativeCapPx = Math.max(0, scrollState - SHARED_ORIGIN_FLUSH_SAFETY_THRESHOLD_PX);

    if (absPendingSharedOriginOffset >= hardCapPx) {
        return "hard-cap";
    }
    if (absPendingSharedOriginOffset > relativeCapPx) {
        return "top-cap";
    }
    return undefined;
}
