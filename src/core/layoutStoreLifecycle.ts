import { addTotalSize } from "@/core/addTotalSize";
import { getDataItem, getDataLength, getIndexedData } from "@/core/IndexedData";
import type { LayoutStoreSizeEntry } from "@/core/LayoutStore";
import { type ActiveLayoutStore, LayoutStoreRuntime, type RowSpanCacheInput } from "@/core/LayoutStoreRuntime";
import { PrefixLayoutStore } from "@/core/PrefixLayoutStore";
import { RowLayoutStore } from "@/core/RowLayoutStore";
import { notifyPosition$, peek$, type StateContext } from "@/state/state";
import type { InternalState } from "@/types.internal";
import { getId } from "@/utils/getId";
import { getScrollVelocity } from "@/utils/getScrollVelocity";
import { hasActiveInitialScroll } from "@/utils/hasActiveInitialScroll";
import { hasActiveMVCPAnchorLock } from "@/utils/hasActiveMVCPAnchorLock";
import { requestAdjust } from "@/utils/requestAdjust";
import { updateSnapToOffsets } from "@/utils/updateSnapToOffsets";

const INITIAL_ESTIMATE_FLUSH_THRESHOLD = 1;
const INITIAL_ESTIMATE_FLUSH_MIN_MEASUREMENTS = 2;
const PERIODIC_ESTIMATE_FLUSH_DELAY = 250;
const PERIODIC_ESTIMATE_FLUSH_MAX_VELOCITY = 0.25;
const PERIODIC_ESTIMATE_FLUSH_MIN_NEW_MEASUREMENTS = 4;

interface LayoutStoreSeed {
    estimatedSize: number;
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
    store.setEstimatedSize(seed.estimatedSize);
    store.replaceKnownSizeEntries(seed.sizeEntries);
}

function getMaterializeRange(state: InternalState, fallbackStart: number, fallbackEnd: number) {
    const start =
        typeof state.startBuffered === "number" && state.startBuffered >= 0 ? state.startBuffered : fallbackStart;
    const end = typeof state.endBuffered === "number" && state.endBuffered >= start ? state.endBuffered : fallbackEnd;
    return { end, start };
}

function flushLayoutStoreEstimate(
    ctx: StateContext,
    estimatedSize: number,
    anchorIndex: number,
    options?: { requireAnchorCorrection?: boolean },
) {
    const state = ctx.state;
    const store = getActiveLayoutStore(ctx);
    let didFlush = false;

    if (
        store &&
        store.length > 0 &&
        Math.abs(estimatedSize - store.getEstimatedSize()) > INITIAL_ESTIMATE_FLUSH_THRESHOLD
    ) {
        const canCorrectAnchor = state.didContainersLayout && state.props.maintainVisibleContentPosition.size;
        if (!options?.requireAnchorCorrection || anchorIndex === 0 || canCorrectAnchor) {
            const clampedAnchorIndex = Math.min(Math.max(anchorIndex, 0), store.length - 1);
            const oldAnchorTop = store.getOffset(clampedAnchorIndex);
            store.setEstimatedSize(estimatedSize);
            syncLayoutStoreState(ctx);
            const newAnchorTop = store.getOffset(clampedAnchorIndex);
            const positionDiff = newAnchorTop - oldAnchorTop;

            if (canCorrectAnchor) {
                requestAdjust(ctx, positionDiff);
            }

            const range = getMaterializeRange(state, clampedAnchorIndex, clampedAnchorIndex);
            materializeLayoutStoreRange(ctx, range.start, range.end);
            didFlush = true;
        }
    }

    return didFlush;
}

export function maybeFlushInitialLayoutStoreEstimate(ctx: StateContext) {
    const state = ctx.state;
    const runtime = getActiveLayoutStoreRuntime(ctx);
    const store = runtime?.store;
    let didFlush = false;
    const startNoBuffer = state.startNoBuffer;
    const endNoBuffer = state.endNoBuffer;

    if (
        store &&
        !runtime.didFlushInitialEstimate &&
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
            runtime.didFlushInitialEstimate = true;
            runtime.lastFlushedEstimateMeasurementCount = store.getMeasuredCount();
            const nextEstimate = totalMeasuredSize / measuredCount;
            didFlush = flushLayoutStoreEstimate(ctx, nextEstimate, startNoBuffer);
        }
    }

    return didFlush;
}

function hasEnoughNewMeasurementsForPeriodicFlush(runtime: LayoutStoreRuntime) {
    const store = runtime.store;
    const lastMeasuredCount = runtime.lastFlushedEstimateMeasurementCount;
    return store.getMeasuredCount() - lastMeasuredCount >= PERIODIC_ESTIMATE_FLUSH_MIN_NEW_MEASUREMENTS;
}

function shouldDeferPeriodicEstimateFlush(state: InternalState) {
    const recentScrollAge = state.scrollTime > 0 ? Date.now() - state.scrollTime : Number.POSITIVE_INFINITY;
    return (
        !state.didContainersLayout ||
        hasActiveInitialScroll(state) ||
        !!state.queuedInitialLayout ||
        !!state.scrollingTo ||
        !!state.pendingScrollToEnd ||
        !!state.pendingLayoutEffectMeasurements?.size ||
        !!state.userScrollAnchorReset?.keys.size ||
        hasActiveMVCPAnchorLock(state) ||
        recentScrollAge < PERIODIC_ESTIMATE_FLUSH_DELAY ||
        Math.abs(getScrollVelocity(state)) > PERIODIC_ESTIMATE_FLUSH_MAX_VELOCITY
    );
}

