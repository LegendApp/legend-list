import { addTotalSize } from "@/core/addTotalSize";
import { getDataItem, getDataLength, getIndexedData } from "@/core/IndexedData";
import type { LayoutStoreSizeEntry } from "@/core/LayoutStore";
import { type ActiveLayoutStore, LayoutStoreRuntime, type RowSpanCacheInput } from "@/core/LayoutStoreRuntime";
import { PrefixLayoutStore } from "@/core/PrefixLayoutStore";
import { RowLayoutStore } from "@/core/RowLayoutStore";
import { notifyPosition$, peek$, type StateContext } from "@/state/state";
import type { InternalState } from "@/types.internal";
import { getId } from "@/utils/getId";
import { updateSnapToOffsets } from "@/utils/updateSnapToOffsets";

interface LayoutStoreSeed {
    hasDuplicateKey?: boolean;
    sizeEntries: LayoutStoreSizeEntry[];
}

interface LayoutStoreSeedOptions {
    didKeyExtractorChange?: boolean;
    mode: "reconcile" | "seed";
    previousIdCache?: SparseIdCacheSnapshot;
}

export interface LayoutStoreDataChangeReconciliationOptions {
    didKeyExtractorChange?: boolean;
    previousIdCache?: SparseIdCacheSnapshot;
}

export type SparseIdCacheSnapshot = Map<number, string>;

export function clearLayoutStoreKnownSizes(ctx: StateContext) {
    ctx.state.layoutStoreRuntime?.store.clearKnownSizes();
    resetLayoutStoreRuntimeState(ctx.state);
}

function getActiveLayoutStoreRuntime(ctx: StateContext) {
    return ctx.state.layoutStoreRuntime;
}

export function getActiveLayoutStore(ctx: StateContext) {
    return getActiveLayoutStoreRuntime(ctx)?.store;
}

export function getSparseIdCacheSnapshot(state: InternalState): SparseIdCacheSnapshot {
    const snapshot: SparseIdCacheSnapshot = new Map();
    for (const key of Object.keys(state.idCache)) {
        const index = Number(key);
        const id = state.idCache[index];
        if (Number.isInteger(index) && id !== undefined) {
            snapshot.set(index, id);
        }
    }
    return snapshot;
}

export function materializeLayoutStoreRange(ctx: StateContext, startIndex: number, endIndex: number) {
    const state = ctx.state;
    const runtime = getActiveLayoutStoreRuntime(ctx);
    const store = runtime?.store;
    let range: { end: number; start: number } | undefined;

    if (store) {
        const start = Math.max(0, Math.trunc(startIndex));
        const end = Math.min(store.length - 1, Math.trunc(endIndex));
        if (start <= end) {
            range = { end, start };
            store.forEachLayout(start, end, (index, offset) => {
                const id = state.idCache[index] ?? getId(state, index);
                if (ctx.positionListeners.has(id)) {
                    notifyLayoutStorePosition(ctx, runtime, id, offset);
                }
                state.indexByKey.set(id, index);
            });
        }
    }

    return range;
}

function applyLayoutStoreSeed(store: ActiveLayoutStore, seed: LayoutStoreSeed) {
    store.replaceKnownSizeEntries(seed.sizeEntries);
}

export function resetLayoutStoreRuntimeState(state: InternalState) {
    state.layoutStoreRuntime?.resetTransientState();
}

export function setLayoutStoreMeasuredSize(ctx: StateContext, index: number | undefined, size: number) {
    const store = getActiveLayoutStore(ctx);
    let didSet = false;
    if (store?.hasIndex(index)) {
        const didChange = store.setMeasuredSize(index, size);
        if (didChange) {
            syncLayoutStoreState(ctx);
        }
        didSet = true;
    }
    return didSet;
}

export function reconcileLayoutStoreDataChange(
    ctx: StateContext,
    options?: LayoutStoreDataChangeReconciliationOptions,
): boolean {
    const state = ctx.state;
    const store = getActiveLayoutStore(ctx);
    let didReconcile = false;

    if (store) {
        const previousIdCache = options?.previousIdCache ?? getSparseIdCacheSnapshot(state);
        state.indexByKey.clear();
        state.idCache.length = 0;
        resetLayoutStoreRuntimeState(state);

        const seed = getLayoutStoreSeed(ctx, {
            didKeyExtractorChange: options?.didKeyExtractorChange,
            mode: "reconcile",
            previousIdCache,
        });

        didReconcile = !seed.hasDuplicateKey;
        if (didReconcile) {
            applyLayoutStoreSeed(store, seed);
        }
    }

    return didReconcile;
}

