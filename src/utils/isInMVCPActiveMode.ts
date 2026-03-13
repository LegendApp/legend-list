import type { StateContext } from "@/state/state";
import { hasActiveMVCPAnchorLock } from "@/utils/hasActiveMVCPAnchorLock";

export function isInMVCPActiveMode(state: StateContext["state"]) {
    // Central gate for web MVCP "active" mode.
    // Active mode stays on while data-change correction is pending or a valid anchor lock remains.
    return state.dataChangeNeedsScrollUpdate || !!state.nativeMVCPSettling || hasActiveMVCPAnchorLock(state);
}
