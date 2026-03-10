import { peek$, type StateContext } from "@/state/state";

// Returns the fixed top space that item offsets need to account for when aligning
// against the rendered viewport.
export function getTopOffsetAdjustment(ctx: StateContext) {
    return (peek$(ctx, "stylePaddingTop") || 0) + (peek$(ctx, "headerSize") || 0);
}
