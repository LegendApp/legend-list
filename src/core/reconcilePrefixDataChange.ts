import type { PrefixLayoutStoreSizeEntry } from "@/core/PrefixLayoutStore";
import {
    getActivePrefixLayoutStore,
    resetPrefixLayoutStoreEstimateFlushState,
} from "@/core/prefixLayoutStoreLifecycle";
import type { StateContext } from "@/state/state";
import { getId } from "@/utils/getId";

export interface PrefixDataChangeReconciliationResult {
    cachedSizeCount: number;
    duplicateKey?: string;
    fixedSizeCount: number;
    knownSizeCount: number;
    reconciled: boolean;
}

export function reconcilePrefixDataChange(ctx: StateContext): PrefixDataChangeReconciliationResult {
    const state = ctx.state;
    const store = getActivePrefixLayoutStore(ctx);
    const result: PrefixDataChangeReconciliationResult = {
        cachedSizeCount: 0,
        fixedSizeCount: 0,
        knownSizeCount: 0,
        reconciled: false,
    };

    if (store) {
        const {
            props: { data, getFixedItemSize, getItemType },
        } = state;

        state.indexByKey.clear();
        state.idCache.length = 0;
        resetPrefixLayoutStoreEstimateFlushState(state);
        const sizeEntries: PrefixLayoutStoreSizeEntry[] = [];

        for (let index = 0; index < data.length; index++) {
            const item = data[index];
            const key = getId(state, index);

            if (state.indexByKey.has(key)) {
                result.duplicateKey = key;
                break;
            }

            state.indexByKey.set(key, index);

            const knownSize = state.sizesKnown.get(key);
            if (knownSize !== undefined) {
                state.sizes.set(key, knownSize);
                sizeEntries.push({ index, key, size: knownSize, type: "measured" });
                result.knownSizeCount++;
            } else {
                let didSeedSize = false;
                if (getFixedItemSize) {
                    const itemType = getItemType ? (getItemType(item, index) ?? "") : "";
                    const fixedSize = getFixedItemSize(item, index, itemType);
                    if (fixedSize !== undefined) {
                        const size = fixedSize + ctx.scrollAxisGap;
                        state.sizesKnown.set(key, size);
                        state.sizes.set(key, size);
                        sizeEntries.push({ index, key, size, type: "measured" });
                        result.fixedSizeCount++;
                        didSeedSize = true;
                    }
                }

                const cachedSize = !didSeedSize ? state.sizes.get(key) : undefined;
                if (cachedSize !== undefined) {
                    sizeEntries.push({ index, key, size: cachedSize, type: "cached" });
                    result.cachedSizeCount++;
                }
            }
        }

        result.reconciled = result.duplicateKey === undefined;
        if (result.reconciled) {
            store.rebuildSizes(sizeEntries);
        }
    }

    return result;
}
