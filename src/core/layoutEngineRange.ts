import type { LayoutEngine } from "@/core/LayoutEngine";
import { materializePrefixLayoutStoreRange } from "@/core/prefixLayoutStoreLifecycle";
import type { StateContext } from "@/state/state";

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
    const dataLength = ctx.state.props.data.length;
    const start = Math.max(0, Math.trunc(startIndex));
    const end = Math.min(dataLength - 1, Math.trunc(endIndex));
    let range: LayoutEngineRange | undefined;

    if (engine.kind === "prefix" && start <= end) {
        range = materializePrefixLayoutStoreRange(ctx, start, end);
    }

    return range;
}
