import { isInitialScrollMVCPAnchorActive } from "@/core/initialScrollMVCPAnchor";
import type { StateContext } from "@/state/state";
import type { ScrollIndexWithOffsetAndContentOffset } from "@/types.base";
import { performInitialScroll } from "@/utils/performInitialScroll";

export function retryInitialScroll(
    ctx: StateContext,
    resolveOffset: (target: ScrollIndexWithOffsetAndContentOffset) => number | undefined,
) {
    const state = ctx.state;
    if (
        !state.didFinishInitialScroll ||
        state.scrollingTo ||
        state.initialScrollLastTargetUsesOffset ||
        !isInitialScrollMVCPAnchorActive(state)
    ) {
        return false;
    }

    const target = state.initialScrollLastTarget;
    if (!target || target.index === undefined) {
        return false;
    }

    const resolvedOffset = resolveOffset(target);
    if (resolvedOffset === undefined) {
        return false;
    }

    const userTakeoverDistance = Math.max(250, state.scrollLength * 0.25);
    const didUserMoveAwayFromResolvedTarget =
        state.scrollHistory.length > 0 && Math.abs(state.scroll - resolvedOffset) > userTakeoverDistance;
    if (target.contentOffset !== undefined && didUserMoveAwayFromResolvedTarget) {
        state.initialScrollRetryWindowUntil = 0;
        return false;
    }

    if (Math.abs(resolvedOffset - state.scroll) <= 1) {
        return false;
    }

    performInitialScroll(ctx, {
        forceScroll: true,
        initialScrollUsesOffset: false,
        resolvedOffset,
        target,
    });
    return true;
}
