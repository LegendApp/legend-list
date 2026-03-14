import { Platform } from "@/platform/Platform";
import type { InternalState } from "@/types.base";

export function isInitialScrollMVCPAnchorActive(
    state: Pick<InternalState, "initialScrollRetryWindowUntil">,
    now = Date.now(),
) {
    return state.initialScrollRetryWindowUntil > now;
}

export function openInitialScrollRetryWindow(
    state: Pick<InternalState, "initialScrollRetryWindowUntil">,
    durationMs: number,
    now = Date.now(),
) {
    state.initialScrollRetryWindowUntil = Math.max(state.initialScrollRetryWindowUntil, now + durationMs);
}

export function getInitialScrollMVCPAnchorTarget(
    state: Pick<
        InternalState,
        "initialScrollLastTarget" | "initialScrollLastTargetUsesOffset" | "initialScrollRetryWindowUntil"
    >,
    now = Date.now(),
) {
    if (Platform.OS !== "web") {
        return undefined;
    }

    if (!isInitialScrollMVCPAnchorActive(state, now)) {
        state.initialScrollRetryWindowUntil = 0;
        return undefined;
    }

    if (state.initialScrollLastTargetUsesOffset) {
        return undefined;
    }

    return state.initialScrollLastTarget?.index;
}
