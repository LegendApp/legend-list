import type { InternalState } from "@/types.base";

export function resetDeferredPositionState(state: InternalState) {
    state.deferredPositionDelta = 0;
    state.pendingDeferredSizeShift = 0;
    state.pendingDeferredSizeShiftMinIndex = Infinity;
}