function getEstimateFlushAnchorIndex(state: InternalState) {
    const dataLength = getDataLength(state);
    let anchorIndex: number | undefined;
    if (typeof state.firstFullyOnScreenIndex === "number" && state.firstFullyOnScreenIndex >= 0) {
        anchorIndex = state.firstFullyOnScreenIndex;
    } else if (typeof state.startNoBuffer === "number" && state.startNoBuffer >= 0) {
        anchorIndex = state.startNoBuffer;
    } else if (typeof state.startBuffered === "number" && state.startBuffered >= 0) {
        anchorIndex = state.startBuffered;
    }

    return anchorIndex !== undefined && dataLength > 0 ? Math.min(anchorIndex, dataLength - 1) : undefined;
}

function flushPeriodicLayoutStoreEstimate(ctx: StateContext) {
    const state = ctx.state;
    const runtime = getActiveLayoutStoreRuntime(ctx);
    let didFlush = false;

    if (runtime && hasEnoughNewMeasurementsForPeriodicFlush(runtime)) {
        if (shouldDeferPeriodicEstimateFlush(state)) {
            schedulePeriodicLayoutStoreEstimateFlush(ctx);
        } else {
            const store = runtime.store;
            const measuredAverage = store.getMeasuredAverageSize();
            const anchorIndex = getEstimateFlushAnchorIndex(state);
            runtime.lastFlushedEstimateMeasurementCount = store.getMeasuredCount();

            if (measuredAverage !== undefined && anchorIndex !== undefined) {
                didFlush = flushLayoutStoreEstimate(ctx, measuredAverage, anchorIndex, {
                    requireAnchorCorrection: true,
                });
            }
        }
    }

    return didFlush;
}

export function schedulePeriodicLayoutStoreEstimateFlush(ctx: StateContext) {
    const state = ctx.state;
    const runtime = getActiveLayoutStoreRuntime(ctx);
    let didSchedule = false;

    if (runtime && runtime.queuedEstimateFlush === undefined && hasEnoughNewMeasurementsForPeriodicFlush(runtime)) {
        const timeout = setTimeout(() => {
            runtime.queuedEstimateFlush = undefined;
            state.timeouts.delete(timeout);
            flushPeriodicLayoutStoreEstimate(ctx);
        }, PERIODIC_ESTIMATE_FLUSH_DELAY) as unknown as number;
        runtime.queuedEstimateFlush = timeout;
        state.timeouts.add(timeout);
        didSchedule = true;
    }

    return didSchedule;
}

export function resetLayoutStoreRuntimeState(state: InternalState) {
    state.layoutStoreRuntime?.resetTransientState(state.timeouts);
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

function getLayoutStoreSeedEstimate(input: {
    dataLength: number;
    fallbackSize: number;
    fallbackTotalSize: number;
    measuredCount: number;
    measuredTotalSize: number;
}) {
    const { dataLength, fallbackSize, fallbackTotalSize, measuredCount, measuredTotalSize } = input;
    return measuredCount >= INITIAL_ESTIMATE_FLUSH_MIN_MEASUREMENTS
        ? measuredTotalSize / measuredCount
        : dataLength > 0
          ? fallbackTotalSize / dataLength
          : fallbackSize;
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
                overrideItemLayout(layoutConfig, getDataItem(state, index), index, numColumns, extraData);
                spans[index] = layoutConfig.span;
            }

            store.resize(dataLength, spans, numColumns, spanInvalidationIndex !== undefined);
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
    const { data, estimatedItemSize } = state.props;
    const dataLength = getDataLength(state);
    const fallbackSize = (estimatedItemSize ?? 100) + ctx.scrollAxisGap;
    const sizeEntries: LayoutStoreSeed["sizeEntries"] = [];
    const canSeedKnownSizes = state.sizesKnown.size > 0;
    const canSeedCachedSizes = state.sizes.size > 0;

    if (options.mode === "seed" && !canSeedKnownSizes && !canSeedCachedSizes) {
        return { estimatedSize: fallbackSize, sizeEntries };
    }

    const previousData = state.previousData;
    const statePendingDataComparison = state.pendingDataComparison;
    const pendingDataComparison =
        statePendingDataComparison &&
        statePendingDataComparison.previousData === previousData &&
        statePendingDataComparison.nextData === data
            ? statePendingDataComparison
            : undefined;
    const fallbackTotalSize = dataLength * fallbackSize;
    let hasDuplicateKey = false;
    let measuredCount = 0;
    let measuredTotalSize = 0;
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
            measuredCount++;
            measuredTotalSize += knownSize;
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
        estimatedSize: getLayoutStoreSeedEstimate({
            dataLength,
            fallbackSize,
            fallbackTotalSize,
            measuredCount,
            measuredTotalSize,
        }),
        hasDuplicateKey,
        sizeEntries,
    };
}
