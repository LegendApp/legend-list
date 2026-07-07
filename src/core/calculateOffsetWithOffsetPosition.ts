import { getTopOffsetAdjustment } from "@/core/getTopOffsetAdjustment";
import { getLayoutSize } from "@/core/layoutAccessors";
import { getContentInsetEnd } from "@/state/getContentInsetEnd";
import { peek$, type StateContext } from "@/state/state";
import type { ScrollIndexWithOffsetPosition } from "@/types.base";

export function calculateOffsetWithOffsetPosition(
    ctx: StateContext,
    offsetParam: number,
    params: Partial<ScrollIndexWithOffsetPosition>,
) {
    const state = ctx.state;
    const { index, viewOffset, viewPosition } = params;
    let offset = offsetParam;

    if (viewOffset) {
        offset -= viewOffset;
    }

    // Header/footer adjustments are index-based. Absolute offsets (for scrollToOffset
    // and MVCP/requestAdjust paths) should not be shifted by header/footer sizes.
    if (index !== undefined) {
        const topOffsetAdjustment = getTopOffsetAdjustment(ctx);
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
        const itemSize = isOutOfBounds ? fallbackEstimatedSize : (getLayoutSize(ctx, index) ?? fallbackEstimatedSize);
        const trailingInset = getContentInsetEnd(ctx);

        offset -= viewPosition * (state.scrollLength - trailingInset - itemSize);

        if (!isOutOfBounds && index === state.props.data.length - 1) {
            const footerSize = peek$(ctx, "footerSize") || 0;
            offset += footerSize;
        }
    }

    return offset;
}
