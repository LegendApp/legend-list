import {
    getActivePrefixLayoutStore,
    resetPrefixLayoutStoreEstimateFlushState,
} from "@/core/prefixLayoutStoreLifecycle";
import type { StateContext } from "@/state/state";
import { IS_DEV } from "@/utils/devEnvironment";
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
        store.clearMeasurements();
        resetPrefixLayoutStoreEstimateFlushState(state);

        for (let index = 0; index < data.length; index++) {
            const item = data[index];
            const key = getId(state, index);

            if (state.indexByKey.has(key)) {
                result.duplicateKey = key;
                if (IS_DEV) {
                    console.error(
                        `[legend-list] Error: Detected overlapping key (${key}) which causes missing items and gaps and other terrrible things. Check that keyExtractor returns unique values.`,
                    );
                }
                break;
            }

            state.indexByKey.set(key, index);

            const knownSize = state.sizesKnown.get(key);
            if (knownSize !== undefined) {
                store.setMeasuredSize(index, key, knownSize);
                state.sizes.set(key, knownSize);
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
                        store.setMeasuredSize(index, key, size);
                        result.fixedSizeCount++;
                        didSeedSize = true;
                    }
                }

                const cachedSize = !didSeedSize ? state.sizes.get(key) : undefined;
                if (cachedSize !== undefined) {
                    store.setCachedSize(index, key, cachedSize);
                    result.cachedSizeCount++;
                }
            }
        }

        result.reconciled = result.duplicateKey === undefined;
    }

    return result;
}
