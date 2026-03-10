import { resolveDeferredGeometryFlushPlan } from "@/core/deferredGeometryFlush";
import { INTERNAL_PERF_CONFIG } from "@/core/internalPerfConfig";
import { peek$, type StateContext, set$ } from "@/state/state";
import type { InternalState } from "@/types.base";
import { requestAdjust } from "@/utils/requestAdjust";

export type SharedOriginFlushReason =
    | "data-change"
    | "direction-change"
    | "hard-cap"
    | "momentum-end"
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
    appliedSharedOriginOffsetBefore: number;
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
                sharedOriginEnabled,
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
    ctx: StateContext,
    state: InternalState,
    sharedContainerAbsolutePositions = ensureSharedContainerAbsolutePositions(state),
) {
    if (peek$(ctx, "containerOriginOffset") !== 0) {
        set$(ctx, "containerOriginOffset", 0);
    }
    state.sharedContainerRebasePending = false;
    state.sharedContainerFlushPending = false;
    state.sharedContainerLastScrollDirection = 0;
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

    const settleRebasePlan =
        canUseSharedOrigin && state.sharedContainerRebasePending
            ? resolveDeferredGeometryFlushPlan({
                  canUseSharedOrigin,
                  ctx,
                  reason: "settle-rebase",
              })
            : undefined;

    if (settleRebasePlan?.rebaseSharedOrigin) {
        const appliedSharedOriginOffsetBefore = peek$(ctx, "containerOriginOffset") ?? 0;
        const logicalSharedOriginOffsetBefore =
            state.sharedContainerLogicalOriginOffset ?? appliedSharedOriginOffsetBefore;
        const pendingSharedOriginOffsetBefore =
            logicalSharedOriginOffsetBefore - appliedSharedOriginOffsetBefore;

        resetSharedContainerOrigin(ctx, state, sharedContainerAbsolutePositions);
        if (pendingSharedOriginOffsetBefore !== 0) {
            requestAdjust(ctx, pendingSharedOriginOffsetBefore);
        }

        return {
            appliedSharedOriginOffsetBefore: 0,
            canUseSharedOrigin: false,
            logicalSharedOriginOffsetBefore: 0,
            pendingSharedOriginOffsetBefore: 0,
            sharedContainerAbsolutePositions,
            sharedOriginFlushReason: "settle-rebase",
            shouldDeferSharedOriginVisualAdjust: false,
            shouldSuppressVisualAdjustForPass: false,
        };
    }

    if (!canUseSharedOrigin) {
        resetSharedContainerOrigin(ctx, state, sharedContainerAbsolutePositions);
    }

    let appliedSharedOriginOffsetBefore = canUseSharedOrigin ? (peek$(ctx, "containerOriginOffset") ?? 0) : 0;
    const logicalSharedOriginOffsetBefore = canUseSharedOrigin
        ? (state.sharedContainerLogicalOriginOffset ?? appliedSharedOriginOffsetBefore)
        : 0;
    let pendingSharedOriginOffsetBefore = logicalSharedOriginOffsetBefore - appliedSharedOriginOffsetBefore;
    let sharedOriginFlushAdjust = 0;
    let sharedOriginFlushReason: SharedOriginFlushReason | undefined;

    if (canUseSharedOrigin && shouldDeferSharedOriginVisualAdjust && pendingSharedOriginOffsetBefore !== 0) {
        sharedOriginFlushReason = getSharedOriginFlushReason({
            dataChanged,
            pendingSharedOriginOffset: pendingSharedOriginOffsetBefore,
            scrollLength,
            scrollState,
            state,
        });

        const flushPlan = sharedOriginFlushReason
            ? resolveDeferredGeometryFlushPlan({
                  canUseSharedOrigin,
                  ctx,
                  reason: sharedOriginFlushReason,
              })
            : undefined;

        if (sharedOriginFlushReason && flushPlan?.shouldFlushSharedOrigin) {
            sharedOriginFlushAdjust = logicalSharedOriginOffsetBefore - appliedSharedOriginOffsetBefore;
            appliedSharedOriginOffsetBefore = logicalSharedOriginOffsetBefore;
            pendingSharedOriginOffsetBefore = 0;
            state.sharedContainerFlushPending = false;
            set$(ctx, "containerOriginOffset", appliedSharedOriginOffsetBefore);
            if (sharedOriginFlushAdjust !== 0) {
                requestAdjust(ctx, sharedOriginFlushAdjust);
            }
        }
    }

    return {
        appliedSharedOriginOffsetBefore,
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
    ctx: StateContext;
    appliedSharedOriginOffsetBefore: number;
    canUseSharedOrigin: boolean;
    sharedOriginBefore: number;
    sharedOriginCandidateDeltas: number[];
    shouldSuppressVisualAdjustForPass: boolean;
}): SharedOriginAppliedDelta {
    const {
        ctx,
        appliedSharedOriginOffsetBefore,
        canUseSharedOrigin,
        sharedOriginBefore,
        sharedOriginCandidateDeltas,
        shouldSuppressVisualAdjustForPass,
    } = params;

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

    ctx.state.sharedContainerLogicalOriginOffset = sharedOriginOffset;
    if (!shouldSuppressVisualAdjustForPass && sharedOriginOffset !== sharedOriginBefore) {
        set$(ctx, "containerOriginOffset", sharedOriginOffset);
    }

    const appliedSharedOriginOffset = shouldSuppressVisualAdjustForPass
        ? appliedSharedOriginOffsetBefore
        : sharedOriginOffset;

    return {
        appliedSharedOriginOffset,
        pendingSharedOriginOffset: sharedOriginOffset - appliedSharedOriginOffset,
        sharedOriginDeltaApplied,
        sharedOriginMatchCount,
        sharedOriginOffset,
    };
}

export function getSharedOriginFlushReason(params: {
    dataChanged?: boolean;
    pendingSharedOriginOffset: number;
    scrollLength: number;
    scrollState: number;
    state: InternalState;
}): SharedOriginFlushReason | undefined {
    const { dataChanged, pendingSharedOriginOffset, scrollLength, scrollState, state } = params;
    const currentScrollDirection = Math.sign(scrollState - state.scrollPrev);
    const previousScrollDirection = state.sharedContainerLastScrollDirection ?? 0;
    const didDirectionChange =
        currentScrollDirection !== 0 &&
        previousScrollDirection !== 0 &&
        currentScrollDirection !== previousScrollDirection;

    if (currentScrollDirection !== 0) {
        state.sharedContainerLastScrollDirection = currentScrollDirection;
    }

    const absPendingSharedOriginOffset = Math.abs(pendingSharedOriginOffset);
    const hardCapPx = Math.max(scrollLength, SHARED_ORIGIN_FLUSH_HARD_CAP_PX);
    const relativeCapPx = Math.max(0, scrollState - SHARED_ORIGIN_FLUSH_SAFETY_THRESHOLD_PX);

    if (state.sharedContainerFlushPending) {
        return "momentum-end";
    }
    if (dataChanged) {
        return "data-change";
    }
    if (didDirectionChange) {
        return "direction-change";
    }
    if (absPendingSharedOriginOffset >= hardCapPx) {
        return "hard-cap";
    }
    if (absPendingSharedOriginOffset > relativeCapPx) {
        return "top-cap";
    }
    return undefined;
}
