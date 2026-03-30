import { flushDeferredPositionsForExactRead, getDeferredRenderPosition } from "@/core/deferredPositions";
import type { StateContext } from "@/state/state";

export function calculateOffsetForIndex(ctx: StateContext, index: number | undefined) {
    const state = ctx.state;
    if (state.deferredPositions?.desiredScrollOffset !== undefined) {
        return index !== undefined ? getDeferredRenderPosition(ctx, index) || 0 : 0;
    }

    flushDeferredPositionsForExactRead(ctx);
    return index !== undefined ? state.positions[index] || 0 : 0;
}
