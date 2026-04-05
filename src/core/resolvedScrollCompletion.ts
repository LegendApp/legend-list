import { clampScrollOffset } from "@/core/clampScrollOffset";
import type { StateContext } from "@/state/state";

type ActiveScrollTarget = NonNullable<StateContext["state"]["scrollingTo"]>;

export function getResolvedScrollCompletionState(ctx: StateContext, scrollingTo: ActiveScrollTarget) {
    const { state } = ctx;
    const scroll = state.scrollPending;
    const adjust = state.scrollAdjustHandler.getAdjust();
    const clampedTargetOffset =
        scrollingTo.targetOffset ??
        clampScrollOffset(ctx, scrollingTo.offset - (scrollingTo.viewOffset || 0), scrollingTo);
    const maxOffset = clampScrollOffset(ctx, scroll, scrollingTo);
    const diff1 = Math.abs(scroll - clampedTargetOffset);
    const diff2 = Math.abs(diff1 - adjust);

    return {
        clampedTargetOffset,
        isAtResolvedTarget: Math.abs(scroll - maxOffset) < 1 && (diff1 < 1 || (!scrollingTo.animated && diff2 < 1)),
    };
}
