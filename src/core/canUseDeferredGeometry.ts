import { IsNewArchitecture } from "@/constants-platform";
import type { InternalState } from "@/types.base";
import { hasActiveMVCPAnchorLock } from "@/utils/hasActiveMVCPAnchorLock";

export function canUseDeferredGeometry(state: InternalState, numColumns: number) {
    const {
        dataChangeNeedsScrollUpdate,
        didFinishInitialScroll,
        initialScroll,
        initialScrollMVCPAnchorUntil,
        nativeMVCPSettling,
        scrollingTo,
        props: { horizontal, stickyIndicesArr },
    } = state;

    return Boolean(
        IsNewArchitecture &&
            !dataChangeNeedsScrollUpdate &&
            !initialScroll &&
            !(initialScrollMVCPAnchorUntil > 0 && Date.now() <= initialScrollMVCPAnchorUntil) &&
            !nativeMVCPSettling &&
            didFinishInitialScroll &&
            !hasActiveMVCPAnchorLock(state) &&
            !scrollingTo &&
            !horizontal &&
            numColumns === 1 &&
            stickyIndicesArr.length === 0,
    );
}
