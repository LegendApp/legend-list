import { calculateOffsetForIndex } from "@/core/calculateOffsetForIndex";
import { calculateOffsetWithOffsetPosition } from "@/core/calculateOffsetWithOffsetPosition";
import { clampScrollOffset } from "@/core/clampScrollOffset";
import type { StateContext } from "@/state/state";

type ActiveScrollTarget = NonNullable<StateContext["state"]["scrollingTo"]>;

export function isEndAlignedLastItemTarget(ctx: StateContext, scrollingTo: ActiveScrollTarget) {
    return scrollingTo.index === ctx.state.props.data.length - 1 && scrollingTo.viewPosition === 1;
}

export function getCurrentTargetOffset(ctx: StateContext, scrollingTo: ActiveScrollTarget) {
    const index = scrollingTo.index;
    const shouldRecomputeEndTarget = isEndAlignedLastItemTarget(ctx, scrollingTo);
    const requestedTargetOffset =
        shouldRecomputeEndTarget && index !== undefined
            ? calculateOffsetWithOffsetPosition(ctx, calculateOffsetForIndex(ctx, index), scrollingTo)
            : (scrollingTo.targetOffset ??
              clampScrollOffset(ctx, scrollingTo.offset - (scrollingTo.viewOffset || 0), scrollingTo));

    return clampScrollOffset(ctx, requestedTargetOffset, scrollingTo);
}

export function scrollToFallbackOffset(ctx: StateContext, offset: number) {
    ctx.state.refScroller.current?.scrollTo({
        animated: false,
        x: ctx.state.props.horizontal ? offset : 0,
        y: ctx.state.props.horizontal ? 0 : offset,
    });
}
