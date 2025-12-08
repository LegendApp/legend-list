import type { StateContext } from "@/state/state";
import type { ScrollIndexWithOffsetPosition } from "@/types";
import { getId } from "@/utils/getId";
import { getItemSize } from "@/utils/getItemSize";

export function calculateOffsetWithOffsetPosition(
    ctx: StateContext,
    offsetParam: number,
    params: Partial<ScrollIndexWithOffsetPosition>,
) {
    const state = ctx.state!;
    const { index, viewOffset, viewPosition } = params;
    let offset = offsetParam;

    if (viewOffset) {
        offset -= viewOffset;
    }

    if (viewPosition !== undefined && index !== undefined) {
        // TODO: This can be inaccurate if the item size is very different from the estimatedItemSize
        // In the future we can improve this by listening for the item size change and then updating the scroll position
        offset -=
            viewPosition *
            (state.scrollLength - getItemSize(ctx, getId(state, index), index, state.props.data[index]!));
    }

    return offset;
}
