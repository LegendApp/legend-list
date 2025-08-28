import type { InternalState } from "@/types";
import { getId } from "@/utils/getId";

export function checkAllSizesKnown(state: InternalState) {
    const { startBuffered, endBuffered, sizesKnown } = state;
    if (endBuffered !== null && startBuffered >= 0 && endBuffered >= 0) {
        // If waiting for initial layout and all items in view have a known size then
        // initial layout is complete
        let areAllKnown = true;
        for (let i = startBuffered!; areAllKnown && i <= endBuffered!; i++) {
            const key = getId(state, i)!;
            areAllKnown &&= sizesKnown.has(key);
        }
        return areAllKnown;
    }
    return false;
}
