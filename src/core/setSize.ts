import { addTotalSize } from "@/core/addTotalSize";
import type { StateContext } from "@/state/state";

export function setSize(ctx: StateContext, itemKey: string, size: number, notifyTotalSize = true) {
    const state = ctx.state;
    const { sizes } = state;
    if (!state.layoutStoreRuntime) {
        const diff = size - (sizes.get(itemKey) ?? 0);
        if (diff !== 0) addTotalSize(ctx, itemKey, diff, notifyTotalSize);
    }

    // Save to rendered sizes
    sizes.set(itemKey, size);
}
