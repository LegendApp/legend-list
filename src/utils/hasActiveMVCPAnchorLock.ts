import type { StateContext } from "@/state/state";

export function hasActiveMVCPAnchorLock(state: StateContext["state"]) {
    const lock = state.mvcpAnchorLock;
    if (!lock) {
        return false;
    }

    if (Date.now() > lock.expiresAt) {
        state.mvcpAnchorLock = undefined;
        return false;
    }

    return true;
}