export function syncActiveRowLayoutStoreSpans(ctx: StateContext) {
    const state = ctx.state;
    const runtime = getActiveLayoutStoreRuntime(ctx);
    const store = runtime?.store;
    const { numColumns, overrideItemLayout } = state.props;
    const dataLength = getDataLength(state);
    let didSync = false;

    if (runtime && store instanceof RowLayoutStore && overrideItemLayout && numColumns > 1) {
        const extraData = peek$(ctx, "extraData");
        const cacheInput = getRowSpanCacheInput(state, extraData);
        const cachedSpans = runtime.getCachedRowSpans(cacheInput);
        const spanInvalidationIndex = state.dataSourceSpanInvalidationIndex;
        if (!cachedSpans || spanInvalidationIndex !== undefined) {
            const layoutConfig = { span: 1 };
            const spans = cachedSpans ?? new Array<number | undefined>(dataLength);
            const startIndex = cachedSpans ? Math.max(0, Math.min(spanInvalidationIndex ?? 0, dataLength)) : 0;

            for (let index = startIndex; index < dataLength; index++) {
                layoutConfig.span = 1;
                const item = getDataItem(state, index);
                if (item !== undefined) {
                    overrideItemLayout(layoutConfig, item, index, numColumns, extraData);
                }
                spans[index] = layoutConfig.span;
            }

            store.resize(dataLength, spans, numColumns, spanInvalidationIndex);
            runtime.setCachedRowSpans(cacheInput, spans);
            state.dataSourceSpanInvalidationIndex = undefined;
            didSync = true;
        }
    } else {
        runtime?.clearRowSpanCache();
    }

    return didSync;
}

export function syncLayoutStoreStructure(ctx: StateContext) {
    const state = ctx.state;
    const estimatedSize = getLayoutStorePropEstimatedSize(ctx);
    const dataLength = getDataLength(state);
    const nextStoreKind = getLayoutStoreKind(state);
    let runtime = state.layoutStoreRuntime;
    if (runtime && getLayoutStoreKindForStore(runtime.store) === nextStoreKind) {
        if (runtime.store instanceof RowLayoutStore) {
            if (!state.dataSourceMutationApplied || state.didColumnsChange) {
                runtime.store.resize(dataLength, getReusableRowSpans(ctx, runtime), state.props.numColumns);
            }
        } else {
            runtime.store.resize(dataLength);
        }
        if (estimatedSize !== runtime.propEstimatedSize) {
            runtime.store.setEstimatedSize(estimatedSize);
        }
    } else {
        const store =
            nextStoreKind === "row"
                ? new RowLayoutStore({
                      estimatedSize,
                      length: dataLength,
                      numColumns: state.props.numColumns,
                  })
                : new PrefixLayoutStore(dataLength, estimatedSize);
        runtime = new LayoutStoreRuntime(store, estimatedSize);
        state.layoutStoreRuntime = runtime;
        if (canSeedLayoutStore(state)) {
            const seed = getLayoutStoreSeed(ctx);
            applyLayoutStoreSeed(runtime.store, seed);
        }
    }
    runtime.propEstimatedSize = estimatedSize;

    return state.layoutStoreRuntime?.store;
}

function getRowSpanCacheInput(state: InternalState, extraData: unknown): RowSpanCacheInput {
    const { dataKey, dataVersion, numColumns, overrideItemLayout } = state.props;
    return {
        data: getIndexedData(state),
        dataKey,
        dataVersion,
        extraData,
        numColumns,
        overrideItemLayout,
    };
}

function canSeedLayoutStore(state: InternalState) {
    return state.sizesKnown.size > 0 || state.sizes.size > 0;
}

function getReusableRowSpans(ctx: StateContext, runtime: LayoutStoreRuntime) {
    const state = ctx.state;
    const { numColumns, overrideItemLayout } = state.props;
    let spans: Array<number | undefined> | undefined;

    if (overrideItemLayout && numColumns > 1) {
        spans = runtime.getCachedRowSpans(getRowSpanCacheInput(state, peek$(ctx, "extraData")));
    } else {
        runtime.clearRowSpanCache();
    }

    return spans;
}

function getLayoutStoreKind(state: InternalState) {
    return state.props.numColumns > 1 ? "row" : "prefix";
}

function getLayoutStoreKindForStore(store: ActiveLayoutStore) {
    return store instanceof RowLayoutStore ? "row" : "prefix";
}

export function rebuildLayoutStoreExact(ctx: StateContext) {
    const state = ctx.state;
    const store = syncLayoutStoreStructure(ctx);
    if (store) {
        const seed = getLayoutStoreSeed(ctx);
        applyLayoutStoreSeed(store, seed);
    }
    return state.layoutStoreRuntime?.store;
}

export function syncLayoutStoreState(ctx: StateContext) {
    const runtime = getActiveLayoutStoreRuntime(ctx);
    let didSync = false;
    if (runtime) {
        const store = runtime.store;
        addTotalSize(ctx, null, store.getTotalSize());
        if (ctx.state.props.snapToIndices) {
            updateSnapToOffsets(ctx);
        }
        syncLayoutStorePositionListeners(ctx, runtime);
        didSync = true;
    }
    return didSync;
}

