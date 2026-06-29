import type { InternalState } from "@/types.internal";
import { getId } from "@/utils/getId";

export function checkAllSizesKnown(
    state: InternalState,
    start: number | null | undefined,
    end: number | null | undefined,
) {
    if (start == null || end == null || start < 0 || end < start) {
        return false;
    }

    let hasMountedIndex = false;
    for (const key of state.containerItemKeys.keys()) {
        const index = state.indexByKey.get(key);
        if (index !== undefined && index >= start && index <= end) {
            hasMountedIndex = true;
            const id = getId(state, index);
            if (id === undefined || !state.sizesKnown.has(id)) {
                return false;
            }
        }
    }

    return hasMountedIndex;
}
