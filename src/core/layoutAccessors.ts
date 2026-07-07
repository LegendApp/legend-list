import type { LayoutStore } from "@/core/LayoutStore";
import { getActiveLayoutStore } from "@/core/layoutStoreLifecycle";
import type { StateContext } from "@/state/state";
import type { InternalState } from "@/types.internal";
import { getId } from "@/utils/getId";
import { getItemSize } from "@/utils/getItemSize";

export interface LayoutAccess {
    getColumn(index: number | undefined): number | undefined;
    getOffset(index: number | undefined): number | undefined;
    getSize(index: number | undefined): number | undefined;
    getSpan(index: number | undefined): number | undefined;
}

export function createLayoutAccess(ctx: StateContext, store: LayoutStore | undefined): LayoutAccess {
    return {
        getColumn(index) {
            return getLayoutColumnForStore(ctx.state, store, index);
        },
        getOffset(index) {
            return getLayoutOffsetForStore(ctx.state, store, index);
        },
        getSize(index) {
            return getLayoutSizeForStore(ctx, ctx.state, store, index);
        },
        getSpan(index) {
            return getLayoutSpanForStore(ctx.state, store, index);
        },
    };
}

export function getLayoutColumn(ctx: StateContext, index: number | undefined) {
    const store = getActiveLayoutStore(ctx);
    return getLayoutColumnForStore(ctx.state, store, index);
}

export function getLayoutOffset(ctx: StateContext, index: number | undefined) {
    const store = getActiveLayoutStore(ctx);
    return getLayoutOffsetForStore(ctx.state, store, index);
}

export function getLayoutSize(ctx: StateContext, index: number | undefined) {
    const store = getActiveLayoutStore(ctx);
    return getLayoutSizeForStore(ctx, ctx.state, store, index);
}

export function getLayoutSpan(ctx: StateContext, index: number | undefined) {
    const store = getActiveLayoutStore(ctx);
    return getLayoutSpanForStore(ctx.state, store, index);
}

function getLayoutColumnForStore(state: InternalState, store: LayoutStore | undefined, index: number | undefined) {
    let column: number | undefined;
    if (hasColumnLayout(store)) {
        if (store.hasIndex(index)) {
            column = store.getColumn(index);
        }
    } else if (isValidArrayIndex(state, index)) {
        column = state.arrayLayout.columns[index];
    }
    return column;
}

function getLayoutOffsetForStore(state: InternalState, store: LayoutStore | undefined, index: number | undefined) {
    let offset: number | undefined;
    if (store) {
        if (store.hasIndex(index)) {
            offset = store.getOffset(index);
        }
    } else if (isValidArrayOffsetIndex(index)) {
        offset = state.arrayLayout.positions[index];
    }
    return offset;
}

function getLayoutSizeForStore(
    ctx: StateContext,
    state: InternalState,
    store: LayoutStore | undefined,
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

function getLayoutSpanForStore(state: InternalState, store: LayoutStore | undefined, index: number | undefined) {
    let span: number | undefined;
    if (hasColumnLayout(store)) {
        if (store.hasIndex(index)) {
            span = store.getSpan(index);
        }
    } else if (isValidArrayIndex(state, index)) {
        span = state.arrayLayout.columnSpans[index];
    }
    return span;
}

function hasColumnLayout(
    store: LayoutStore | undefined,
): store is LayoutStore & { getColumn(index: number): number; getSpan(index: number): number } {
    return !!store && "getColumn" in store && "getSpan" in store;
}

function isValidArrayIndex(state: InternalState, index: number | undefined): index is number {
    return index !== undefined && Number.isInteger(index) && index >= 0 && index < state.props.data.length;
}

function isValidArrayOffsetIndex(index: number | undefined): index is number {
    return index !== undefined && Number.isInteger(index) && index >= 0;
}
