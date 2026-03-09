import type { StateContext } from "@/state/state";
import { getId } from "@/utils/getId";
import { getItemSize } from "@/utils/getItemSize";

export function calculateOffsetForIndex(ctx: StateContext, index: number | undefined) {
    const state = ctx.state;
    const { data } = state.props;

    if (index === undefined || !Number.isInteger(index) || index < 0 || index >= data.length) {
        return 0;
    }

    const directPosition = state.positions[index];
    if (directPosition !== undefined) {
        return directPosition;
    }

    let offset = 0;
    let startIndex = 0;

    for (let i = index - 1; i >= 0; i--) {
        const position = state.positions[i];
        if (position !== undefined) {
            const itemKey = getId(state, i);
            const item = data[i];
            const itemSize =
                itemKey !== undefined && item !== undefined ? (getItemSize(ctx, itemKey, i, item) ?? 0) : 0;
            offset = position + itemSize;
            startIndex = i + 1;
            break;
        }
    }

    for (let i = startIndex; i < index; i++) {
        const itemKey = getId(state, i);
        const item = data[i];
        if (itemKey !== undefined && item !== undefined) {
            offset += getItemSize(ctx, itemKey, i, item) ?? 0;
        }
    }

    return offset;
}
