import { addTotalSize } from "@/core/addTotalSize";
import { PrefixLayoutStore } from "@/core/PrefixLayoutStore";
import type { StateContext } from "@/state/state";
import { getId } from "@/utils/getId";
import { requestAdjust } from "@/utils/requestAdjust";

const ENABLE_PREFIX_LAYOUT_STORE = true;
const INITIAL_ESTIMATE_FLUSH_THRESHOLD = 1;
const INITIAL_ESTIMATE_FLUSH_MIN_MEASUREMENTS = 2;

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

export function maybeFlushInitialPrefixLayoutEstimate(ctx: StateContext) {
    const state = ctx.state;
    const store = getActivePrefixLayoutStore(ctx);
    let didFlush = false;
    const startNoBuffer = state.startNoBuffer;
    const endNoBuffer = state.endNoBuffer;

    if (
        store &&
        !state.didFlushInitialLayoutStoreEstimate &&
        typeof startNoBuffer === "number" &&
        typeof endNoBuffer === "number" &&
        startNoBuffer >= 0 &&
        endNoBuffer >= startNoBuffer
    ) {
        let totalMeasuredSize = 0;
        let measuredCount = 0;
        let areAllVisibleSizesKnown = true;

        for (let index = startNoBuffer; index <= endNoBuffer; index++) {
            const id = state.idCache[index] ?? getId(state, index);
            const size = state.sizesKnown.get(id);
            if (size === undefined) {
                areAllVisibleSizesKnown = false;
                break;
            }
            if (size > 0) {
                totalMeasuredSize += size;
                measuredCount++;
            }
        }

        if (areAllVisibleSizesKnown && measuredCount >= INITIAL_ESTIMATE_FLUSH_MIN_MEASUREMENTS) {
            state.didFlushInitialLayoutStoreEstimate = true;
            const nextEstimate = totalMeasuredSize / measuredCount;
            const previousEstimate = store.getEstimatedSize();
            if (Math.abs(nextEstimate - previousEstimate) > INITIAL_ESTIMATE_FLUSH_THRESHOLD) {
                const anchorIndex = startNoBuffer;
                const oldAnchorTop = state.positions[anchorIndex] ?? store.getOffset(anchorIndex);
                store.flushEstimatedSize(nextEstimate);
                syncPrefixLayoutStoreTotalSize(ctx);
                const newAnchorTop = store.getOffset(anchorIndex);
                const positionDiff = newAnchorTop - oldAnchorTop;

                if (state.didContainersLayout && state.props.maintainVisibleContentPosition.size) {
                    requestAdjust(ctx, positionDiff);
                }

                const materializeStart =
                    typeof state.startBuffered === "number" && state.startBuffered >= 0
                        ? state.startBuffered
                        : startNoBuffer;
                const materializeEnd =
                    typeof state.endBuffered === "number" && state.endBuffered >= materializeStart
                        ? state.endBuffered
                        : endNoBuffer;
                materializePrefixLayoutStoreRange(ctx, materializeStart, materializeEnd);
                didFlush = true;
            }
        }
    }

    return didFlush;
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
