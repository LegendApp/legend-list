import { IsNewArchitecture } from "@/constants-platform";
import type { InternalState } from "@/types.base";
import { hasActiveMVCPAnchorLock } from "@/utils/hasActiveMVCPAnchorLock";
import { isInMVCPActiveMode } from "@/utils/isInMVCPActiveMode";

export type ScrollStabilityOwner = "bootstrap" | "mvcp" | "deferred_geometry" | "direct_scroll";

export function hasMVCPScrollOwnership(state: InternalState) {
    return isInMVCPActiveMode(state);
}

export function hasBootstrapScrollOwnership(state: Pick<InternalState, "initialBootstrap">) {
    return !!state.initialBootstrap && state.initialBootstrap.phase !== "inactive";
}

export function supportsDeferredGeometryOptimization(state: InternalState, numColumns: number) {
    const {
        didFinishInitialScroll,
        initialScroll,
        pendingNativeMVCPAdjust,
        scrollingTo,
        props: { horizontal, stickyIndicesArr },
    } = state;

    return Boolean(
        IsNewArchitecture &&
            !initialScroll &&
            !pendingNativeMVCPAdjust &&
            !state.pendingPrependTransaction &&
            (didFinishInitialScroll || hasBootstrapScrollOwnership(state)) &&
            !hasActiveMVCPAnchorLock(state) &&
            !scrollingTo &&
            !horizontal &&
            numColumns === 1 &&
            stickyIndicesArr.length === 0,
    );
}

export function getScrollStabilityOwner(
    state: InternalState,
    params: {
        allowDeferredGeometry?: boolean;
        numColumns: number;
    },
): ScrollStabilityOwner {
    if (hasBootstrapScrollOwnership(state)) {
        return "bootstrap";
    }

    if (hasMVCPScrollOwnership(state)) {
        return "mvcp";
    }

    if (params.allowDeferredGeometry && supportsDeferredGeometryOptimization(state, params.numColumns)) {
        return "deferred_geometry";
    }

    return "direct_scroll";
}
