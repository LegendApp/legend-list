import { IsNewArchitecture } from "@/constants-platform";
import { isInitialScrollMVCPAnchorActive } from "@/core/initialScrollMVCPAnchor";
import type { InternalState } from "@/types.base";
import { hasActiveMVCPAnchorLock } from "@/utils/hasActiveMVCPAnchorLock";

export function canUseDeferredGeometry(state: InternalState, numColumns: number) {
    const {
        dataChangeNeedsScrollUpdate,
        didFinishInitialScroll,
        initialScroll,
        nativeMVCPSettling,
        scrollingTo,
        props: { horizontal, stickyIndicesArr },
    } = state;

    return Boolean(
        IsNewArchitecture &&
            !dataChangeNeedsScrollUpdate &&
            !initialScroll &&
            !isInitialScrollMVCPAnchorActive(state) &&
            !nativeMVCPSettling &&
            didFinishInitialScroll &&
            !hasActiveMVCPAnchorLock(state) &&
            !scrollingTo &&
            !horizontal &&
            numColumns === 1 &&
            stickyIndicesArr.length === 0,
    );
}
