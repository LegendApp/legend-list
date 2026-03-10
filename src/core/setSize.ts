import { addTotalSize } from "@/core/addTotalSize";
import type { StateContext } from "@/state/state";

// Persists a measured size and updates totalSize by only the delta from the
// previous known value.
export function setSize(ctx: StateContext, itemKey: string, size: number) {
    const state = ctx.state;
    const { sizes } = state;
    const previousSize = sizes.get(itemKey);
    const diff = previousSize !== undefined ? size - previousSize : size;
    if (diff !== 0) {
        addTotalSize(ctx, itemKey, diff);
    }

    // Save to rendered sizes
    sizes.set(itemKey, size);
}
