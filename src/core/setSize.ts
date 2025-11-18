import { addTotalSize } from "@/core/addTotalSize";
import type { StateContext } from "@/state/state";
import type { InternalState } from "@/types";

export function setSize(ctx: StateContext, state: InternalState, itemKey: string, size: number) {
    const { sizes } = state;
    const previousSize = sizes.get(itemKey);
    const diff = previousSize !== undefined ? size - previousSize : size;
    if (diff !== 0) {
        addTotalSize(ctx, state, itemKey, diff);
    }

    // Save to rendered sizes
    sizes.set(itemKey, size);
}
