import { supportsDeferredGeometryOptimization } from "@/core/scrollOwnership";
import type { InternalState } from "@/types.base";

export function canUseDeferredGeometry(state: InternalState, numColumns: number) {
    return supportsDeferredGeometryOptimization(state, numColumns);
}
