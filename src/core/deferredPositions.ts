import { calculateOffsetWithOffsetPosition } from "@/core/calculateOffsetWithOffsetPosition";
import { clampScrollOffset } from "@/core/clampScrollOffset";
import { scrollTo } from "@/core/scrollTo";
import { updateItemPositions } from "@/core/updateItemPositions";
import { Platform } from "@/platform/Platform";
import { peek$, type StateContext, set$ } from "@/state/state";
import type { DeferredPositionsState } from "@/types";
import type { InternalState } from "@/types.base";
import { checkAllSizesKnown } from "@/utils/checkAllSizesKnown";
import { getId } from "@/utils/getId";
import { getItemSize } from "@/utils/getItemSize";
import { requestAdjust } from "@/utils/requestAdjust";
import { setInitialRenderState } from "@/utils/setInitialRenderState";

// Deferred positions are the only temporary layer above canonical `positions[]`.
// Cleanup work must preserve these contracts:
// 1. `positions[]` stays canonical; deferred state only affects render-time reads until flush.
// 2. There is only one active deferred session, and it keeps a stable anchor until it flushes.
// 3. Exact offset readers may flush, but runtime/deferred compensation must never exist in both
//    deferred state and canonical positions at the same time.
// 4. Published size may differ from exact size only for clamp-sensitive deferred initial-scroll settle.
// 5. Prepend ownership and runtime deferred ownership must not overlap incorrectly mid-transition.
export type DeferredPositionsFlushReason =
    | "anchorInvalid"
    | "dataChange"
    | "exactOffsetRead"
    | "prependSettled"
    | "visibleInteraction"
    | "scrollUnsafe"
    | "settled";

export type DeferredResizeResult = {
    didApplyDeferredResizeDelta: boolean;
    didFlushVisibleInteraction: boolean;
};

export function isDeferredInitialScrollSession(
    deferred: DeferredPositionsState | undefined,
): deferred is DeferredPositionsState & {
    desiredScrollOffset: number;
    kind: "initial_scroll";
} {
    return deferred?.kind === "initial_scroll" && deferred.desiredScrollOffset !== undefined;
}

export function getDeferredPublishedSizeFloor(deferred: DeferredPositionsState | undefined) {
    return deferred?.kind === "initial_scroll" ? deferred.publishedSizeFloor : undefined;
}

export function beginDeferredPositions(ctx: StateContext, params: DeferredPositionsState) {
    const existing = ctx.state.deferredPositions;
    const nextState =
        existing && existing.anchorKey === params.anchorKey
            ? {
                  ...existing,
                  ...params,
                  drift: existing.drift,
                  minInvalidatedIndex: Math.min(existing.minInvalidatedIndex, params.minInvalidatedIndex),
              }
            : { ...params };
    ctx.state.deferredPositions = nextState;
    return nextState;
}

export function isDeferredPositionsActive(state: InternalState) {
    return !!state.userScrollActive || !!state.scrollingTo || !!state.initialScroll;
}

export function getDeferredAnchorIndex(ctx: StateContext) {
    const anchorKey = ctx.state.deferredPositions?.anchorKey;
    return anchorKey ? ctx.state.indexByKey.get(anchorKey) : undefined;
}

export function applyDeferredResizeDelta(ctx: StateContext, itemKey: string, diff: number) {
    const deferred = ctx.state.deferredPositions;
    if (!deferred || diff === 0) {
        return false;
    }

    const changedIndex = ctx.state.indexByKey.get(itemKey);
    const anchorIndex = getDeferredAnchorIndex(ctx);
    if (changedIndex === undefined || anchorIndex === undefined) {
        ctx.state.deferredPositions = undefined;
        return false;
    }

    if (changedIndex >= anchorIndex) {
        return false;
    }

    deferred.drift += diff;
    deferred.minInvalidatedIndex = Math.min(deferred.minInvalidatedIndex, changedIndex + 1);
    return true;
}

