import { calculateOffsetForIndex } from "@/core/calculateOffsetForIndex";
import { calculateOffsetWithOffsetPosition } from "@/core/calculateOffsetWithOffsetPosition";
import { clampScrollOffset } from "@/core/clampScrollOffset";
import { resolveInitialScrollBaseOffset } from "@/core/resolveInitialScrollBaseOffset";
import type { StateContext } from "@/state/state";
import type { ScrollIndexWithOffset, ScrollIndexWithOffsetAndContentOffset } from "@/types.base";

export function resolveInitialScrollTargetOffset(ctx: StateContext, initialScroll: ScrollIndexWithOffset) {
    const { state } = ctx;
    if (state.initialScrollUsesOffset) {
        const requestedOffset = (initialScroll as ScrollIndexWithOffsetAndContentOffset).contentOffset ?? 0;
        return clampScrollOffset(ctx, requestedOffset);
    }

    const baseOffsetRaw = initialScroll.index !== undefined ? calculateOffsetForIndex(ctx, initialScroll.index) : 0;
    const baseOffset = resolveInitialScrollBaseOffset(state, baseOffsetRaw, initialScroll.viewPosition);
    const resolvedOffset = calculateOffsetWithOffsetPosition(ctx, baseOffset, initialScroll);
    return clampScrollOffset(ctx, resolvedOffset, initialScroll);
}
