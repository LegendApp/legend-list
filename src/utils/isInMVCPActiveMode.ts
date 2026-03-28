import type { StateContext } from "@/state/state";
import { hasActiveMVCPAnchorLock } from "@/utils/hasActiveMVCPAnchorLock";

export function isInMVCPActiveMode(state: StateContext["state"]) {
    // Central gate for web MVCP "active" mode.
    // Active mode stays on while data-change correction is pending or a valid anchor lock remains.
    const hasMVCPOwnedPrependTransaction =
        !!state.pendingPrependTransaction && !state.pendingPrependTransaction.usesDeferredGeometry;
    const hasMVCPOwnedDataChange =
        state.dataChangeNeedsScrollUpdate &&
        !(state.pendingPrependTransaction && state.pendingPrependTransaction.usesDeferredGeometry);
    return (
        hasMVCPOwnedDataChange ||
        !!state.ignoreScrollFromMVCP ||
        !!state.pendingNativeMVCPAdjust ||
        hasMVCPOwnedPrependTransaction ||
        hasActiveMVCPAnchorLock(state)
    );
}
