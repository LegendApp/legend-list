import type { InternalState } from "@/types.internal";

export function resetLayoutCachesForDataChange(state: InternalState) {
    state.indexByKey.clear();
    state.idCache.length = 0;
    state.positions.length = 0;
    state.columns.length = 0;
    state.columnSpans.length = 0;
}
