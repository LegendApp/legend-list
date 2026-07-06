import { createLayoutEngine } from "@/core/LayoutEngine";
import type { StateContext } from "@/state/state";
import type { InternalState } from "@/types.internal";

export function getLayoutOffset(ctx: StateContext, index: number | undefined, state: InternalState = ctx.state) {
    return createLayoutEngine(ctx, state).getOffset(index);
}

export function getLayoutSize(ctx: StateContext, index: number | undefined, state: InternalState = ctx.state) {
    return createLayoutEngine(ctx, state).getSize(index);
}

export function getLayoutEnd(ctx: StateContext, index: number | undefined, state: InternalState = ctx.state) {
    return createLayoutEngine(ctx, state).getEnd(index);
}

export function getLayoutSnapOffsets(ctx: StateContext, snapToIndices = ctx.state.props.snapToIndices!) {
    return createLayoutEngine(ctx).getSnapOffsets(snapToIndices);
}

export function syncLayoutItemTotalSize(ctx: StateContext) {
    const engine = createLayoutEngine(ctx);
    return engine.kind === "prefix" ? engine.syncTotalSize() : false;
}
