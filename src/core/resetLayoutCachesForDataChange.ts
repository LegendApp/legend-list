import { resetLayoutStoreRuntimeState } from "@/core/layoutStoreLifecycle";
import type { InternalState } from "@/types.internal";

export function resetLayoutCachesForDataChange(
    state: InternalState,
    options?: { includeLayoutStoreMeasurements?: boolean },
) {
    state.indexByKey.clear();
    state.idCache.length = 0;
    if (options?.includeLayoutStoreMeasurements !== false) {
        state.layoutStoreRuntime?.store.clearKnownSizes();
        resetLayoutStoreRuntimeState(state);
    }
}