function syncLayoutStorePositionListeners(ctx: StateContext, runtime: LayoutStoreRuntime) {
    const state = ctx.state;
    const store = runtime.store;

    if (ctx.positionListeners.size > 0) {
        for (const [key] of ctx.positionListeners) {
            const index = state.indexByKey.get(key);
            if (store.hasIndex(index)) {
                notifyLayoutStorePosition(ctx, runtime, key, store.getOffset(index));
            }
        }
    }
}

function notifyLayoutStorePosition(ctx: StateContext, runtime: LayoutStoreRuntime, key: string, offset: number) {
    let offsets = runtime.positionListenerOffsets;
    if (!offsets) {
        offsets = new Map();
        runtime.positionListenerOffsets = offsets;
    }
    if (offsets.get(key) !== offset) {
        offsets.set(key, offset);
        notifyPosition$(ctx, key, offset);
    }
}

function getLayoutStorePropEstimatedSize(ctx: StateContext) {
    return (ctx.state.props.estimatedItemSize ?? 100) + ctx.scrollAxisGap;
}

function getLayoutStoreSeed(ctx: StateContext, options: LayoutStoreSeedOptions = { mode: "seed" }): LayoutStoreSeed {
    const state = ctx.state;
    const { data } = state.props;
    const dataLength = getDataLength(state);
    const sizeEntries: LayoutStoreSeed["sizeEntries"] = [];
    const canSeedKnownSizes = state.sizesKnown.size > 0;
    const canSeedCachedSizes = state.sizes.size > 0;

    if (options.mode === "seed" && !canSeedKnownSizes && !canSeedCachedSizes) {
        return { sizeEntries };
    }

    const previousData = state.previousData;
    const statePendingDataComparison = state.pendingDataComparison;
    const pendingDataComparison =
        statePendingDataComparison &&
        statePendingDataComparison.previousData === previousData &&
        statePendingDataComparison.nextData === data
            ? statePendingDataComparison
            : undefined;
    let hasDuplicateKey = false;
    const dataLengthDelta = previousData ? dataLength - previousData.length : 0;

    const materializedIndices =
        options.mode === "reconcile" ? options.previousIdCache?.keys() : getSparseIdCacheSnapshot(state).keys();

    for (const index of materializedIndices ?? []) {
        const isIndexInRange = index >= 0 && index < dataLength;
        if (!isIndexInRange && options.mode !== "reconcile") {
            continue;
        }
        const previousKey = options.previousIdCache?.get(index);
        const canReusePreviousKey =
            isIndexInRange &&
            options.mode === "reconcile" &&
            !options.didKeyExtractorChange &&
            previousKey !== undefined &&
            previousData !== undefined &&
            (previousData[index] === getDataItem(state, index) || pendingDataComparison?.byIndex[index] !== undefined);
        let shouldSeedKey = isIndexInRange;
        let targetIndex = index;
        let key = canReusePreviousKey ? previousKey : isIndexInRange ? getId(state, index) : previousKey;
        if (
            options.mode === "reconcile" &&
            !canReusePreviousKey &&
            !options.didKeyExtractorChange &&
            previousKey !== undefined &&
            (!isIndexInRange || key !== previousKey)
        ) {
            shouldSeedKey = dataLengthDelta === 0 && isIndexInRange;
            if (dataLengthDelta !== 0) {
                const shiftedIndex = index + dataLengthDelta;
                if (shiftedIndex >= 0 && shiftedIndex < dataLength) {
                    const shiftedKey = state.idCache[shiftedIndex] ?? getId(state, shiftedIndex);
                    if (shiftedKey === previousKey) {
                        shouldSeedKey = true;
                        targetIndex = shiftedIndex;
                        key = previousKey;
                    }
                }
            }
        }

        if (!shouldSeedKey || key === undefined) {
            continue;
        }

        if (options.mode === "reconcile") {
            state.idCache[targetIndex] = key;
            if (state.indexByKey.has(key)) {
                hasDuplicateKey = true;
                break;
            }
            state.indexByKey.set(key, targetIndex);
        }

        const knownSize = canSeedKnownSizes ? state.sizesKnown.get(key) : undefined;
        if (knownSize !== undefined) {
            sizeEntries.push({
                index: targetIndex,
                size: knownSize,
                type: "measured",
            });
        } else {
            const cachedSize = canSeedCachedSizes ? state.sizes.get(key) : undefined;

            if (cachedSize !== undefined) {
                sizeEntries.push({
                    index: targetIndex,
                    size: cachedSize,
                    type: "cached",
                });
            }
        }
    }

    return {
        hasDuplicateKey,
        sizeEntries,
    };
}
