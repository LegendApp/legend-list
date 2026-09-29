import { getStartOffsetAdjustment } from "@/core/getStartOffsetAdjustment";
import { getContentInsetEnd } from "@/state/getContentInsetEnd";
import type { StateContext } from "@/state/state";
import type { ScrollIndexWithOffsetPosition } from "@/types.base";
import { getId } from "@/utils/getId";
import { getItemSize } from "@/utils/getItemSize";

export function getViewPositionOffset(
    availableSpace: number,
    viewPosition: number,
    viewPositionFallback?: "start" | "end",
) {
    let alignment = viewPosition;
    if (availableSpace < 0 && viewPositionFallback !== undefined) {
        alignment = viewPositionFallback === "start" ? 0 : 1;
    }
    return -alignment * availableSpace;
}

export function calculateOffsetWithOffsetPosition(
    ctx: StateContext,
    offsetParam: number,
    params: Partial<ScrollIndexWithOffsetPosition>,
) {
    const state = ctx.state;
    const { index, viewOffset, viewPosition, viewPositionFallback } = params;
    let offset = offsetParam;

    if (viewOffset) {
        offset -= viewOffset;
    }

    // Header/footer adjustments are index-based. Absolute offsets (for scrollToOffset
    // and MVCP/requestAdjust paths) should not be shifted by header/footer sizes.
    if (index !== undefined) {
        const startOffsetAdjustment = getStartOffsetAdjustment(ctx);
        if (startOffsetAdjustment) {
            offset += startOffsetAdjustment;
        }
    }

    if (viewPosition !== undefined && index !== undefined) {
        const dataLength = state.props.data.length;
        if (dataLength === 0) {
            return offset;
        }
        const isOutOfBounds = index < 0 || index >= dataLength;
        const fallbackEstimatedSize = state.props.estimatedItemSize ?? 0;
        const measuredItemSize = isOutOfBounds
            ? fallbackEstimatedSize
            : getItemSize(ctx, getId(state, index), index, state.props.data[index]!);
        const itemSize = Math.max(0, measuredItemSize - (isOutOfBounds ? 0 : ctx.scrollAxisGap));
        const trailingInset = getContentInsetEnd(ctx);

        const availableSpace = state.scrollLength - trailingInset - itemSize;
        offset += getViewPositionOffset(availableSpace, viewPosition, viewPositionFallback);

        // Aligns the item itself. End-of-content targets carry padding and footer
        // in viewOffset (see endOfContentTarget.ts); adding the footer here would
        // count it twice and shift top/center alignment of the last item.
    }

    return offset;
}
