import { calculateOffsetForIndex } from "@/core/calculateOffsetForIndex";
import { scrollTo } from "@/core/scrollTo";
import type { StateContext } from "@/state/state";
import type { InternalState, LegendListRef } from "@/types";

export type ScrollToIndexParams = Parameters<LegendListRef["scrollToIndex"]>[0];

export function scrollToIndex(
    ctx: StateContext,
    state: InternalState,
    { index, viewOffset = 0, animated = true, viewPosition }: ScrollToIndexParams,
) {
    if (index >= state.props.data.length) {
        index = state.props.data.length - 1;
    } else if (index < 0) {
        index = 0;
    }

    const firstIndexOffset = calculateOffsetForIndex(ctx, state, index);

    const isLast = index === state.props.data.length - 1;
    if (isLast && viewPosition === undefined) {
        viewPosition = 1;
    }

    state.scrollForNextCalculateItemsInView = undefined;

    scrollTo(state, {
        animated,
        index,
        offset: firstIndexOffset,
        viewOffset,
        viewPosition: viewPosition ?? 0,
    });
}
