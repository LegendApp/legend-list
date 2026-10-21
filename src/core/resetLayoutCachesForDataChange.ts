import { invalidateFixedItemSizes } from "@/core/containerItemMetadata";
import type { InternalState } from "@/types.internal";

export function resetLayoutCachesForDataChange(state: InternalState) {
    state.positionsAreCurrent = false;
    state.indexByKey.clear();
    state.idCache.length = 0;
    state.positions.length = 0;
    state.columns.length = 0;
    state.columnSpans.length = 0;
}

export function resetColumnLayoutCaches(state: InternalState) {
    state.sizes.clear();
    state.sizesKnown.clear();
    invalidateFixedItemSizes(state);
    for (const key in state.averageSizes) {
        delete state.averageSizes[key];
    }
    state.positionRecalculationStartIndex = 0;
    state.scrollForNextCalculateItemsInView = undefined;
}
