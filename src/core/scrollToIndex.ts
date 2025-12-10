import { calculateOffsetForIndex } from "@/core/calculateOffsetForIndex";
import { scrollTo } from "@/core/scrollTo";
import type { StateContext } from "@/state/state";
import type { LegendListRef } from "@/types";
import { getId } from "@/utils/getId";
import { getItemSize } from "@/utils/getItemSize";

export type ScrollToIndexParams = Parameters<LegendListRef["scrollToIndex"]>[0];

export function scrollToIndex(
    ctx: StateContext,
    { index, viewOffset = 0, animated = true, viewPosition }: ScrollToIndexParams,
) {
    const state = ctx.state;
    const { data } = state.props;
    if (index >= data.length) {
        index = data.length - 1;
    } else if (index < 0) {
        index = 0;
    }

    const firstIndexOffset = calculateOffsetForIndex(ctx, index);

    const isLast = index === data.length - 1;
    if (isLast && viewPosition === undefined) {
        viewPosition = 1;
    }

    state.scrollForNextCalculateItemsInView = undefined;

    const targetId = getId(state, index);
    const itemSize = getItemSize(ctx, targetId, index, state.props.data[index!]);

    scrollTo(ctx, {
        animated,
        index,
        itemSize,
        offset: firstIndexOffset,
        viewOffset,
        viewPosition: viewPosition ?? 0,
    });
}
