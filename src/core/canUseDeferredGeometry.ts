import { IsNewArchitecture } from "@/constants-platform";
import type { InternalState } from "@/types.base";

// Shared shape guard for the deferred-rebase path. More specific policies like
// stable-pass or scroll-ownership checks stay with their own callers.
export function canUseDeferredGeometry(state: InternalState, numColumns: number) {
    const {
        initialScroll,
        didFinishInitialScroll,
        scrollingTo,
        props: { horizontal, stickyIndicesArr },
    } = state;

    return (
        // Disabled on old architecture because the optimization to use animated positions causes flickers
        // when rebasing deferred positions
        IsNewArchitecture &&
        !initialScroll &&
        didFinishInitialScroll &&
        !scrollingTo &&
        !horizontal &&
        numColumns === 1 &&
        stickyIndicesArr.length === 0
    );
}
