import type { StateContext } from "@/state/state";

export function isInMVCPActiveMode(state: StateContext["state"]) {
    // Central gate for web MVCP "active" mode.
    // Active mode stays on while data-change correction is pending or a valid anchor lock remains.
    const lock = state.mvcpAnchorLock;
    // Expire lock lazily on read to avoid extra timers in hot scroll paths.
    if (lock && Date.now() > lock.expiresAt) {
        state.mvcpAnchorLock = undefined;
    }

    return state.dataChangeNeedsScrollUpdate || !!state.mvcpAnchorLock;
}
