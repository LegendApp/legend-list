import type { InternalState } from "@/types";
import { getId } from "@/utils/getId";

export function checkActualChange(
    state: InternalState,
    dataProp: readonly unknown[],
    previousData: readonly unknown[] | undefined,
) {
    if (!previousData || !dataProp || dataProp.length !== previousData.length) {
        return true;
    }

    const {
        idCache,
        props: { keyExtractor },
    } = state;

    for (let i = 0; i < dataProp.length; i++) {
        if (dataProp[i] !== previousData[i]) {
            return true;
        }
        if (keyExtractor ? idCache[i] !== keyExtractor(previousData[i], i) : dataProp[i] !== previousData[i]) {
            return true;
        }
    }

    return false;
}