export function getDeferredRenderPosition(ctx: StateContext, index: number, cache?: Map<number, number>) {
    const { positions, deferredPositions } = ctx.state;
    if (!deferredPositions) {
        return positions[index];
    }

    const anchorIndex = getDeferredAnchorIndex(ctx);
    if (anchorIndex === undefined) {
        return positions[index];
    }

    if (index === anchorIndex) {
        cache?.set(index, deferredPositions.anchorRenderPosition);
        return deferredPositions.anchorRenderPosition;
    }

    const cached = cache?.get(index);
    if (cached !== undefined) {
        return cached;
    }

    if (index < anchorIndex) {
        let position = deferredPositions.anchorRenderPosition;
        for (let i = anchorIndex - 1; i >= index; i--) {
            const item = ctx.state.props.data[i];
            const id = ctx.state.idCache[i] ?? getId(ctx.state, i);
            if (!item || !id) {
                return positions[index];
            }
            position -= getItemSize(ctx, id, i, item);
            cache?.set(i, position);
        }
        return cache?.get(index) ?? position;
    }

    let position = deferredPositions.anchorRenderPosition;
    for (let i = anchorIndex; i < index; i++) {
        const item = ctx.state.props.data[i];
        const id = ctx.state.idCache[i] ?? getId(ctx.state, i);
        if (!item || !id) {
            return positions[index];
        }
        position += getItemSize(ctx, id, i, item);
        cache?.set(i + 1, position);
    }
    return cache?.get(index) ?? position;
}

function getCompensatedDeferredFlushAmount(ctx: StateContext, drift: number) {
    return Math.max(drift, -ctx.state.scroll);
}

function getDeferredFlushAnchor(
    ctx: StateContext,
    { preferDeferredAnchor = false }: { preferDeferredAnchor?: boolean } = {},
) {
    const state = ctx.state;
    if (preferDeferredAnchor && state.deferredPositions) {
        const anchorIndex = getDeferredAnchorIndex(ctx);
        if (anchorIndex !== undefined) {
            return {
                anchorIndex,
                preFlushRenderedPosition: state.deferredPositions.anchorRenderPosition,
            };
        }
    }
    const candidates = [state.startNoBuffer, state.firstFullyOnScreenIndex];

    for (const anchorIndex of candidates) {
        if (anchorIndex === undefined || anchorIndex === null || anchorIndex < 0) {
            continue;
        }

        const preFlushRenderedPosition = getDeferredRenderPosition(ctx, anchorIndex);
        if (preFlushRenderedPosition === undefined) {
            continue;
        }

        return {
            anchorIndex,
            preFlushRenderedPosition,
        };
    }

    return undefined;
}

function recomputeCanonicalPositionsForDeferredFlush(ctx: StateContext, deferred: DeferredPositionsState) {
    const state = ctx.state;
    state.deferredPositions = undefined;
    state.scrollForNextCalculateItemsInView = undefined;
    updateItemPositions(ctx, undefined, {
        doMVCP: false,
        forceFullUpdate: true,
        scrollBottomBuffered: -1,
        startIndex: Math.max(0, deferred.minInvalidatedIndex),
    });
}

function rebaseDeferredPositionsWithoutRecompute(ctx: StateContext, deferred: DeferredPositionsState) {
    const state = ctx.state;
    const startIndex = Math.max(0, deferred.minInvalidatedIndex);

    if (deferred.drift !== 0) {
        for (let i = startIndex; i < state.positions.length; i++) {
            const position = state.positions[i];
            if (position !== undefined) {
                state.positions[i] = position + deferred.drift;
            }
        }
    }

    state.deferredPositions = undefined;
    state.scrollForNextCalculateItemsInView = undefined;

    if (getDeferredPublishedSizeFloor(deferred) !== undefined) {
        const publishedTotalSize = peek$(ctx, "totalSize");
        if (publishedTotalSize !== state.totalSizeExact) {
            set$(ctx, "totalSize", state.totalSizeExact);
        }
    }
}

export function flushDeferredPositions(ctx: StateContext, reason: DeferredPositionsFlushReason) {
    return flushDeferredPositionsWithCompensation(ctx, reason);
}

export function flushDeferredPositionsForExactRead(ctx: StateContext) {
    flushDeferredPositions(ctx, "exactOffsetRead");
}

