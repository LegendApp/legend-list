import { peek$, type StateContext } from "@/state/state";

export function getTopOffsetAdjustment(ctx: StateContext) {
    return (peek$(ctx, "stylePaddingTop") || 0) + (peek$(ctx, "headerSize") || 0);
}
