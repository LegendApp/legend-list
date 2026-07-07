import { addTotalSize } from "@/core/addTotalSize";
import { PrefixLayoutRuntime } from "@/core/PrefixLayoutRuntime";
import type { PrefixLayoutStore, PrefixLayoutStoreSizeEntry } from "@/core/PrefixLayoutStore";
import { notifyPosition$, type StateContext } from "@/state/state";
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

interface PrefixLayoutStoreSeed {
    estimatedSize: number;
    hasDuplicateKey?: boolean;
    sizeEntries: PrefixLayoutStoreSizeEntry[];
}

interface PrefixLayoutStoreSeedOptions {
    didKeyExtractorChange?: boolean;
    mode: "reconcile" | "seed";
    previousIdCache?: readonly (string | undefined)[];
}

export interface PrefixDataChangeReconciliationOptions {
    didKeyExtractorChange?: boolean;
    previousIdCache?: readonly (string | undefined)[];
}

export function clearPrefixLayoutStoreKnownSizes(ctx: StateContext) {
    ctx.state.layoutStoreRuntime?.store.clearKnownSizes();
    resetPrefixLayoutStoreRuntimeState(ctx.state);
}

export function disablePrefixLayoutStoreForCurrentPass(state: InternalState) {
    resetPrefixLayoutStoreRuntimeState(state);
    state.layoutStoreRuntime = undefined;
}

function getActivePrefixLayoutRuntime(ctx: StateContext) {
    return isPrefixLayoutStoreSupported(ctx) ? ctx.state.layoutStoreRuntime : undefined;
}

export function getActivePrefixLayoutStore(ctx: StateContext) {
    return getActivePrefixLayoutRuntime(ctx)?.store;
}

export function materializePrefixLayoutStoreRange(ctx: StateContext, startIndex: number, endIndex: number) {
    const state = ctx.state;
    const runtime = getActivePrefixLayoutRuntime(ctx);
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
                    notifyPrefixLayoutStorePosition(ctx, runtime, id, offset);
                }
                state.indexByKey.set(id, index);
            });
        }
    }

    return range;
}

function applyPrefixLayoutStoreSeed(store: PrefixLayoutStore, seed: PrefixLayoutStoreSeed) {
    store.setEstimatedSize(seed.estimatedSize);
    store.replaceKnownSizeEntries(seed.sizeEntries);
}

function getMaterializeRange(state: InternalState, fallbackStart: number, fallbackEnd: number) {
    const start =
        typeof state.startBuffered === "number" && state.startBuffered >= 0 ? state.startBuffered : fallbackStart;
    const end = typeof state.endBuffered === "number" && state.endBuffered >= start ? state.endBuffered : fallbackEnd;
    return { end, start };
}

function flushPrefixLayoutStoreEstimate(
    ctx: StateContext,
    estimatedSize: number,
    anchorIndex: number,
    options?: { requireAnchorCorrection?: boolean },
) {
    const state = ctx.state;
    const store = getActivePrefixLayoutStore(ctx);
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
            syncPrefixLayoutStoreLayoutState(ctx);
            const newAnchorTop = store.getOffset(clampedAnchorIndex);
            const positionDiff = newAnchorTop - oldAnchorTop;

            if (canCorrectAnchor) {
                requestAdjust(ctx, positionDiff);
            }

            const range = getMaterializeRange(state, clampedAnchorIndex, clampedAnchorIndex);
            materializePrefixLayoutStoreRange(ctx, range.start, range.end);
            didFlush = true;
        }
    }

    return didFlush;
}

export function maybeFlushInitialPrefixLayoutEstimate(ctx: StateContext) {
    const state = ctx.state;
    const runtime = getActivePrefixLayoutRuntime(ctx);
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
            didFlush = flushPrefixLayoutStoreEstimate(ctx, nextEstimate, startNoBuffer);
        }
    }

    return didFlush;
}

