import type { InternalState } from "@/types.base";

export function resolveInitialScrollBaseOffset(
    state: Pick<InternalState, "queuedInitialLayout" | "scroll" | "scrollingTo">,
    rawOffset: number,
    targetViewPosition?: number,
) {
    const activeViewPosition = state.scrollingTo?.viewPosition ?? targetViewPosition;
    const shouldCompensateNegativeInitialScrollRebase =
        !!state.queuedInitialLayout &&
        !!state.scrollingTo?.isInitialScroll &&
        activeViewPosition === 1 &&
        state.scroll < 0;

    return shouldCompensateNegativeInitialScrollRebase ? rawOffset - state.scroll : rawOffset;
}
