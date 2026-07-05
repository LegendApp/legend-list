import { addTotalSize } from "@/core/addTotalSize";
import {
    getActivePrefixLayoutStore,
    materializePrefixLayoutStoreOffsetRange,
    materializePrefixLayoutStoreRange,
    setPrefixLayoutStoreMeasuredSize,
} from "@/core/prefixLayoutStoreLifecycle";
import { setSize } from "@/core/setSize";
import { getContentSize } from "@/state/getContentSize";
import type { StateContext } from "@/state/state";
import type { InternalState } from "@/types.internal";
import { getId } from "@/utils/getId";
import { getItemSize } from "@/utils/getItemSize";
import { toNativeHorizontalOffset } from "@/utils/rtl";

export interface MaterializedLayoutRange {
    end: number;
    start: number;
}

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

export function getLayoutItemTotalSize(ctx: StateContext, state: InternalState = ctx.state) {
    const layoutStore = state === ctx.state ? getActivePrefixLayoutStore(ctx) : state.layoutStore;
    return layoutStore ? layoutStore.getTotalSize() : state.totalSize;
}

export function getLayoutContentSize(ctx: StateContext) {
    return getContentSize(ctx);
}

export function getLayoutSnapOffsets(ctx: StateContext, snapToIndices = ctx.state.props.snapToIndices ?? []) {
    const state = ctx.state;
    const contentSize = state.props.horizontal ? getContentSize(ctx) : undefined;
    const snapToOffsets: number[] = Array<number>(snapToIndices.length);

    for (let i = 0; i < snapToIndices.length; i++) {
        const index = snapToIndices[i];
        getId(state, index);
        const logicalOffset = getLayoutOffset(ctx, index);
        snapToOffsets[i] =
            logicalOffset === undefined
                ? (undefined as unknown as number)
                : toNativeHorizontalOffset(state, logicalOffset, contentSize);
    }

    return snapToOffsets;
}

export function materializeLayoutOffsetRange(ctx: StateContext, startOffset: number, endOffset: number) {
    return materializePrefixLayoutStoreOffsetRange(ctx, startOffset, endOffset);
}

export function materializeLayoutRange(ctx: StateContext, startIndex: number, endIndex: number) {
    return materializePrefixLayoutStoreRange(ctx, startIndex, endIndex);
}

export function recordLayoutMeasuredSize(ctx: StateContext, index: number | undefined, key: string, size: number) {
    let didUsePrefixStore = false;

    if (setPrefixLayoutStoreMeasuredSize(ctx, index, key, size)) {
        didUsePrefixStore = true;
    } else {
        setSize(ctx, key, size);
    }

    return didUsePrefixStore;
}

export function syncLayoutItemTotalSize(ctx: StateContext) {
    const store = getActivePrefixLayoutStore(ctx);
    let didSync = false;

    if (store) {
        addTotalSize(ctx, null, store.getTotalSize());
        didSync = true;
    }

    return didSync;
}
