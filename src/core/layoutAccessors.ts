import type { PrefixLayoutStore } from "@/core/PrefixLayoutStore";
import { getActivePrefixLayoutStore } from "@/core/prefixLayoutStoreLifecycle";
import type { StateContext } from "@/state/state";
import type { InternalState } from "@/types.internal";
import { getId } from "@/utils/getId";
import { getItemSize } from "@/utils/getItemSize";

export interface LayoutAccess {
    getOffset(index: number | undefined): number | undefined;
    getSize(index: number | undefined): number | undefined;
}

export function createLayoutAccess(ctx: StateContext, store: PrefixLayoutStore | undefined): LayoutAccess {
    return {
        getOffset(index) {
            return getLayoutOffsetForStore(ctx.state, store, index);
        },
        getSize(index) {
            return getLayoutSizeForStore(ctx, ctx.state, store, index);
        },
    };
}

export function getLayoutOffset(ctx: StateContext, index: number | undefined) {
    const store = getActivePrefixLayoutStore(ctx);
    return getLayoutOffsetForStore(ctx.state, store, index);
}

export function getLayoutSize(ctx: StateContext, index: number | undefined) {
    const store = getActivePrefixLayoutStore(ctx);
    return getLayoutSizeForStore(ctx, ctx.state, store, index);
}

function getLayoutOffsetForStore(
    state: InternalState,
    store: PrefixLayoutStore | undefined,
    index: number | undefined,
) {
    let offset: number | undefined;
    if (store) {
        if (store.hasIndex(index)) {
            offset = store.getOffset(index);
        }
    } else if (isValidArrayOffsetIndex(index)) {
        offset = state.positions[index];
    }
    return offset;
}

function getLayoutSizeForStore(
    ctx: StateContext,
    state: InternalState,
    store: PrefixLayoutStore | undefined,
    index: number | undefined,
) {
    let size: number | undefined;
    if (store) {
        if (store.hasIndex(index)) {
            size = store.getSize(index);
        }
    } else if (isValidArrayIndex(state, index)) {
        const id = state.idCache[index] ?? getId(state, index);
        size = state.sizes.get(id) ?? getItemSize(ctx, id, index, state.props.data[index]);
    }
    return size;
}

function isValidArrayIndex(state: InternalState, index: number | undefined): index is number {
    return index !== undefined && Number.isInteger(index) && index >= 0 && index < state.props.data.length;
}

function isValidArrayOffsetIndex(index: number | undefined): index is number {
    return index !== undefined && Number.isInteger(index) && index >= 0;
}
