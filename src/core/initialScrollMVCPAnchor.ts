import { Platform } from "@/platform/Platform";
import type { InternalState } from "@/types.base";

export function isInitialScrollMVCPAnchorActive(state: Pick<InternalState, "initialScrollMVCPAnchorUntil">, now = Date.now()) {
    return state.initialScrollMVCPAnchorUntil > now;
}

export function getInitialScrollMVCPAnchorTarget(
    state: Pick<InternalState, "initialScrollLastTarget" | "initialScrollLastTargetUsesOffset" | "initialScrollMVCPAnchorUntil">,
    now = Date.now(),
) {
    if (Platform.OS !== "web") {
        return undefined;
    }

    if (!isInitialScrollMVCPAnchorActive(state, now)) {
        state.initialScrollMVCPAnchorUntil = 0;
        return undefined;
    }

    if (state.initialScrollLastTargetUsesOffset) {
        return undefined;
    }

    return state.initialScrollLastTarget?.index;
}
