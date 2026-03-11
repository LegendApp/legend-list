import { IsNewArchitecture } from "@/constants-platform";
import type { InternalState } from "@/types.base";

export function canUseDeferredGeometry(state: InternalState, numColumns: number) {
    const {
        didFinishInitialScroll,
        initialScroll,
        scrollingTo,
        props: { horizontal, stickyIndicesArr },
    } = state;

    return Boolean(
        IsNewArchitecture &&
            !initialScroll &&
            didFinishInitialScroll &&
            !scrollingTo &&
            !horizontal &&
            numColumns === 1 &&
            stickyIndicesArr.length === 0,
    );
}
