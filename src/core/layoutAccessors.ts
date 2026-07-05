import { getActivePrefixLayoutStore } from "@/core/prefixLayoutStoreLifecycle";
import type { StateContext } from "@/state/state";
import type { InternalState } from "@/types.internal";
import { getId } from "@/utils/getId";
import { getItemSize } from "@/utils/getItemSize";

export function getLayoutOffset(ctx: StateContext, index: number | undefined, state: InternalState = ctx.state) {
    let offset: number | undefined;

    if (index !== undefined && index >= 0) {
        const layoutStore = state === ctx.state ? getActivePrefixLayoutStore(ctx) : state.layoutStore;
        offset = layoutStore && index < state.props.data.length ? layoutStore.getOffset(index) : state.positions[index];
    }

    return offset;
}

export function getLayoutSize(ctx: StateContext, index: number | undefined, state: InternalState = ctx.state) {
    let size: number | undefined;

    if (index !== undefined && index >= 0 && index < state.props.data.length) {
        const layoutStore = state === ctx.state ? getActivePrefixLayoutStore(ctx) : state.layoutStore;
        if (layoutStore) {
            size = layoutStore.getSize(index);
        } else {
            const id = state.idCache[index] ?? getId(state, index);
            size = state.sizes.get(id) ?? getItemSize(ctx, id, index, state.props.data[index]);
        }
    }

    return size;
}

export function getLayoutEnd(ctx: StateContext, index: number | undefined, state: InternalState = ctx.state) {
    const offset = getLayoutOffset(ctx, index, state);
    const size = getLayoutSize(ctx, index, state);
    return offset !== undefined && size !== undefined ? offset + size : undefined;
}
