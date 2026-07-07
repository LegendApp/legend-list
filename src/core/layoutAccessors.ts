import { getSnapOffsetsForLayout } from "@/core/layoutSnapOffsets";
import type { PrefixLayoutStore } from "@/core/PrefixLayoutStore";
import { getActivePrefixLayoutStore, syncPrefixLayoutStoreTotalSize } from "@/core/prefixLayoutStoreLifecycle";
import type { StateContext } from "@/state/state";
import type { InternalState } from "@/types.internal";
import { getId } from "@/utils/getId";
import { getItemSize } from "@/utils/getItemSize";

export interface LayoutAccess {
    hasPrefixStore: boolean;
    getOffset(index: number | undefined): number | undefined;
    getSize(index: number | undefined): number | undefined;
}

export function createLayoutAccess(
    ctx: StateContext,
    store: PrefixLayoutStore | undefined,
    state: InternalState = ctx.state,
): LayoutAccess {
    return {
        getOffset(index) {
            return getLayoutOffsetForStore(state, store, index);
        },
        getSize(index) {
            return getLayoutSizeForStore(ctx, state, store, index);
        },
        hasPrefixStore: !!store,
    };
}

export function getLayoutOffset(ctx: StateContext, index: number | undefined, state: InternalState = ctx.state) {
    const store = getPrefixLayoutStore(ctx, state);
    return getLayoutOffsetForStore(state, store, index);
}

export function getLayoutSize(ctx: StateContext, index: number | undefined, state: InternalState = ctx.state) {
    const store = getPrefixLayoutStore(ctx, state);
    return getLayoutSizeForStore(ctx, state, store, index);
}

export function getLayoutEnd(ctx: StateContext, index: number | undefined, state: InternalState = ctx.state) {
    const store = getPrefixLayoutStore(ctx, state);
    const offset = getLayoutOffsetForStore(state, store, index);
    const size = getLayoutSizeForStore(ctx, state, store, index);
    return offset !== undefined && size !== undefined ? offset + size : undefined;
}

export function getLayoutSnapOffsets(ctx: StateContext, snapToIndices = ctx.state.props.snapToIndices!) {
    return getSnapOffsetsForLayout(ctx, snapToIndices, (index) => getLayoutOffset(ctx, index));
}

export function syncLayoutItemTotalSize(ctx: StateContext) {
    return syncPrefixLayoutStoreTotalSize(ctx);
}

function getPrefixLayoutStore(ctx: StateContext, state: InternalState) {
    return state === ctx.state ? getActivePrefixLayoutStore(ctx) : state.layoutStore;
}

function getLayoutOffsetForStore(
    state: InternalState,
    store: PrefixLayoutStore | undefined,
    index: number | undefined,
) {
    let offset: number | undefined;
    if (store) {
        if (isValidPrefixIndex(store, index)) {
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
        if (isValidPrefixIndex(store, index)) {
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

function isValidPrefixIndex(store: PrefixLayoutStore, index: number | undefined): index is number {
    return index !== undefined && Number.isInteger(index) && index >= 0 && index < store.length;
}
