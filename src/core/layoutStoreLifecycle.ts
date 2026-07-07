import { addTotalSize } from "@/core/addTotalSize";
import type { LayoutStoreSizeEntry } from "@/core/LayoutStore";
import { type ActiveLayoutStore, LayoutStoreRuntime, type RowSpanCacheInput } from "@/core/LayoutStoreRuntime";
import { PrefixLayoutStore } from "@/core/PrefixLayoutStore";
import { RowLayoutStore } from "@/core/RowLayoutStore";
import { notifyPosition$, peek$, type StateContext } from "@/state/state";
import type { InternalState } from "@/types.internal";
import { getId } from "@/utils/getId";
import { getFixedItemLayoutSize } from "@/utils/getItemSize";
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
    previousIdCache?: readonly (string | undefined)[];
}

export interface LayoutStoreDataChangeReconciliationOptions {
    didKeyExtractorChange?: boolean;
    previousIdCache?: readonly (string | undefined)[];
}

export function clearLayoutStoreKnownSizes(ctx: StateContext) {
    ctx.state.layoutStoreRuntime?.store.clearKnownSizes();
    resetLayoutStoreRuntimeState(ctx.state);
}

export function disableLayoutStoreForCurrentPass(state: InternalState) {
    resetLayoutStoreRuntimeState(state);
    state.layoutStoreRuntime = undefined;
}

function getActiveLayoutStoreRuntime(ctx: StateContext) {
    return isLayoutStoreSupported(ctx) ? ctx.state.layoutStoreRuntime : undefined;
}

export function getActiveLayoutStore(ctx: StateContext) {
    return getActiveLayoutStoreRuntime(ctx)?.store;
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
    const dataLength = state.props.data.length;
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
        store.setMeasuredSize(index, size);
        syncLayoutStoreState(ctx);
        didSet = true;
    }
    return didSet;
}

export function isLayoutStoreSupported(ctx: StateContext) {
    const state = ctx.state;
    const {
        props: { horizontal, numColumns, overrideItemLayout },
    } = state;

    return isLayoutStorePropsSupported({ horizontal, numColumns, overrideItemLayout });
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
        state.indexByKey.clear();
        state.idCache.length = 0;
        resetLayoutStoreRuntimeState(state);

        const seed = getLayoutStoreSeed(ctx, {
            didKeyExtractorChange: options?.didKeyExtractorChange,
            mode: "reconcile",
            previousIdCache: options?.previousIdCache,
        });

        didReconcile = !seed.hasDuplicateKey;
        if (didReconcile) {
            applyLayoutStoreSeed(store, seed);
        }
    }

    return didReconcile;
}

export function isLayoutStorePropsSupported(props: {
    horizontal: boolean | undefined;
    numColumns: number | undefined;
    overrideItemLayout: unknown;
}) {
    return !!props.numColumns && props.numColumns > 0;
}

export function syncActiveRowLayoutStoreSpans(ctx: StateContext) {
    const state = ctx.state;
    const runtime = getActiveLayoutStoreRuntime(ctx);
    const store = runtime?.store;
    const { data, numColumns, overrideItemLayout } = state.props;
    let didSync = false;

    if (runtime && store instanceof RowLayoutStore && overrideItemLayout && numColumns > 1) {
        const extraData = peek$(ctx, "extraData");
        const cacheInput = getRowSpanCacheInput(state, extraData);
        const cachedSpans = runtime.getCachedRowSpans(cacheInput);
        if (!cachedSpans) {
            const layoutConfig = { span: 1 };
            const spans = new Array<number | undefined>(data.length);

            for (let index = 0; index < data.length; index++) {
                layoutConfig.span = 1;
                overrideItemLayout(layoutConfig, data[index], index, numColumns, extraData);
                spans[index] = layoutConfig.span;
            }

            store.resize(data.length, spans, numColumns);
            runtime.setCachedRowSpans(cacheInput, spans);
            didSync = true;
        }
    } else {
        runtime?.clearRowSpanCache();
    }

    return didSync;
}

