import { finishInitialScrollWithoutScroll } from "@/components/initialScroll";
import { calculateOffsetWithOffsetPosition } from "@/core/calculateOffsetWithOffsetPosition";
import { clampScrollOffset } from "@/core/clampScrollOffset";
import { requestAdjust } from "@/utils/requestAdjust";
import { scrollTo } from "@/core/scrollTo";
import { updateItemPositions } from "@/core/updateItemPositions";
import { Platform } from "@/platform/Platform";
import { notifyPosition$, peek$, type StateContext, set$ } from "@/state/state";
import type { DeferredPositionsState } from "@/types";
import type { InternalState } from "@/types.base";
import { checkAllSizesKnown } from "@/utils/checkAllSizesKnown";
import { getId } from "@/utils/getId";
import { getItemSize } from "@/utils/getItemSize";

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

const NO_DEFERRED_RESIZE_RESULT: DeferredResizeResult = {
    didApplyDeferredResizeDelta: false,
    didFlushVisibleInteraction: false,
};

function debugInitialEnd(event: string, payload: Record<string, unknown>) {
    if (Platform.OS !== "web") {
        return;
    }

    const debugState = ((globalThis as any).__legendInitialEndDebug ??= { seq: 0 }) as { seq: number };
    console.log(`${Date.now()} [debug-log bidirectional-initial-end initial-end-v2] ${event}`, {
        seq: ++debugState.seq,
        ...payload,
    });
}

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
                  firstItemRenderPosition: existing.firstItemRenderPosition,
                  minInvalidatedIndex: Math.min(existing.minInvalidatedIndex, params.minInvalidatedIndex),
              }
            : {
                  ...params,
                  firstItemRenderPosition: params.firstItemRenderPosition ?? ctx.state.positions[0] ?? 0,
              };
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

    if (changedIndex === anchorIndex) {
        if (isDeferredInitialScrollSession(deferred)) {
            const initialTarget = ctx.state.initialScrollLastTarget ?? ctx.state.initialScroll;
            const viewPosition = initialTarget?.viewPosition ?? 0;
            const anchorShift = -diff * viewPosition;
            if (anchorShift !== 0) {
                debugInitialEnd("deferred-anchor-resize", {
                    anchorRenderPosition: deferred.anchorRenderPosition,
                    anchorShift,
                    changedIndex,
                    diff,
                    itemKey,
                    viewPosition,
                });
                deferred.anchorRenderPosition += anchorShift;
                deferred.firstItemRenderPosition =
                    (deferred.firstItemRenderPosition ?? ctx.state.positions[0] ?? 0) + anchorShift;
                return true;
            }
        }
        return false;
    }

    if (changedIndex >= anchorIndex) {
        return false;
    }

    deferred.drift += diff;
    deferred.firstItemRenderPosition = (deferred.firstItemRenderPosition ?? ctx.state.positions[0] ?? 0) - diff;
    deferred.minInvalidatedIndex = Math.min(deferred.minInvalidatedIndex, changedIndex + 1);
    if (isDeferredInitialScrollSession(deferred)) {
        debugInitialEnd("deferred-pre-anchor-resize", {
            anchorIndex,
            changedIndex,
            diff,
            drift: deferred.drift,
            itemKey,
            minInvalidatedIndex: deferred.minInvalidatedIndex,
        });
    }
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
    const previousTotalSizeExact = state.totalSizeExact;
    state.deferredPositions = undefined;
    state.scrollForNextCalculateItemsInView = undefined;
    updateItemPositions(ctx, undefined, {
        doMVCP: false,
        forceFullUpdate: true,
        scrollBottomBuffered: -1,
        startIndex: Math.max(0, deferred.minInvalidatedIndex),
    });

    if (!Number.isFinite(state.totalSizeExact) && Number.isFinite(previousTotalSizeExact)) {
        state.totalSizeExact = previousTotalSizeExact;
    }

    if (getDeferredPublishedSizeFloor(deferred) !== undefined) {
        const publishedTotalSize = peek$(ctx, "totalSize");
        if (publishedTotalSize !== state.totalSizeExact) {
            set$(ctx, "totalSize", state.totalSizeExact);
        }
    }
}

