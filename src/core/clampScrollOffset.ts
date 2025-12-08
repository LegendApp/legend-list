import { getContentSize, type StateContext } from "@/state/state";

export function clampScrollOffset(ctx: StateContext, offset: number) {
    const state = ctx.state!;
    const contentSize = getContentSize(ctx);
    let clampedOffset = offset;
    if (Number.isFinite(contentSize) && Number.isFinite(state.scrollLength)) {
        const maxOffset = Math.max(0, contentSize - state.scrollLength);
        clampedOffset = Math.min(offset, maxOffset);
    }
    clampedOffset = Math.max(0, clampedOffset);
    return clampedOffset;
}
