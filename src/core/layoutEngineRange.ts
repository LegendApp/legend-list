import type { LayoutEngine } from "@/core/LayoutEngine";
import { notifyPosition$, type StateContext } from "@/state/state";
import { getId } from "@/utils/getId";

export interface LayoutEngineRange {
    end: number;
    start: number;
}

export function reconcileLayoutEngineOffsetRange(
    ctx: StateContext,
    engine: LayoutEngine,
    startOffset: number,
    endOffset: number,
) {
    const dataLength = ctx.state.props.data.length;
    let range: LayoutEngineRange | undefined;

    if (engine.kind === "prefix" && dataLength > 0) {
        const start = engine.findIndexAtOffset(startOffset) ?? dataLength - 1;
        const end = engine.findIndexAtOffset(endOffset) ?? dataLength - 1;
        range = reconcileLayoutEngineRange(ctx, engine, start, Math.max(start, end));
    }

    return range;
}

export function reconcileLayoutEngineRange(
    ctx: StateContext,
    engine: LayoutEngine,
    startIndex: number,
    endIndex: number,
) {
    const state = ctx.state;
    const dataLength = state.props.data.length;
    const start = Math.max(0, Math.trunc(startIndex));
    const end = Math.min(dataLength - 1, Math.trunc(endIndex));
    let range: LayoutEngineRange | undefined;

    if (engine.kind === "prefix" && start <= end) {
        for (let index = start; index <= end; index++) {
            const id = state.idCache[index] ?? getId(state, index);
            const size = engine.getSize(index);
            const offset = engine.getOffset(index);
            state.indexByKey.set(id, index);
            if (size !== undefined) {
                state.sizes.set(id, size);
            }
            if (offset !== undefined && ctx.positionListeners.has(id)) {
                notifyLayoutEnginePosition(ctx, id, offset);
            }
        }

        range = { end, start };
    }

    return range;
}

function notifyLayoutEnginePosition(ctx: StateContext, key: string, offset: number) {
    const state = ctx.state;
    let offsets = state.layoutStorePositionListenerOffsets;
    if (!offsets) {
        offsets = new Map();
        state.layoutStorePositionListenerOffsets = offsets;
    }
    if (offsets.get(key) !== offset) {
        offsets.set(key, offset);
        notifyPosition$(ctx, key, offset);
    }
}
