import { getActivePrefixLayoutStore } from "@/core/prefixLayoutStoreLifecycle";
import type { StateContext } from "@/state/state";

export function calculateOffsetForIndex(ctx: StateContext, index: number | undefined) {
    const state = ctx.state;
    const layoutStore = getActivePrefixLayoutStore(ctx);
    const canUseLayoutStore =
        layoutStore !== undefined && index !== undefined && index >= 0 && index < state.props.data.length;
    return index !== undefined ? (canUseLayoutStore ? layoutStore.getOffset(index) : state.positions[index] || 0) : 0;
}
