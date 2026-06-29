import type { InternalState } from "@/types.internal";

export function getStickyPushLimit(state: InternalState, index: number, itemKey: string | undefined) {
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

    const nextStickyPosition = state.positions[nextStickyIndex];
    if (nextStickyPosition === undefined) {
        return undefined;
    }

    return nextStickyPosition - currentSize;
}
