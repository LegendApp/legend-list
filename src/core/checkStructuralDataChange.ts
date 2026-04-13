import type { InternalState } from "@/types.internal";

export function checkStructuralDataChange(
    state: InternalState,
    dataProp: readonly unknown[],
    previousData: readonly unknown[] | undefined,
) {
    state.pendingDataComparison = undefined;

    if (!previousData || !dataProp || dataProp.length !== previousData.length) {
        return true;
    }

    const {
        idCache,
        props: { itemsAreEqual, keyExtractor },
    } = state;
    let byIndex: Array<0 | 1 | 2 | undefined> | undefined;

    for (let i = 0; i < dataProp.length; i++) {
        if (dataProp[i] === previousData[i]) {
            continue;
        }
        if (!keyExtractor) {
            if (byIndex) {
                state.pendingDataComparison = { byIndex, nextData: dataProp, previousData };
            }
            return true;
        }
        const previousKey = idCache[i] ?? keyExtractor(previousData[i], i);
        const nextKey = keyExtractor(dataProp[i], i);
        if (previousKey !== nextKey) {
            if (byIndex) {
                state.pendingDataComparison = { byIndex, nextData: dataProp, previousData };
            }
            return true;
        }
        if (!itemsAreEqual) {
            if (byIndex) {
                state.pendingDataComparison = { byIndex, nextData: dataProp, previousData };
            }
            return true;
        }
        const isEqual = itemsAreEqual(previousData[i] as any, dataProp[i] as any, i, dataProp as any);
        byIndex ??= [];
        byIndex[i] = isEqual ? 1 : 2;
        if (!isEqual) {
            state.pendingDataComparison = { byIndex, nextData: dataProp, previousData };
            return true;
        }
    }

    return false;
}
