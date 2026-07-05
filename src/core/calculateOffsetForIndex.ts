import { getLayoutOffset } from "@/core/layoutAccessors";
import type { StateContext } from "@/state/state";

export function calculateOffsetForIndex(ctx: StateContext, index: number | undefined) {
    return getLayoutOffset(ctx, index) ?? 0;
}
