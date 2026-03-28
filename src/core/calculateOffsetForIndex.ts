import { flushDeferredPositions } from "@/core/deferredPositions";
import type { StateContext } from "@/state/state";

export function calculateOffsetForIndex(ctx: StateContext, index: number | undefined) {
    const state = ctx.state;
    flushDeferredPositions(ctx, "exactOffsetRead");
    return index !== undefined ? state.positions[index] || 0 : 0;
}
