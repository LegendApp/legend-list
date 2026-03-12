import type { StateContext } from "@/state/state";

export function isInMVCPActiveMode(state: StateContext["state"]) {
    // Native does not use web anchor locking; only data-change forced updates keep MVCP active.
    return state.dataChangeNeedsScrollUpdate || !!state.nativeMVCPSettling;
}
