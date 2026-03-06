import type { InternalState } from "@/types.base";

export function checkStructuralDataChange(
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

    if (!keyExtractor) {
        return false;
    }

    for (let i = 0; i < dataProp.length; i++) {
        if (idCache[i] !== keyExtractor(dataProp[i], i)) {
            return true;
        }
    }

    return false;
}
