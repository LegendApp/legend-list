import type { StateContext } from "@/state/state";
import type { DeferredPositionsState } from "@/types";
import { getId } from "@/utils/getId";
import { getItemSize } from "@/utils/getItemSize";

export type DeferredPositionsFlushReason =
    | "anchorInvalid"
    | "dataChange"
    | "exactOffsetRead"
    | "explicit"
    | "scrollUnsafe"
    | "settled";

export function beginDeferredPositions(ctx: StateContext, params: DeferredPositionsState) {
    ctx.state.deferredPositions = { ...params };
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
    if (!ctx.state.deferredPositions) {
        return false;
    }

    ctx.state.deferredPositions = undefined;
    return true;
}
