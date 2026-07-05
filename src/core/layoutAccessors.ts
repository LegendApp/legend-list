import { createLayoutEngine } from "@/core/LayoutEngine";
import { reconcileLayoutEngineOffsetRange, reconcileLayoutEngineRange } from "@/core/layoutEngineRange";
import { setSize } from "@/core/setSize";
import { getContentSize } from "@/state/getContentSize";
import type { StateContext } from "@/state/state";
import type { InternalState } from "@/types.internal";

export interface MaterializedLayoutRange {
    end: number;
    start: number;
}

export function getLayoutOffset(ctx: StateContext, index: number | undefined, state: InternalState = ctx.state) {
    return createLayoutEngine(ctx, state).getOffset(index);
}

export function getLayoutSize(ctx: StateContext, index: number | undefined, state: InternalState = ctx.state) {
    return createLayoutEngine(ctx, state).getSize(index);
}

export function getLayoutEnd(ctx: StateContext, index: number | undefined, state: InternalState = ctx.state) {
    return createLayoutEngine(ctx, state).getEnd(index);
}

export function getLayoutItemTotalSize(ctx: StateContext, state: InternalState = ctx.state) {
    return createLayoutEngine(ctx, state).getTotalSize();
}

export function getLayoutContentSize(ctx: StateContext) {
    return getContentSize(ctx);
}

export function getLayoutSnapOffsets(ctx: StateContext, snapToIndices = ctx.state.props.snapToIndices!) {
    return createLayoutEngine(ctx).getSnapOffsets(snapToIndices);
}

export function materializeLayoutOffsetRange(ctx: StateContext, startOffset: number, endOffset: number) {
    return reconcileLayoutEngineOffsetRange(ctx, createLayoutEngine(ctx), startOffset, endOffset);
}

export function materializeLayoutRange(ctx: StateContext, startIndex: number, endIndex: number) {
    return reconcileLayoutEngineRange(ctx, createLayoutEngine(ctx), startIndex, endIndex);
}

export function recordLayoutMeasuredSize(ctx: StateContext, index: number | undefined, key: string, size: number) {
    const engine = createLayoutEngine(ctx);
    let didUsePrefixStore = false;

    if (engine.kind === "prefix" && engine.recordMeasuredSize(index, key, size)) {
        didUsePrefixStore = true;
    } else {
        setSize(ctx, key, size);
    }

    return didUsePrefixStore;
}

export function syncLayoutItemTotalSize(ctx: StateContext) {
    const engine = createLayoutEngine(ctx);
    return engine.kind === "prefix" ? engine.syncTotalSize() : false;
}
