import { calculateOffsetWithOffsetPosition } from "@/core/calculateOffsetWithOffsetPosition";
import { clampScrollOffset } from "@/core/clampScrollOffset";
import { scrollTo } from "@/core/scrollTo";
import { updateItemPositions } from "@/core/updateItemPositions";
import type { StateContext } from "@/state/state";
import type { DeferredPositionsState } from "@/types";
import type { InternalState } from "@/types.base";
import { checkAllSizesKnown } from "@/utils/checkAllSizesKnown";
import { getId } from "@/utils/getId";
import { getItemSize } from "@/utils/getItemSize";
import { requestAdjust } from "@/utils/requestAdjust";
import { setInitialRenderState } from "@/utils/setInitialRenderState";

export type DeferredPositionsFlushReason =
    | "anchorInvalid"
    | "dataChange"
    | "exactOffsetRead"
    | "prependSettled"
    | "explicit"
    | "visibleInteraction"
    | "scrollUnsafe"
    | "settled";

export function beginDeferredPositions(ctx: StateContext, params: DeferredPositionsState) {
    const existing = ctx.state.deferredPositions;
    if (existing?.isFinalizing) {
        finalizeDeferredPositions(ctx);
    }
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
    if (!deferred || deferred.isFinalizing || diff === 0) {
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

function commitDeferredPositionsRebase(ctx: StateContext, deferred: DeferredPositionsState) {
    recomputeCanonicalPositionsForDeferredFlush(ctx, deferred);
}

export function flushDeferredPositions(ctx: StateContext, reason: DeferredPositionsFlushReason) {
    return flushDeferredPositionsWithCompensation(ctx, reason);
}

export function finalizeDeferredPositions(
    ctx: StateContext,
    { triggerCalculateItemsInView = false }: { triggerCalculateItemsInView?: boolean } = {},
) {
    const state = ctx.state;
    const deferred = state.deferredPositions;
    if (!deferred?.isFinalizing) {
        return false;
    }

    deferred.finalizeFrameId = undefined;
    commitDeferredPositionsRebase(ctx, deferred);
    if (triggerCalculateItemsInView) {
        state.triggerCalculateItemsInView?.({ doMVCP: false });
    }
    return true;
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
    const existingDeferred = state.deferredPositions;
    if (existingDeferred?.isFinalizing) {
        finalizeDeferredPositions(ctx);
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
        commitDeferredPositionsRebase(ctx, deferred);
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

    commitDeferredPositionsRebase(ctx, deferred);
    return true;
}

export function shouldFlushDeferredPositionsForScroll(ctx: StateContext, scroll: number) {
    const deferred = ctx.state.deferredPositions;
    if (!deferred) {
        return undefined;
    }
    if (deferred.isFinalizing) {
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
    const desiredScrollOffset = deferred?.desiredScrollOffset;
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
