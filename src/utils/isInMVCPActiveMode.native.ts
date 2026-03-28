import type { StateContext } from "@/state/state";

export function isInMVCPActiveMode(state: StateContext["state"]) {
    // Native does not use web anchor locking; only data-change forced updates keep MVCP active.
    const hasMVCPOwnedPrependTransaction =
        !!state.pendingPrependTransaction && !state.pendingPrependTransaction.usesDeferredGeometry;
    return (
        state.dataChangeNeedsScrollUpdate ||
        !!state.ignoreScrollFromMVCP ||
        !!state.pendingNativeMVCPAdjust ||
        hasMVCPOwnedPrependTransaction
    );
}
