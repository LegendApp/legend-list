import { INTERNAL_PERF_CONFIG } from "@/core/internalPerfConfig";
import { Platform } from "@/platform/Platform";
import { peek$, type StateContext, set$ } from "@/state/state";
import type { InternalState } from "@/types.base";
import { requestAdjust } from "@/utils/requestAdjust";

type SharedOriginPlatformPolicy = {
    allowDeferredVisualAdjust: boolean;
    enabled: boolean;
};

export type SharedOriginFlushReason = "data-change" | "direction-change" | "hard-cap" | "momentum-end" | "top-cap";
export type SharedOriginResolvedDelta = { count: number; delta: number };
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

const SHARED_ORIGIN_PLATFORM_POLICY: Record<string, SharedOriginPlatformPolicy> = {
    android: {
        allowDeferredVisualAdjust: true,
        enabled: true,
    },
    ios: {
        allowDeferredVisualAdjust: true,
        enabled: true,
    },
    web: {
        allowDeferredVisualAdjust: true,
        enabled: true,
    },
};

const DEFAULT_SHARED_ORIGIN_PLATFORM_POLICY: SharedOriginPlatformPolicy = {
    allowDeferredVisualAdjust: false,
    enabled: false,
};

const SHARED_ORIGIN_FLUSH_HARD_CAP_PX = 800;
const SHARED_ORIGIN_FLUSH_SAFETY_THRESHOLD_PX = 400;

export function getSharedOriginPlatformPolicy(platform = Platform.OS): SharedOriginPlatformPolicy {
    return SHARED_ORIGIN_PLATFORM_POLICY[platform] ?? DEFAULT_SHARED_ORIGIN_PLATFORM_POLICY;
}

export function canUseSharedContainerOrigin(state: InternalState, numColumns: number) {
    const { enabled } = getSharedOriginPlatformPolicy();
    const isInitialScrollActive = !!state.initialScroll || !state.didFinishInitialScroll;
    const isImperativeScrollActive = !!state.scrollingTo;
    const canUse =
        enabled &&
        !isInitialScrollActive &&
        !isImperativeScrollActive &&
        !state.props.horizontal &&
        numColumns === 1 &&
        state.props.stickyIndicesArr.length === 0;

    if (INTERNAL_PERF_CONFIG.log && state.scrollingTo) {
        console.log(
            "[legend-list][perf]",
            JSON.stringify({
                canUseSharedOrigin: canUse,
                didFinishInitialScroll: state.didFinishInitialScroll,
                enabled,
                event: "shared-origin-gate",
                horizontal: !!state.props.horizontal,
                initialScroll: !!state.initialScroll,
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

    return canUse;
}

export function shouldUseDeferredSharedOriginVisualAdjust(state: InternalState, numColumns: number) {
    const { allowDeferredVisualAdjust } = getSharedOriginPlatformPolicy();
    return allowDeferredVisualAdjust && canUseSharedContainerOrigin(state, numColumns);
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
    state.sharedContainerFlushPending = false;
    state.sharedContainerLastScrollDirection = 0;
    state.sharedContainerLogicalOriginOffset = 0;
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

        if (sharedOriginFlushReason) {
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
