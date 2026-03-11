import { IsNewArchitecture } from "@/constants-platform";
import type { InternalState } from "@/types.base";

// Shared shape guard for the deferred-rebase path. More specific policies like
// stable-pass or scroll-ownership checks stay with their own callers.
export function canUseDeferredGeometry(state: InternalState, numColumns: number) {
    return (
        IsNewArchitecture &&
        !state.initialScroll &&
        !!state.didFinishInitialScroll &&
        !state.scrollingTo &&
        !state.props.horizontal &&
        numColumns === 1 &&
        state.props.stickyIndicesArr.length === 0
    );
}
