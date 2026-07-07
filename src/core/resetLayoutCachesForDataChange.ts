import { clearArrayLayoutCache } from "@/core/arrayLayout";
import { resetPrefixLayoutStoreEstimateFlushState } from "@/core/prefixLayoutStoreLifecycle";
import type { InternalState } from "@/types.internal";

export function resetLayoutCachesForDataChange(
    state: InternalState,
    options?: { includePrefixMeasurements?: boolean },
) {
    state.indexByKey.clear();
    state.idCache.length = 0;
    clearArrayLayoutCache(state, { includeColumns: true });
    if (options?.includePrefixMeasurements !== false) {
        state.layoutStore?.clearMeasurements();
        resetPrefixLayoutStoreEstimateFlushState(state);
    }
}
