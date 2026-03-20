import { getTopOffsetAdjustment } from "@/core/getTopOffsetAdjustment";
import { getContentInsetEnd } from "@/state/getContentInsetEnd";
import { peek$, type StateContext } from "@/state/state";
import type { ScrollIndexWithOffsetPosition } from "@/types.base";
import { getId } from "@/utils/getId";
import { getItemSize } from "@/utils/getItemSize";

export function calculateOffsetWithOffsetPosition(
    ctx: StateContext,
    offsetParam: number,
    params: Partial<ScrollIndexWithOffsetPosition>,
) {
    const state = ctx.state;
    const { index, viewOffset, viewPosition } = params;
    let offset = offsetParam;
    let topOffsetAdjustment = 0;
    let trailingInset = 0;
    let itemSize: number | undefined;
    let footerSize = 0;

    if (viewOffset) {
        offset -= viewOffset;
    }

    // Header/footer adjustments are index-based. Absolute offsets (for scrollToOffset
    // and MVCP/requestAdjust paths) should not be shifted by header/footer sizes.
    if (index !== undefined) {
        topOffsetAdjustment = getTopOffsetAdjustment(ctx);
        if (topOffsetAdjustment) {
            offset += topOffsetAdjustment;
        }
    }

    if (viewPosition !== undefined && index !== undefined) {
        const dataLength = state.props.data.length;
        if (dataLength === 0) {
            return offset;
        }
        const isOutOfBounds = index < 0 || index >= dataLength;
        const fallbackEstimatedSize = state.props.estimatedItemSize ?? 0;
        itemSize = isOutOfBounds
            ? fallbackEstimatedSize
            : getItemSize(ctx, getId(state, index), index, state.props.data[index]!);
        trailingInset = getContentInsetEnd(state);

        // TODO: This can be inaccurate if the item size is very different from the estimatedItemSize
        // In the future we can improve this by listening for the item size change and then updating the scroll position
        offset -= viewPosition * (state.scrollLength - trailingInset - itemSize);

        if (!isOutOfBounds && index === state.props.data.length - 1) {
            footerSize = peek$(ctx, "footerSize") || 0;
            offset += footerSize;
        }
    }
    return offset;
}