export function flushDeferredPositionsWithCompensation(
    ctx: StateContext,
    reason: DeferredPositionsFlushReason,
    compensationOverride?: number,
) {
    const state = ctx.state;
    if (reason === "scrollUnsafe" && state.prependMeasurementWindow?.pendingKeys.size) {
        return false;
    }
    const deferred = state.deferredPositions;
    if (!deferred) {
        return false;
    }
    const drift = deferred.drift;

    if ((reason === "scrollUnsafe" || reason === "visibleInteraction" || reason === "prependSettled") && drift !== 0) {
        const flushAnchor = getDeferredFlushAnchor(ctx, {
            preferDeferredAnchor: reason === "prependSettled",
        });
        recomputeCanonicalPositionsForDeferredFlush(ctx, deferred);
        const exactAdjust =
            flushAnchor !== undefined
                ? (state.positions[flushAnchor.anchorIndex] ?? 0) - flushAnchor.preFlushRenderedPosition
                : undefined;
        const resolvedAdjust =
            compensationOverride ??
            (exactAdjust !== undefined && Number.isFinite(exactAdjust) ? exactAdjust : undefined) ??
            drift;
        const compensatedAdjust = getCompensatedDeferredFlushAmount(ctx, resolvedAdjust);
        if (compensatedAdjust !== 0) {
            requestAdjust(ctx, compensatedAdjust);
        }
        state.triggerCalculateItemsInView?.({ doMVCP: false });
        return true;
    }

    rebaseDeferredPositionsWithoutRecompute(ctx, deferred);
    return true;
}

export function maybeStartPrependMeasurementWindow(
    state: InternalState,
    anchorId: string | undefined,
    anchorRenderPosition: number | undefined,
) {
    if (Platform.OS === "android") {
        state.prependMeasurementWindow = undefined;
        return;
    }

    if (!anchorId || anchorRenderPosition === undefined) {
        state.prependMeasurementWindow = undefined;
        return;
    }

    const previousData = state.previousData;
    const nextData = state.props.data;
    if (!previousData || nextData.length <= previousData.length) {
        state.prependMeasurementWindow = undefined;
        return;
    }

    const prependCount = nextData.length - previousData.length;
    const keyExtractor = state.props.keyExtractor;
    for (let oldIndex = 0; oldIndex < previousData.length; oldIndex++) {
        const newIndex = oldIndex + prependCount;
        const oldKey = keyExtractor ? keyExtractor(previousData[oldIndex], oldIndex) : String(oldIndex);
        const newKey = keyExtractor ? keyExtractor(nextData[newIndex], newIndex) : String(newIndex);
        if (oldKey !== newKey) {
            state.prependMeasurementWindow = undefined;
            return;
        }
    }

    const anchorIndex = state.indexByKey.get(anchorId);
    if (anchorIndex === undefined || anchorIndex <= 0) {
        state.prependMeasurementWindow = undefined;
        return;
    }

    const rangeEnd = Math.min(prependCount, anchorIndex);
    if (rangeEnd <= 0) {
        state.prependMeasurementWindow = undefined;
        return;
    }

    const pendingKeys = new Set<string>();
    let minInvalidatedIndex = Number.POSITIVE_INFINITY;
    for (let index = 0; index < rangeEnd; index++) {
        const key = state.idCache[index] ?? (keyExtractor ? keyExtractor(nextData[index], index) : String(index));
        if (state.sizesKnown.has(key)) {
            continue;
        }
        pendingKeys.add(key);
        minInvalidatedIndex = Math.min(minInvalidatedIndex, index + 1);
    }

    if (!pendingKeys.size) {
        state.prependMeasurementWindow = undefined;
        return;
    }

    const nextWindow = {
        anchorIndex,
        anchorKey: anchorId,
        anchorRenderPosition,
        dataChangeEpoch: state.dataChangeEpoch,
        minInvalidatedIndex,
        pendingKeys,
    };
    const existing = state.prependMeasurementWindow;
    state.prependMeasurementWindow =
        existing && existing.anchorKey === nextWindow.anchorKey
            ? {
                  ...nextWindow,
                  minInvalidatedIndex: Math.min(existing.minInvalidatedIndex, nextWindow.minInvalidatedIndex),
                  pendingKeys: new Set([...existing.pendingKeys, ...nextWindow.pendingKeys]),
              }
            : nextWindow;
}

