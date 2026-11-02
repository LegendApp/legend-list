import { calculateOffsetForIndex } from "@/core/calculateOffsetForIndex";
import { calculateOffsetWithOffsetPosition } from "@/core/calculateOffsetWithOffsetPosition";
import { clampScrollOffset } from "@/core/clampScrollOffset";
import { Platform } from "@/platform/Platform";
import type { StateContext } from "@/state/state";
import { clampScrollIndex } from "@/utils/clampScrollIndex";

type ActiveScrollTarget = NonNullable<StateContext["state"]["scrollingTo"]>;

export function isEndAlignedLastItemTarget(ctx: StateContext, scrollingTo: ActiveScrollTarget) {
    return (
        (scrollingTo.isScrollToEnd || scrollingTo.index === ctx.state.props.data.length - 1) &&
        scrollingTo.viewPosition === 1
    );
}

export function getCurrentTargetOffset(ctx: StateContext, scrollingTo: ActiveScrollTarget) {
    const index = scrollingTo.isScrollToEnd
        ? ctx.state.props.data.length - 1
        : scrollingTo.index === undefined
          ? undefined
          : clampScrollIndex(scrollingTo.index, ctx.state.props.data.length);
    // Web requests follow measurements; initial placement keeps its own completion policy.
    const isRetargetingWebScroll =
        Platform.OS === "web" && (!scrollingTo.isInitialScroll || ctx.state.initialScrollSession?.kind === "bootstrap");
    const requestedTargetOffset =
        index !== undefined && (isRetargetingWebScroll || isEndAlignedLastItemTarget(ctx, scrollingTo))
            ? calculateOffsetWithOffsetPosition(ctx, calculateOffsetForIndex(ctx, index), { ...scrollingTo, index })
            : isRetargetingWebScroll
              ? calculateOffsetWithOffsetPosition(ctx, scrollingTo.offset, scrollingTo)
              : (scrollingTo.targetOffset ?? scrollingTo.offset - (scrollingTo.viewOffset || 0));

    return clampScrollOffset(ctx, requestedTargetOffset, scrollingTo);
}
