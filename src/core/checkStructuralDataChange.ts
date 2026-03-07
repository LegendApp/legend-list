import type { InternalState } from "@/types.base";

export function checkStructuralDataChange(
    state: InternalState,
    dataProp: readonly unknown[],
    previousData: readonly unknown[] | undefined,
) {
    if (!previousData || !dataProp) {
        return true;
    }

    const {
        idCache,
        props: { keyExtractor },
    } = state;
    const previousLength = previousData === dataProp ? idCache.length : previousData.length;

    if (dataProp.length !== previousLength) {
        return true;
    }

    if (!keyExtractor) {
        return previousData !== dataProp;
    }

    for (let i = 0; i < dataProp.length; i++) {
        if (idCache[i] !== keyExtractor(dataProp[i], i)) {
            return true;
        }
    }

    return false;
}
