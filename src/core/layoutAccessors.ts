import type { LayoutStore } from "@/core/LayoutStore";
import type { StateContext } from "@/state/state";

export function getLayoutColumn(ctx: StateContext, index: number | undefined) {
    const store = ctx.state.layoutStoreRuntime?.store;
    return getLayoutColumnForStore(store, index);
}

export function getLayoutOffset(ctx: StateContext, index: number | undefined) {
    const store = ctx.state.layoutStoreRuntime?.store;
    return getLayoutOffsetForStore(store, index);
}

export function getLayoutSize(ctx: StateContext, index: number | undefined) {
    const store = ctx.state.layoutStoreRuntime?.store;
    return getLayoutSizeForStore(store, index);
}

export function getLayoutSpan(ctx: StateContext, index: number | undefined) {
    const store = ctx.state.layoutStoreRuntime?.store;
    return getLayoutSpanForStore(store, index);
}

export function getLayoutColumnForStore(store: LayoutStore | undefined, index: number | undefined) {
    let column: number | undefined;
    if (hasColumnLayout(store) && store.hasIndex(index)) {
        column = store.getColumn(index);
    }
    return column;
}

export function getLayoutOffsetForStore(store: LayoutStore | undefined, index: number | undefined) {
    let offset: number | undefined;
    if (store?.hasIndex(index)) {
        offset = store.getOffset(index);
    }
    return offset;
}

export function getLayoutSizeForStore(store: LayoutStore | undefined, index: number | undefined) {
    let size: number | undefined;
    if (store?.hasIndex(index)) {
        size = store.getSize(index);
    }
    return size;
}

export function getLayoutSpanForStore(store: LayoutStore | undefined, index: number | undefined) {
    let span: number | undefined;
    if (hasColumnLayout(store) && store.hasIndex(index)) {
        span = store.getSpan(index);
    }
    return span;
}

function hasColumnLayout(
    store: LayoutStore | undefined,
): store is LayoutStore & { getColumn(index: number): number; getSpan(index: number): number } {
    return !!store && "getColumn" in store && "getSpan" in store;
}
