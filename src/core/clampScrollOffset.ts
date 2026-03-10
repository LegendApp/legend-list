import { Platform } from "@/platform/Platform";
import { getContentSize } from "@/state/getContentSize";
import type { StateContext } from "@/state/state";
import type { ScrollTarget } from "@/types.base";

// Clamps a target scroll offset to the current content bounds, including negative
// view offsets that intentionally allow extra space at the end.
export function clampScrollOffset(ctx: StateContext, offset: number, scrollTarget?: Partial<ScrollTarget>) {
    const state = ctx.state;
    const contentSize = getContentSize(ctx);
    let clampedOffset = offset;
    if (
        Number.isFinite(contentSize) &&
        Number.isFinite(state.scrollLength) &&
        (Platform.OS !== "android" || state.lastLayout)
    ) {
        const baseMaxOffset = Math.max(0, contentSize - state.scrollLength);
        const viewOffset = scrollTarget?.viewOffset;
        const extraEndOffset = typeof viewOffset === "number" && viewOffset < 0 ? -viewOffset : 0;
        const maxOffset = baseMaxOffset + extraEndOffset;
        clampedOffset = Math.min(offset, maxOffset);
    }
    clampedOffset = Math.max(0, clampedOffset);
    return clampedOffset;
}
