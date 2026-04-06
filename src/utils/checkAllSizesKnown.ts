import type { InternalState } from "@/types.base";
import { getId } from "@/utils/getId";

function isNullOrUndefined(value: number | null | undefined) {
    return value === null || value === undefined;
}

export function getMountedBufferedIndices(state: InternalState) {
    const { startBuffered, endBuffered } = state;
    if (
        !isNullOrUndefined(endBuffered) &&
        !isNullOrUndefined(startBuffered) &&
        startBuffered >= 0 &&
        endBuffered >= 0
    ) {
        return Array.from(state.containerItemKeys.keys())
            .map((key) => state.indexByKey.get(key))
            .filter((index): index is number => index !== undefined && index >= startBuffered && index <= endBuffered)
            .sort((a, b) => a - b);
    }
    return [];
}

export function checkAllSizesKnown(state: InternalState, indices = getMountedBufferedIndices(state)) {
    return (
        indices.length > 0 &&
        indices.every((index) => {
            const key = getId(state, index)!;
            return state.sizesKnown.has(key);
        })
    );
}