export function syncLayoutStoreStructure(ctx: StateContext) {
    const state = ctx.state;
    if (isLayoutStoreSupported(ctx)) {
        const estimatedSize = getLayoutStorePropEstimatedSize(ctx);
        const nextStoreKind = getLayoutStoreKind(state);
        let runtime = state.layoutStoreRuntime;
        if (runtime && getLayoutStoreKindForStore(runtime.store) === nextStoreKind) {
            if (runtime.store instanceof RowLayoutStore) {
                runtime.store.resize(
                    state.props.data.length,
                    getReusableRowSpans(ctx, runtime),
                    state.props.numColumns,
                );
            } else {
                runtime.store.resize(state.props.data.length);
            }
            if (estimatedSize !== runtime.propEstimatedSize) {
                runtime.store.setEstimatedSize(estimatedSize);
            }
        } else {
            const store =
                nextStoreKind === "row"
                    ? new RowLayoutStore({
                          estimatedSize,
                          length: state.props.data.length,
                          numColumns: state.props.numColumns,
                      })
                    : new PrefixLayoutStore(state.props.data.length, estimatedSize);
            runtime = new LayoutStoreRuntime(store, estimatedSize);
            state.layoutStoreRuntime = runtime;
            if (state.sizesKnown.size > 0) {
                const seed = getLayoutStoreSeed(ctx);
                applyLayoutStoreSeed(runtime.store, seed);
            }
        }
        runtime.propEstimatedSize = estimatedSize;
    } else {
        disableLayoutStoreForCurrentPass(state);
    }

    return state.layoutStoreRuntime?.store;
}

function getRowSpanCacheInput(state: InternalState, extraData: unknown): RowSpanCacheInput {
    const { data, dataKey, dataVersion, numColumns, overrideItemLayout } = state.props;
    return {
        data,
        dataKey,
        dataVersion,
        extraData,
        numColumns,
        overrideItemLayout,
    };
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
    const { data, estimatedItemSize, getFixedItemSize } = state.props;
    const fallbackSize = (estimatedItemSize ?? 100) + ctx.scrollAxisGap;
    const sizeEntries: LayoutStoreSeed["sizeEntries"] = [];
    const canSeedKnownSizes = state.sizesKnown.size > 0;
    const canSeedCachedSizes = state.sizes.size > 0;

    if (
        options.mode === "seed" &&
        ((!getFixedItemSize && !canSeedKnownSizes && !canSeedCachedSizes) || data.length === 0)
    ) {
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
    let fallbackTotalSize = 0;
    let hasDuplicateKey = false;
    let measuredCount = 0;
    let measuredTotalSize = 0;

    for (let index = 0; index < data.length; index++) {
        const item = data[index];
        const previousKey = options.previousIdCache?.[index];
        const canReusePreviousKey =
            options.mode === "reconcile" &&
            !options.didKeyExtractorChange &&
            previousKey !== undefined &&
            previousData !== undefined &&
            (previousData[index] === item || pendingDataComparison?.byIndex[index] !== undefined);
        const key = canReusePreviousKey ? previousKey : getId(state, index);
        const fixedLayoutSize = getFixedItemSize ? getFixedItemLayoutSize(ctx, index, item) : undefined;
        const fallbackOrFixedSize = fixedLayoutSize ?? fallbackSize;

        fallbackTotalSize += fallbackOrFixedSize;

        if (options.mode === "reconcile") {
            state.idCache[index] = key;
            if (state.indexByKey.has(key)) {
                hasDuplicateKey = true;
                break;
            }
            state.indexByKey.set(key, index);
        }

        const knownSize = canSeedKnownSizes ? state.sizesKnown.get(key) : undefined;
        if (knownSize !== undefined) {
            measuredCount++;
            measuredTotalSize += knownSize;
            sizeEntries.push({
                index,
                size: knownSize,
                type: "measured",
            });
        } else {
            const cachedSize = canSeedCachedSizes ? state.sizes.get(key) : undefined;

            if (fixedLayoutSize !== undefined && options.mode === "reconcile") {
                state.sizesKnown.set(key, fixedLayoutSize);
                measuredCount++;
                measuredTotalSize += fixedLayoutSize;
                sizeEntries.push({
                    index,
                    size: fixedLayoutSize,
                    type: "measured",
                });
            } else {
                const cachedOrFixedSize = cachedSize ?? fixedLayoutSize;
                if (cachedOrFixedSize !== undefined) {
                    sizeEntries.push({
                        index,
                        size: cachedOrFixedSize,
                        type: "cached",
                    });
                }
            }
        }
    }

    return {
        estimatedSize: getLayoutStoreSeedEstimate({
            dataLength: data.length,
            fallbackSize,
            fallbackTotalSize,
            measuredCount,
            measuredTotalSize,
        }),
        hasDuplicateKey,
        sizeEntries,
    };
}
