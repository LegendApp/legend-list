import { IsNewArchitecture } from "@/constants-platform";
import { isInitialBootstrapActive } from "@/core/initialBootstrap";
import type { InternalState } from "@/types.base";
import { hasActiveMVCPAnchorLock } from "@/utils/hasActiveMVCPAnchorLock";

export function canUseDeferredGeometry(state: InternalState, numColumns: number) {
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
            (didFinishInitialScroll || isInitialBootstrapActive(state)) &&
            !hasActiveMVCPAnchorLock(state) &&
            !scrollingTo &&
            !horizontal &&
            numColumns === 1 &&
            stickyIndicesArr.length === 0,
    );
}
