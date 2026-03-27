import { hasBootstrapScrollOwnership } from "@/core/scrollOwnership";
import type { InternalState } from "@/types.base";

export function shouldEnableNativeMVCPProp(
    state: Pick<InternalState, "initialBootstrap" | "props">,
) {
    const { maintainVisibleContentPosition } = state.props;
    return (
        !hasBootstrapScrollOwnership(state) &&
        (maintainVisibleContentPosition.size || maintainVisibleContentPosition.data)
    );
}
