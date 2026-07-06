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
            props: { data, estimatedItemSize, getFixedItemSize, getItemType },
        } = state;
        const fallbackSize = (estimatedItemSize ?? 100) + ctx.scrollAxisGap;
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
        let totalSeedSize = 0;

        for (let index = 0; index < data.length; index++) {
            const item = data[index];
            const itemType = canSeedFixedSizes && getItemType ? (getItemType(item, index) ?? "") : "";
            const fixedSize = canSeedFixedSizes ? getFixedItemSize(item, index, itemType) : undefined;
            const fixedLayoutSize = fixedSize !== undefined ? fixedSize + ctx.scrollAxisGap : undefined;
            totalSeedSize += fixedLayoutSize ?? fallbackSize;
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
                if (fixedLayoutSize !== undefined) {
                    state.sizesKnown.set(key, fixedLayoutSize);
                    state.sizes.set(key, fixedLayoutSize);
                    sizeEntries.push({ index, key, size: fixedLayoutSize, type: "measured" });
                    result.fixedSizeCount++;
                    didSeedSize = true;
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
            store.flushEstimatedSize(data.length > 0 ? totalSeedSize / data.length : fallbackSize);
            store.rebuildSizes(sizeEntries);
        }
    }

    return result;
}