function hasEnoughNewMeasurementsForPeriodicFlush(runtime: PrefixLayoutRuntime) {
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

function flushPeriodicPrefixLayoutEstimate(ctx: StateContext) {
    const state = ctx.state;
    const runtime = getActivePrefixLayoutRuntime(ctx);
    let didFlush = false;

    if (runtime && hasEnoughNewMeasurementsForPeriodicFlush(runtime)) {
        if (shouldDeferPeriodicEstimateFlush(state)) {
            schedulePeriodicPrefixLayoutEstimateFlush(ctx);
        } else {
            const store = runtime.store;
            const measuredAverage = store.getMeasuredAverageSize();
            const anchorIndex = getEstimateFlushAnchorIndex(state);
            runtime.lastFlushedEstimateMeasurementCount = store.getMeasuredCount();

            if (measuredAverage !== undefined && anchorIndex !== undefined) {
                didFlush = flushPrefixLayoutStoreEstimate(ctx, measuredAverage, anchorIndex, {
                    requireAnchorCorrection: true,
                });
            }
        }
    }

    return didFlush;
}

export function schedulePeriodicPrefixLayoutEstimateFlush(ctx: StateContext) {
    const state = ctx.state;
    const runtime = getActivePrefixLayoutRuntime(ctx);
    let didSchedule = false;

    if (runtime && runtime.queuedEstimateFlush === undefined && hasEnoughNewMeasurementsForPeriodicFlush(runtime)) {
        const timeout = setTimeout(() => {
            runtime.queuedEstimateFlush = undefined;
            state.timeouts.delete(timeout);
            flushPeriodicPrefixLayoutEstimate(ctx);
        }, PERIODIC_ESTIMATE_FLUSH_DELAY) as unknown as number;
        runtime.queuedEstimateFlush = timeout;
        state.timeouts.add(timeout);
        didSchedule = true;
    }

    return didSchedule;
}

export function resetPrefixLayoutStoreRuntimeState(state: InternalState) {
    state.layoutStoreRuntime?.resetTransientState(state.timeouts);
}

export function setPrefixLayoutStoreMeasuredSize(ctx: StateContext, index: number | undefined, size: number) {
    const store = getActivePrefixLayoutStore(ctx);
    let didSet = false;
    if (store?.hasIndex(index)) {
        store.setMeasuredSize(index, size);
        syncPrefixLayoutStoreLayoutState(ctx);
        didSet = true;
    }
    return didSet;
}

export function isPrefixLayoutStoreSupported(ctx: StateContext) {
    const state = ctx.state;
    const {
        props: { horizontal, numColumns, overrideItemLayout },
    } = state;

    return isPrefixLayoutStorePropsSupported({ horizontal, numColumns, overrideItemLayout });
}

function getPrefixLayoutStoreSeedEstimate(input: {
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

export function reconcilePrefixDataChange(ctx: StateContext, options?: PrefixDataChangeReconciliationOptions): boolean {
    const state = ctx.state;
    const store = getActivePrefixLayoutStore(ctx);
    let didReconcile = false;

    if (store) {
        state.indexByKey.clear();
        state.idCache.length = 0;
        resetPrefixLayoutStoreRuntimeState(state);

        const seed = getPrefixLayoutStoreSeed(ctx, {
            didKeyExtractorChange: options?.didKeyExtractorChange,
            mode: "reconcile",
            previousIdCache: options?.previousIdCache,
        });

        didReconcile = !seed.hasDuplicateKey;
        if (didReconcile) {
            applyPrefixLayoutStoreSeed(store, seed);
        }
    }

    return didReconcile;
}

export function isPrefixLayoutStorePropsSupported(props: {
    horizontal: boolean | undefined;
    numColumns: number | undefined;
    overrideItemLayout: unknown;
}) {
    return !props.horizontal && props.numColumns === 1 && !props.overrideItemLayout;
}

export function syncPrefixLayoutStoreStructure(ctx: StateContext) {
    const state = ctx.state;
    if (isPrefixLayoutStoreSupported(ctx)) {
        const estimatedSize = getPrefixLayoutStorePropEstimatedSize(ctx);
        let runtime = state.layoutStoreRuntime;
        if (runtime) {
            runtime.store.resize(state.props.data.length);
            if (estimatedSize !== runtime.propEstimatedSize) {
                runtime.store.setEstimatedSize(estimatedSize);
            }
        } else {
            runtime = new PrefixLayoutRuntime(state.props.data.length, estimatedSize);
            state.layoutStoreRuntime = runtime;
            if (state.sizesKnown.size > 0) {
                const seed = getPrefixLayoutStoreSeed(ctx);
                applyPrefixLayoutStoreSeed(runtime.store, seed);
            }
        }
        runtime.propEstimatedSize = estimatedSize;
    } else {
        disablePrefixLayoutStoreForCurrentPass(state);
    }

    return state.layoutStoreRuntime?.store;
}

export function rebuildPrefixLayoutStoreExact(ctx: StateContext) {
    const state = ctx.state;
    const store = syncPrefixLayoutStoreStructure(ctx);
    if (store) {
        const seed = getPrefixLayoutStoreSeed(ctx);
        applyPrefixLayoutStoreSeed(store, seed);
    }
    return state.layoutStoreRuntime?.store;
}

export function syncPrefixLayoutStoreLayoutState(ctx: StateContext) {
    const runtime = getActivePrefixLayoutRuntime(ctx);
    let didSync = false;
    if (runtime) {
        const store = runtime.store;
        addTotalSize(ctx, null, store.getTotalSize());
        if (ctx.state.props.snapToIndices) {
            updateSnapToOffsets(ctx);
        }
        syncPrefixLayoutStorePositionListeners(ctx, runtime);
        didSync = true;
    }
    return didSync;
}

function syncPrefixLayoutStorePositionListeners(ctx: StateContext, runtime: PrefixLayoutRuntime) {
    const state = ctx.state;
    const store = runtime.store;

    if (ctx.positionListeners.size > 0) {
        for (const [key] of ctx.positionListeners) {
            const index = state.indexByKey.get(key);
            if (store.hasIndex(index)) {
                notifyPrefixLayoutStorePosition(ctx, runtime, key, store.getOffset(index));
            }
        }
    }
}

function notifyPrefixLayoutStorePosition(ctx: StateContext, runtime: PrefixLayoutRuntime, key: string, offset: number) {
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

function getPrefixLayoutStorePropEstimatedSize(ctx: StateContext) {
    return (ctx.state.props.estimatedItemSize ?? 100) + ctx.scrollAxisGap;
}

function getPrefixLayoutStoreSeed(
    ctx: StateContext,
    options: PrefixLayoutStoreSeedOptions = { mode: "seed" },
): PrefixLayoutStoreSeed {
    const state = ctx.state;
    const { data, estimatedItemSize, getFixedItemSize } = state.props;
    const fallbackSize = (estimatedItemSize ?? 100) + ctx.scrollAxisGap;
    const sizeEntries: PrefixLayoutStoreSeed["sizeEntries"] = [];
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
        estimatedSize: getPrefixLayoutStoreSeedEstimate({
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
