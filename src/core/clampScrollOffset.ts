import { getContentSize, type StateContext } from "@/state/state";
import type { InternalState } from "@/types";

export function clampScrollOffset(ctx: StateContext, state: InternalState, offset: number) {
    const contentSize = getContentSize(ctx);
    let clampedOffset = offset;
    if (Number.isFinite(contentSize) && Number.isFinite(state.scrollLength)) {
        const maxOffset = Math.max(0, contentSize - state.scrollLength);
        clampedOffset = Math.min(offset, maxOffset);
    }
    clampedOffset = Math.max(0, clampedOffset);
    return clampedOffset;
}
