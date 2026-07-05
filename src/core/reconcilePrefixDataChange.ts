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

export interface PrefixDataChangeReconciliationOptions {
    previousIdCache?: readonly (string | undefined)[];
}

export function reconcilePrefixDataChange(
    ctx: StateContext,
    options?: PrefixDataChangeReconciliationOptions,
): PrefixDataChangeReconciliationResult {
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
        const previousData = state.previousData;
        const statePendingDataComparison = state.pendingDataComparison;
        const pendingDataComparison =
            statePendingDataComparison &&
            statePendingDataComparison.previousData === previousData &&
            statePendingDataComparison.nextData === data
                ? statePendingDataComparison
                : undefined;
        const canSeedCachedSizes = state.sizes.size > 0;
        const canSeedFixedSizes = !!getFixedItemSize;
        const canSeedKnownSizes = state.sizesKnown.size > 0;

        state.indexByKey.clear();
        state.idCache.length = 0;
        resetPrefixLayoutStoreEstimateFlushState(state);
        const sizeEntries: PrefixLayoutStoreSizeEntry[] = [];

        for (let index = 0; index < data.length; index++) {
            const item = data[index];
            const previousKey = options?.previousIdCache?.[index];
            const canReusePreviousKey =
                previousKey !== undefined &&
                previousData !== undefined &&
                (previousData[index] === item || pendingDataComparison?.byIndex[index] !== undefined);
            const key = canReusePreviousKey ? previousKey : getId(state, index);
            state.idCache[index] = key;

            if (state.indexByKey.has(key)) {
                result.duplicateKey = key;
                break;
            }

            state.indexByKey.set(key, index);

            const knownSize = canSeedKnownSizes ? state.sizesKnown.get(key) : undefined;
            if (knownSize !== undefined) {
                state.sizes.set(key, knownSize);
                sizeEntries.push({ index, key, size: knownSize, type: "measured" });
                result.knownSizeCount++;
            } else {
                let didSeedSize = false;
                if (canSeedFixedSizes) {
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

                const cachedSize = !didSeedSize && canSeedCachedSizes ? state.sizes.get(key) : undefined;
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