function materializeDeferredDrift(ctx: StateContext, deferred: DeferredPositionsState) {
    if (deferred.drift === 0) {
        return;
    }

    const state = ctx.state;
    const end = Math.min(state.props.data.length, state.positions.length);
    const hasPositionListeners = ctx.positionListeners.size > 0;

    for (let i = deferred.minInvalidatedIndex; i < end; i++) {
        const position = state.positions[i];
        if (position === undefined) {
            continue;
        }

        const nextPosition = position + deferred.drift;
        state.positions[i] = nextPosition;

        if (hasPositionListeners) {
            const id = state.idCache[i] ?? getId(state, i);
            if (id) {
                notifyPosition$(ctx, id, nextPosition);
            }
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
    const activeDeferred = deferred!;

    if (reason === "exactOffsetRead") {
        materializeDeferredDrift(ctx, activeDeferred);
        if (getDeferredPublishedSizeFloor(activeDeferred) !== undefined) {
            const publishedTotalSize = peek$(ctx, "totalSize");
            if (publishedTotalSize !== state.totalSizeExact) {
                set$(ctx, "totalSize", state.totalSizeExact);
            }
        }
        state.deferredPositions = undefined;
        state.scrollForNextCalculateItemsInView = undefined;
        return true;
    }

    const drift = activeDeferred.drift;

    if ((reason === "scrollUnsafe" || reason === "visibleInteraction" || reason === "prependSettled") && drift !== 0) {
        const flushAnchor = getDeferredFlushAnchor(ctx, {
            preferDeferredAnchor: reason === "prependSettled",
        });
        recomputeCanonicalPositionsForDeferredFlush(ctx, activeDeferred);
        let exactAdjust: number | undefined;
        if (flushAnchor === undefined) {
            exactAdjust = undefined;
        } else {
            const activeFlushAnchor = flushAnchor!;
            exactAdjust =
                (state.positions[activeFlushAnchor.anchorIndex] ?? 0) - activeFlushAnchor.preFlushRenderedPosition;
        }
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

    recomputeCanonicalPositionsForDeferredFlush(ctx, activeDeferred);
    return true;
}

export function maybeStartPrependMeasurementWindow(
    state: InternalState,
    anchorId: string | undefined,
    anchorRenderPosition: number | undefined,
) {
    if (Platform.OS === "android" || !state.props.enableDeferredOptimization) {
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

function getActivePrependMeasurementWindow(
    state: InternalState,
    {
        allowRuntimeDeferredPositions,
        hasDeferredInitialScroll,
    }: {
        allowRuntimeDeferredPositions: boolean;
        hasDeferredInitialScroll: boolean;
    },
) {
    if (!allowRuntimeDeferredPositions && !hasDeferredInitialScroll) {
        state.prependMeasurementWindow = undefined;
    }
    const prependMeasurementWindow = allowRuntimeDeferredPositions ? state.prependMeasurementWindow : undefined;
    if (!prependMeasurementWindow) {
        return undefined;
    }

    const prependAnchorIndex = state.indexByKey.get(prependMeasurementWindow.anchorKey);
    if (
        prependAnchorIndex === undefined ||
        prependMeasurementWindow.pendingKeys.size === 0 ||
        prependAnchorIndex <= 0
    ) {
        state.prependMeasurementWindow = undefined;
        return undefined;
    }

    prependMeasurementWindow.anchorIndex = prependAnchorIndex;
    return prependMeasurementWindow;
}

function handlePrependMeasurementResizeChange(
    ctx: StateContext,
    itemKey: string,
    index: number,
    diff: number,
    {
        hasDeferredInitialScroll,
        prependMeasurementWindow,
    }: {
        hasDeferredInitialScroll: boolean;
        prependMeasurementWindow: NonNullable<InternalState["prependMeasurementWindow"]>;
    },
): DeferredResizeResult | undefined {
    if (!prependMeasurementWindow.pendingKeys.has(itemKey) || index >= prependMeasurementWindow.anchorIndex) {
        return undefined;
    }

    const state = ctx.state;
    let didFlushVisibleInteraction = false;
    let didApplyDeferredResizeDelta = false;
    if (!state.deferredPositions) {
        beginDeferredPositions(ctx, {
            anchorKey: prependMeasurementWindow.anchorKey,
            anchorRenderPosition: prependMeasurementWindow.anchorRenderPosition,
            drift: 0,
            kind: "prepend_measurement",
            minInvalidatedIndex: prependMeasurementWindow.minInvalidatedIndex,
        });
    }
    if (diff !== 0) {
        didApplyDeferredResizeDelta = applyDeferredResizeDelta(ctx, itemKey, diff);
    }
    prependMeasurementWindow.pendingKeys.delete(itemKey);
    if (prependMeasurementWindow.pendingKeys.size === 0) {
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

function handleRuntimeDeferredResizeChange(
    ctx: StateContext,
    itemKey: string,
    index: number,
    diff: number,
    {
        allowRuntimeDeferredPositions,
        hasDeferredInitialScroll,
    }: {
        allowRuntimeDeferredPositions: boolean;
        hasDeferredInitialScroll: boolean;
    },
): DeferredResizeResult {
    const state = ctx.state;
    const deferredPositionsActive =
        hasDeferredInitialScroll || (allowRuntimeDeferredPositions && isDeferredPositionsActive(state));
    if (diff === 0 || !deferredPositionsActive || (peek$(ctx, "numColumns") ?? 1) !== 1) {
        return NO_DEFERRED_RESIZE_RESULT;
    }

    if (hasDeferredInitialScroll) {
        const didApply = applyDeferredResizeDelta(ctx, itemKey, diff);
        return {
            didApplyDeferredResizeDelta: didApply,
            didFlushVisibleInteraction: false,
        };
    }

    const firstOnScreenIndex = state.startNoBuffer;
    if (firstOnScreenIndex === null || firstOnScreenIndex === undefined || index >= firstOnScreenIndex) {
        let didFlushVisibleInteraction = false;
        if (state.deferredPositions && !hasDeferredInitialScroll) {
            flushDeferredPositionsWithCompensation(ctx, "visibleInteraction");
            didFlushVisibleInteraction = true;
        }
        return { ...NO_DEFERRED_RESIZE_RESULT, didFlushVisibleInteraction };
    }

    let anchorIndex = getDeferredAnchorIndex(ctx);
    if (anchorIndex === undefined) {
        anchorIndex = state.firstFullyOnScreenIndex;
        if (anchorIndex === undefined) {
            return NO_DEFERRED_RESIZE_RESULT;
        }

        const anchorKey = state.idCache[anchorIndex] ?? getId(state, anchorIndex);
        const anchorRenderPosition = state.positions[anchorIndex];
        if (!anchorKey || anchorRenderPosition === undefined) {
            return NO_DEFERRED_RESIZE_RESULT;
        }

        beginDeferredPositions(ctx, {
            anchorKey,
            anchorRenderPosition,
            drift: 0,
            kind: "runtime",
            minInvalidatedIndex: index + 1,
        });
    }

    const didApply = applyDeferredResizeDelta(ctx, itemKey, diff);
    return {
        didApplyDeferredResizeDelta: didApply,
        didFlushVisibleInteraction: false,
    };
}

export function applyDeferredResizeChange(
    ctx: StateContext,
    itemKey: string,
    index: number,
    diff: number,
): DeferredResizeResult {
    const state = ctx.state;
    const hasDeferredInitialScroll = isDeferredInitialScrollSession(state.deferredPositions);
    const allowRuntimeDeferredPositions = state.props.enableDeferredOptimization && Platform.OS !== "android";
    const prependMeasurementWindow = getActivePrependMeasurementWindow(state, {
        allowRuntimeDeferredPositions,
        hasDeferredInitialScroll,
    });
    const prependResult = prependMeasurementWindow
        ? handlePrependMeasurementResizeChange(ctx, itemKey, index, diff, {
              hasDeferredInitialScroll,
              prependMeasurementWindow,
          })
        : undefined;
    if (prependResult) {
        return prependResult;
    }

    return handleRuntimeDeferredResizeChange(ctx, itemKey, index, diff, {
        allowRuntimeDeferredPositions,
        hasDeferredInitialScroll,
    });
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

    const firstItemRenderPosition =
        deferred.firstItemRenderPosition ?? getDeferredRenderPosition(ctx, 0) ?? ctx.state.positions[0] ?? 0;
    if (firstItemRenderPosition > scroll) {
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
    const pendingInitialOffset = initialTarget?.pendingContentOffset ?? state.scroll;
    const allSizesKnown = checkAllSizesKnown(state);
    if (
        desiredScrollOffset === undefined ||
        state.scrollingTo?.isInitialScroll ||
        !state.didContainersLayout ||
        !allSizesKnown
    ) {
        if (desiredScrollOffset !== undefined) {
            debugInitialEnd("settle-blocked", {
                allSizesKnown,
                desiredScrollOffset,
                didContainersLayout: state.didContainersLayout,
                pendingInitialOffset,
                scroll: state.scroll,
                scrollingTo: state.scrollingTo
                    ? {
                          isInitialScroll: state.scrollingTo.isInitialScroll,
                          offset: state.scrollingTo.offset,
                          targetOffset: state.scrollingTo.targetOffset,
                      }
                    : undefined,
            });
        }
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
    const willFinalizeWithoutScroll =
        Math.abs(state.scroll - exactSettledDesiredScrollOffset) <= 1 ||
        Math.abs(pendingInitialOffset - exactSettledDesiredScrollOffset) <= 1;

    debugInitialEnd("settle-result", {
        desiredScrollOffset,
        exactSettledDesiredScrollOffset,
        fallbackSettledDesiredScrollOffset,
        pendingInitialOffset,
        scroll: state.scroll,
        willFinalizeWithoutScroll,
    });

    if (willFinalizeWithoutScroll) {
        state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
        finishInitialScrollWithoutScroll(ctx);
        return true;
    }

    if (Platform.OS === "web") {
        const settledAdjust = exactSettledDesiredScrollOffset - state.scroll;
        debugInitialEnd("settle-adjust", {
            offset: exactSettledDesiredScrollOffset,
            scroll: state.scroll,
            settledAdjust,
        });
        requestAdjust(ctx, settledAdjust);
        const readyToRender = peek$(ctx, "readyToRender");
        if (!readyToRender) {
            requestAnimationFrame(() => {
                state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
                finishInitialScrollWithoutScroll(ctx);
            });
        } else {
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
            finishInitialScrollWithoutScroll(ctx);
        }
        return true;
    }

    debugInitialEnd("settle-scroll", {
        offset: exactSettledDesiredScrollOffset,
        pendingInitialOffset,
        scroll: state.scroll,
    });
    scrollTo(ctx, {
        animated: false,
        forceScroll: true,
        isInitialScroll: true,
        offset: exactSettledDesiredScrollOffset,
        precomputedWithViewOffset: true,
    });
    return true;
}