export function applyDeferredResizeChange(
    ctx: StateContext,
    itemKey: string,
    index: number,
    diff: number,
): DeferredResizeResult {
    const state = ctx.state;
    const hasDeferredInitialScroll = isDeferredInitialScrollSession(state.deferredPositions);
    const allowRuntimeDeferredPositions = Platform.OS !== "android";
    if (!allowRuntimeDeferredPositions && !hasDeferredInitialScroll) {
        state.prependMeasurementWindow = undefined;
    }
    const prependMeasurementWindow = allowRuntimeDeferredPositions ? state.prependMeasurementWindow : undefined;
    const prependAnchorIndex =
        prependMeasurementWindow && state.indexByKey.get(prependMeasurementWindow.anchorKey) !== undefined
            ? state.indexByKey.get(prependMeasurementWindow.anchorKey)!
            : undefined;
    if (
        prependMeasurementWindow &&
        (prependAnchorIndex === undefined || prependMeasurementWindow.pendingKeys.size === 0 || prependAnchorIndex <= 0)
    ) {
        state.prependMeasurementWindow = undefined;
    } else if (prependMeasurementWindow && prependAnchorIndex !== undefined) {
        prependMeasurementWindow.anchorIndex = prependAnchorIndex;
    }
    const activePrependMeasurementWindow = state.prependMeasurementWindow;
    const isTrackedPrependMeasurement =
        !!activePrependMeasurementWindow &&
        activePrependMeasurementWindow.pendingKeys.has(itemKey) &&
        index < activePrependMeasurementWindow.anchorIndex;
    const deferredPositionsActive =
        hasDeferredInitialScroll || (allowRuntimeDeferredPositions && isDeferredPositionsActive(state));
    const firstOnScreenIndex = state.startNoBuffer;
    if (isTrackedPrependMeasurement) {
        let didFlushVisibleInteraction = false;
        let didApplyDeferredResizeDelta = false;
        if (!state.deferredPositions) {
            beginDeferredPositions(ctx, {
                kind: "prepend_measurement",
                anchorKey: activePrependMeasurementWindow.anchorKey,
                anchorRenderPosition: activePrependMeasurementWindow.anchorRenderPosition,
                drift: 0,
                minInvalidatedIndex: activePrependMeasurementWindow.minInvalidatedIndex,
            });
        }
        if (diff !== 0) {
            didApplyDeferredResizeDelta = applyDeferredResizeDelta(ctx, itemKey, diff);
        }
        activePrependMeasurementWindow.pendingKeys.delete(itemKey);
        if (activePrependMeasurementWindow.pendingKeys.size === 0) {
            state.prependMeasurementWindow = undefined;
            if (state.deferredPositions && !hasDeferredInitialScroll) {
                flushDeferredPositionsWithCompensation(ctx, "prependSettled");
                didFlushVisibleInteraction = true;
            }
        }
        return {
            didApplyDeferredResizeDelta,
            didFlushVisibleInteraction,
        };
    }
    if (diff === 0 || !deferredPositionsActive || (peek$(ctx, "numColumns") ?? 1) !== 1) {
        return {
            didApplyDeferredResizeDelta: false,
            didFlushVisibleInteraction: false,
        };
    }

    if (firstOnScreenIndex === null || firstOnScreenIndex === undefined || index >= firstOnScreenIndex) {
        let didFlushVisibleInteraction = false;
        if (state.deferredPositions && !hasDeferredInitialScroll) {
            flushDeferredPositionsWithCompensation(ctx, "visibleInteraction");
            didFlushVisibleInteraction = true;
        }
        return {
            didApplyDeferredResizeDelta: false,
            didFlushVisibleInteraction,
        };
    }

    let anchorIndex = getDeferredAnchorIndex(ctx);
    if (anchorIndex === undefined) {
        anchorIndex = state.firstFullyOnScreenIndex;
        if (anchorIndex === undefined) {
            return {
                didApplyDeferredResizeDelta: false,
                didFlushVisibleInteraction: false,
            };
        }

        const anchorKey = state.idCache[anchorIndex] ?? getId(state, anchorIndex);
        const anchorRenderPosition = state.positions[anchorIndex];
        if (!anchorKey || anchorRenderPosition === undefined) {
            return {
                didApplyDeferredResizeDelta: false,
                didFlushVisibleInteraction: false,
            };
        }

        beginDeferredPositions(ctx, {
            kind: "runtime",
            anchorKey,
            anchorRenderPosition,
            drift: 0,
            minInvalidatedIndex: index + 1,
        });
    }

    const didApply = applyDeferredResizeDelta(ctx, itemKey, diff);
    return {
        didApplyDeferredResizeDelta: didApply,
        didFlushVisibleInteraction: false,
    };
}

