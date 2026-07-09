import { calculateOffsetForIndex } from "@/core/calculateOffsetForIndex";
import { calculateOffsetWithOffsetPosition } from "@/core/calculateOffsetWithOffsetPosition";
import { clampScrollOffset } from "@/core/clampScrollOffset";
import { getDataLength } from "@/core/IndexedData";
import { getLayoutOffset } from "@/core/layoutAccessors";
import { Platform } from "@/platform/Platform";
import type { StateContext } from "@/state/state";
import { clampScrollIndex } from "@/utils/clampScrollIndex";

type ActiveScrollTarget = NonNullable<StateContext["state"]["scrollingTo"]>;

export function isEndAlignedLastItemTarget(ctx: StateContext, scrollingTo: ActiveScrollTarget) {
    return (
        (scrollingTo.isScrollToEnd || scrollingTo.index === getDataLength(ctx.state) - 1) &&
        scrollingTo.viewPosition === 1
    );
}

export function isIndexScrollTarget(ctx: StateContext, scrollingTo: ActiveScrollTarget) {
    return !scrollingTo.isInitialScroll || ctx.state.initialScrollSession?.kind === "bootstrap";
}

export function getCommittedWebEndOffset(ctx: StateContext) {
    // The adjustment spacer extends browser range for one frame; it is not committed content.
    ctx.clearTemporaryScrollAdjust?.();
    return ctx.state.refScroller.current?.getMaxScrollOffset?.();
}

export function getMaintainedWebEndOffset(ctx: StateContext, scrollingTo: ActiveScrollTarget) {
    // Automatic web end following owns the content end, including geometry that
    // React committed before the modeled sizes caught up. Initial placement and
    // explicit item/offset requests retain their measurement-based targets.
    if (
        Platform.OS === "web" &&
        ctx.state.maintainingScrollAtEnd &&
        !scrollingTo.isInitialScroll &&
        scrollingTo.clampToContentContainerMinSize &&
        isEndAlignedLastItemTarget(ctx, scrollingTo)
    ) {
        return getCommittedWebEndOffset(ctx);
    }
}

export function getCurrentTargetOffset(ctx: StateContext, scrollingTo: ActiveScrollTarget) {
    const committedEnd = getMaintainedWebEndOffset(ctx, scrollingTo);
    if (committedEnd !== undefined) return committedEnd;

    const index = scrollingTo.isScrollToEnd
        ? getDataLength(ctx.state) - 1
        : scrollingTo.index === undefined
          ? undefined
          : clampScrollIndex(scrollingTo.index, getDataLength(ctx.state));
    // Index requests, including initial placement at an index, follow measured positions and sizes on every
    // platform. An initial offset keeps its own completion policy.
    const followsIndex = isIndexScrollTarget(ctx, scrollingTo);
    const isRetargetingWebScroll = Platform.OS === "web" && followsIndex;
    const requestedTargetOffset =
        index !== undefined &&
        getLayoutOffset(ctx, index) !== undefined &&
        (followsIndex || isEndAlignedLastItemTarget(ctx, scrollingTo))
            ? calculateOffsetWithOffsetPosition(ctx, calculateOffsetForIndex(ctx, index), { ...scrollingTo, index })
            : isRetargetingWebScroll
              ? calculateOffsetWithOffsetPosition(ctx, scrollingTo.offset, scrollingTo)
              : (scrollingTo.targetOffset ?? scrollingTo.offset - (scrollingTo.viewOffset || 0));

    return clampScrollOffset(ctx, requestedTargetOffset, scrollingTo);
}
