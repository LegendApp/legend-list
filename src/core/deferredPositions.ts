import { notifyPosition$, set$, type StateContext } from "@/state/state";
import type { DeferredPositionsState } from "@/types";
import { scrollTo } from "@/core/scrollTo";
import { getId } from "@/utils/getId";
import { getItemSize } from "@/utils/getItemSize";
import { checkAllSizesKnown } from "@/utils/checkAllSizesKnown";
import { setInitialRenderState } from "@/utils/setInitialRenderState";

export type DeferredPositionsFlushReason =
    | "anchorInvalid"
    | "dataChange"
    | "exactOffsetRead"
    | "explicit"
    | "scrollUnsafe"
    | "settled";

export function beginDeferredPositions(ctx: StateContext, params: DeferredPositionsState) {
    const existing = ctx.state.deferredPositions;
    ctx.state.deferredPositions =
        existing && existing.anchorKey === params.anchorKey
            ? {
                  ...existing,
                  ...params,
                  drift: existing.drift,
                  minInvalidatedIndex: Math.min(existing.minInvalidatedIndex, params.minInvalidatedIndex),
              }
            : { ...params };
    return ctx.state.deferredPositions;
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

export function getDeferredRenderPosition(
    ctx: StateContext,
    index: number,
    cache?: Map<number, number>,
) {
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

    if (index < deferredPositions.minInvalidatedIndex && index < anchorIndex) {
        return positions[index];
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

export function flushDeferredPositions(ctx: StateContext, _reason: DeferredPositionsFlushReason) {
    const state = ctx.state;
    const deferred = state.deferredPositions;
    if (!deferred) {
        return false;
    }

    if (deferred.drift !== 0) {
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

    if (deferred.publishedSizeFloor !== undefined) {
        set$(ctx, "totalSize", state.totalSizeExact);
    }

    state.deferredPositions = undefined;
    state.scrollForNextCalculateItemsInView = undefined;
    return true;
}

export function shouldFlushDeferredPositionsForScroll(ctx: StateContext, scroll: number) {
    const deferred = ctx.state.deferredPositions;
    if (!deferred) {
        return undefined;
    }

    if (getDeferredAnchorIndex(ctx) === undefined) {
        return "anchorInvalid" as const;
    }

    if (ctx.state.lastScrollDelta < 0 && deferred.drift > 0 && deferred.drift > scroll) {
        return "scrollUnsafe" as const;
    }

    return undefined;
}

export function maybeCompleteDeferredInitialScroll(ctx: StateContext) {
    const state = ctx.state;
    const desiredScrollOffset = state.deferredPositions?.desiredScrollOffset;
    if (
        desiredScrollOffset === undefined ||
        state.scrollingTo?.isInitialScroll ||
        !state.didContainersLayout ||
        !checkAllSizesKnown(state)
    ) {
        return false;
    }

    flushDeferredPositions(ctx, "settled");

    if (Math.abs(state.scroll - desiredScrollOffset) <= 1) {
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
        offset: desiredScrollOffset,
        precomputedWithViewOffset: true,
    });
    return true;
}
