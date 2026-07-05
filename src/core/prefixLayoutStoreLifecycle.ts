import { addTotalSize } from "@/core/addTotalSize";
import { PrefixLayoutStore } from "@/core/PrefixLayoutStore";
import type { StateContext } from "@/state/state";
import { getId } from "@/utils/getId";

const ENABLE_PREFIX_LAYOUT_STORE = true;

export function clearPrefixLayoutStoreMeasurements(ctx: StateContext) {
    ctx.state.layoutStore?.clearMeasurements();
}

export function getActivePrefixLayoutStore(ctx: StateContext) {
    let store: PrefixLayoutStore | undefined;
    if (isPrefixLayoutStoreSupported(ctx)) {
        store = ctx.state.layoutStore;
    }
    return store;
}

export function materializePrefixLayoutStoreOffsetRange(ctx: StateContext, startOffset: number, endOffset: number) {
    const store = getActivePrefixLayoutStore(ctx);
    let range: { end: number; start: number } | undefined;
    if (store && store.length > 0) {
        const dataLength = ctx.state.props.data.length;
        const start = store.findIndexAtOffset(startOffset) ?? dataLength - 1;
        const end = store.findIndexAtOffset(endOffset) ?? dataLength - 1;
        range = materializePrefixLayoutStoreRange(ctx, start, Math.max(start, end));
    }
    return range;
}

export function materializePrefixLayoutStoreRange(ctx: StateContext, startIndex: number, endIndex: number) {
    const state = ctx.state;
    const store = getActivePrefixLayoutStore(ctx);
    let range: { end: number; start: number } | undefined;

    if (store) {
        const layouts = store.materializeRange(startIndex, endIndex);
        for (const layout of layouts) {
            const id = state.idCache[layout.index] ?? getId(state, layout.index);
            state.positions[layout.index] = layout.offset;
            state.indexByKey.set(id, layout.index);
            state.sizes.set(id, layout.size);
        }

        if (layouts.length > 0) {
            range = {
                end: layouts[layouts.length - 1].index,
                start: layouts[0].index,
            };
        }
    }

    return range;
}

export function setPrefixLayoutStoreMeasuredSize(
    ctx: StateContext,
    index: number | undefined,
    key: string,
    size: number,
) {
    const store = getActivePrefixLayoutStore(ctx);
    let didSet = false;
    if (store && index !== undefined && index >= 0 && index < store.length) {
        store.setMeasuredSize(index, key, size);
        ctx.state.sizes.set(key, size);
        syncPrefixLayoutStoreTotalSize(ctx);
        didSet = true;
    }
    return didSet;
}

export function isPrefixLayoutStoreSupported(ctx: StateContext) {
    const state = ctx.state;
    const {
        props: { horizontal, numColumns, overrideItemLayout, positionComponentInternal, snapToIndices },
    } = state;

    return (
        ENABLE_PREFIX_LAYOUT_STORE &&
        !horizontal &&
        numColumns === 1 &&
        !overrideItemLayout &&
        !snapToIndices?.length &&
        !positionComponentInternal &&
        ctx.positionListeners.size === 0
    );
}

export function syncPrefixLayoutStore(ctx: StateContext) {
    const state = ctx.state;
    if (isPrefixLayoutStoreSupported(ctx)) {
        const estimatedSize = getPrefixLayoutStoreEstimatedSize(ctx);
        if (state.layoutStore) {
            state.layoutStore.resize(state.props.data.length);
            state.layoutStore.flushEstimatedSize(estimatedSize);
        } else {
            state.layoutStore = new PrefixLayoutStore(state.props.data.length, estimatedSize);
        }
    } else {
        state.layoutStore = undefined;
    }

    return state.layoutStore;
}

export function syncPrefixLayoutStoreTotalSize(ctx: StateContext) {
    const store = getActivePrefixLayoutStore(ctx);
    let didSync = false;
    if (store) {
        addTotalSize(ctx, null, store.getTotalSize());
        didSync = true;
    }
    return didSync;
}

function getPrefixLayoutStoreEstimatedSize(ctx: StateContext) {
    return (ctx.state.props.estimatedItemSize ?? 100) + ctx.scrollAxisGap;
}
