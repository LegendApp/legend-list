import { calculateOffsetForIndex } from "@/core/calculateOffsetForIndex";
import { scrollTo } from "@/core/scrollTo";
import type { StateContext } from "@/state/state";
import type { LegendListRef } from "@/types.base";
import { getItemSizeAtIndex } from "@/utils/getItemSize";

export type ScrollToIndexParams = Parameters<LegendListRef["scrollToIndex"]>[0];

export function clampScrollIndex(index: number, dataLength: number) {
    if (dataLength <= 0) {
        return -1;
    }

    if (index >= dataLength) {
        return dataLength - 1;
    }

    if (index < 0) {
        return 0;
    }

    return index;
}

export function scrollToIndex(
    ctx: StateContext,
    {
        index,
        viewOffset = 0,
        animated = true,
        forceScroll,
        isInitialScroll,
        viewPosition,
    }: ScrollToIndexParams & { forceScroll?: boolean; isInitialScroll?: boolean },
) {
    const state = ctx.state;
    const { data } = state.props;
    index = clampScrollIndex(index, data.length);
    const itemSize = getItemSizeAtIndex(ctx, index);

    const firstIndexOffset = calculateOffsetForIndex(ctx, index);

    const isLast = index === data.length - 1;
    if (isLast && viewPosition === undefined) {
        viewPosition = 1;
    }

    state.scrollForNextCalculateItemsInView = undefined;

    scrollTo(ctx, {
        animated,
        forceScroll,
        index,
        isInitialScroll,
        itemSize,
        offset: firstIndexOffset,
        viewOffset,
        viewPosition: viewPosition ?? 0,
    });
}
