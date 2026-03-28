import type { StateContext } from "@/state/state";
import type { DeferredPositionsState } from "@/types";

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

export function applyDeferredResizeDelta(ctx: StateContext, itemKey: string, diff: number) {
    const deferred = ctx.state.deferredPositions;
    if (!deferred || diff === 0) {
        return false;
    }

    const changedIndex = ctx.state.indexByKey.get(itemKey);
    const anchorIndex = ctx.state.indexByKey.get(deferred.anchorKey);
    if (changedIndex === undefined || anchorIndex === undefined || changedIndex >= anchorIndex) {
        return false;
    }

    deferred.drift += diff;
    deferred.minInvalidatedIndex = Math.min(deferred.minInvalidatedIndex, changedIndex + 1);
    return true;
}

export function getDeferredRenderPosition(ctx: StateContext, index: number) {
    return ctx.state.positions[index];
}

export function flushDeferredPositions(ctx: StateContext, _reason: DeferredPositionsFlushReason) {
    if (!ctx.state.deferredPositions) {
        return false;
    }

    ctx.state.deferredPositions = undefined;
    return true;
}
