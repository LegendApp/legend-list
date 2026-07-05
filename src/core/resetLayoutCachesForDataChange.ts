import { clearArrayLayoutCache } from "@/core/ArrayLayoutEngine";
import { resetPrefixLayoutStoreEstimateFlushState } from "@/core/prefixLayoutStoreLifecycle";
import type { InternalState } from "@/types.internal";

export function resetLayoutCachesForDataChange(state: InternalState) {
    state.indexByKey.clear();
    state.idCache.length = 0;
    clearArrayLayoutCache(state, { includeColumns: true });
    state.layoutStore?.clearMeasurements();
    resetPrefixLayoutStoreEstimateFlushState(state);
}
