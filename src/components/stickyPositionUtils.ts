import { createLayoutEngine } from "@/core/LayoutEngine";
import type { StateContext } from "@/state/state";

export function getStickyPushLimit(ctx: StateContext, index: number, itemKey: string | undefined) {
    const state = ctx.state;
    if (!itemKey) {
        return undefined;
    }

    const currentSize = state.sizes.get(itemKey);
    if (!(currentSize && currentSize > 0)) {
        return undefined;
    }

    const stickyIndexInArray = state.props.stickyHeaderIndicesArr.indexOf(index);
    if (stickyIndexInArray === -1) {
        return undefined;
    }

    const nextStickyIndex = state.props.stickyHeaderIndicesArr[stickyIndexInArray + 1];
    if (nextStickyIndex === undefined) {
        return undefined;
    }

    const nextStickyPosition = createLayoutEngine(ctx).getOffset(nextStickyIndex);
    if (nextStickyPosition === undefined) {
        return undefined;
    }

    return nextStickyPosition - currentSize;
}