export function shouldFlushDeferredPositionsForScroll(ctx: StateContext, scroll: number) {
    const deferred = ctx.state.deferredPositions;
    if (!deferred) {
        return undefined;
    }
    if (getDeferredAnchorIndex(ctx) === undefined) {
        return "anchorInvalid" as const;
    }

    if (ctx.state.prependMeasurementWindow?.pendingKeys.size) {
        return undefined;
    }

    const firstItemRenderPosition = getDeferredRenderPosition(ctx, 0);
    if (firstItemRenderPosition !== undefined && firstItemRenderPosition > scroll) {
        return "scrollUnsafe" as const;
    }

    if (ctx.state.lastScrollDelta < 0 && deferred.drift > 0 && deferred.drift > scroll) {
        return "scrollUnsafe" as const;
    }

    return undefined;
}

export function maybeCompleteDeferredInitialScroll(ctx: StateContext) {
    const state = ctx.state;
    const deferred = state.deferredPositions;
    const desiredScrollOffset = isDeferredInitialScrollSession(deferred) ? deferred.desiredScrollOffset : undefined;
    const initialTarget = state.initialScrollLastTarget ?? state.initialScroll;
    const currentInitialOffset = initialTarget?.pendingContentOffset ?? state.scroll;
    const allSizesKnown = checkAllSizesKnown(state);
    if (
        desiredScrollOffset === undefined ||
        state.scrollingTo?.isInitialScroll ||
        !state.didContainersLayout ||
        !allSizesKnown
    ) {
        return false;
    }

    const settledAdjust = deferred ? getCompensatedDeferredFlushAmount(ctx, deferred.drift) : 0;
    const fallbackSettledDesiredScrollOffset = desiredScrollOffset + settledAdjust;
    flushDeferredPositions(ctx, "settled");

    const exactSettledDesiredScrollOffset =
        initialTarget !== undefined
            ? clampScrollOffset(
                  ctx,
                  state.initialScrollUsesOffset || initialTarget.index === undefined
                      ? (initialTarget.contentOffset ?? fallbackSettledDesiredScrollOffset)
                      : calculateOffsetWithOffsetPosition(
                            ctx,
                            state.positions[initialTarget.index] ?? 0,
                            initialTarget,
                        ),
                  initialTarget,
              )
            : fallbackSettledDesiredScrollOffset;
    const willFinalizeWithoutScroll = Math.abs(currentInitialOffset - exactSettledDesiredScrollOffset) <= 1;

    if (willFinalizeWithoutScroll) {
        state.initialAnchor = undefined;
        state.initialNativeScrollWatchdog = undefined;
        state.initialScroll = undefined;
        state.initialScrollUsesOffset = false;
        state.initialScrollLastTarget = undefined;
        state.initialScrollLastTargetUsesOffset = false;
        setInitialRenderState(ctx, { didInitialScroll: true });
        return true;
    }

    scrollTo(ctx, {
        animated: false,
        forceScroll: true,
        isInitialScroll: true,
        offset: exactSettledDesiredScrollOffset,
        precomputedWithViewOffset: true,
    });
    return true;
}
