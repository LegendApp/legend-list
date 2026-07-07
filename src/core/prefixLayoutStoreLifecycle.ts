import { addTotalSize } from "@/core/addTotalSize";
import { syncSnapOffsetsForLayout } from "@/core/layoutSnapOffsets";
import { PrefixLayoutStore, type PrefixLayoutStoreSizeEntry } from "@/core/PrefixLayoutStore";
import { notifyPosition$, type StateContext } from "@/state/state";
import type { InternalState } from "@/types.internal";
import { getId } from "@/utils/getId";
import { getFixedItemLayoutSize } from "@/utils/getItemSize";
import { getScrollVelocity } from "@/utils/getScrollVelocity";
import { hasActiveInitialScroll } from "@/utils/hasActiveInitialScroll";
import { hasActiveMVCPAnchorLock } from "@/utils/hasActiveMVCPAnchorLock";
import { requestAdjust } from "@/utils/requestAdjust";

const INITIAL_ESTIMATE_FLUSH_THRESHOLD = 1;
const INITIAL_ESTIMATE_FLUSH_MIN_MEASUREMENTS = 2;
const PERIODIC_ESTIMATE_FLUSH_DELAY = 250;
const PERIODIC_ESTIMATE_FLUSH_MAX_VELOCITY = 0.25;
const PERIODIC_ESTIMATE_FLUSH_MIN_NEW_MEASUREMENTS = 4;

interface PrefixLayoutStoreSeed {
    estimatedSize: number;
    sizeEntries: PrefixLayoutStoreSizeEntry[];
}

export interface PrefixLayoutStoreExactRebuildProps {
    estimatedItemSize: number | undefined;
    hasReliableKeyExtractor: boolean;
    horizontal: boolean;
    numColumns: number | undefined;
    overrideItemLayout: unknown;
}

interface PrefixLayoutStoreExactRebuildInput {
    didDataChange: boolean;
    didScrollAxisGapChange: boolean;
    isFirst: boolean;
    next: PrefixLayoutStoreExactRebuildProps;
    previous: PrefixLayoutStoreExactRebuildProps;
}

export interface PrefixDataChangeReconciliationOptions {
    didKeyExtractorChange?: boolean;
    previousIdCache?: readonly (string | undefined)[];
}

export function clearPrefixLayoutStoreMeasurements(ctx: StateContext) {
    ctx.state.layoutStore?.clearMeasurements();
    resetPrefixLayoutStoreEstimateFlushState(ctx.state);
}

export function disablePrefixLayoutStoreForCurrentPass(state: InternalState) {
    resetPrefixLayoutStoreEstimateFlushState(state);
    state.layoutStore = undefined;
    state.layoutStorePropEstimatedSize = undefined;
}

export function getActivePrefixLayoutStore(ctx: StateContext) {
    let store: PrefixLayoutStore | undefined;
    if (isPrefixLayoutStoreSupported(ctx)) {
        store = ctx.state.layoutStore;
    }
    return store;
}

export function materializePrefixLayoutStoreRange(ctx: StateContext, startIndex: number, endIndex: number) {
    const state = ctx.state;
    const store = getActivePrefixLayoutStore(ctx);
    let range: { end: number; start: number } | undefined;

    if (store) {
        store.forEachLayout(startIndex, endIndex, (index, offset, size) => {
            const id = state.idCache[index] ?? getId(state, index);
            if (ctx.positionListeners.has(id)) {
                notifyPrefixLayoutStorePosition(ctx, id, offset);
            }
            state.indexByKey.set(id, index);
            state.sizes.set(id, size);

            range = {
                end: index,
                start: range?.start ?? index,
            };
        });
    }

    return range;
}

export function materializePrefixLayoutStoreOffsetRange(ctx: StateContext, startOffset: number, endOffset: number) {
    const store = getActivePrefixLayoutStore(ctx);
    let range: { end: number; start: number } | undefined;

    if (store) {
        const indexRange = store.findIndexRangeAtOffsets(startOffset, endOffset);
        if (indexRange) {
            range = materializePrefixLayoutStoreRange(ctx, indexRange.start, indexRange.end);
        }
    }

    return range;
}

function applyPrefixLayoutStoreSeed(store: PrefixLayoutStore, seed: PrefixLayoutStoreSeed) {
    store.flushEstimatedSize(seed.estimatedSize);
    store.rebuildSizes(seed.sizeEntries);
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
            store.flushEstimatedSize(estimatedSize);
            syncPrefixLayoutStoreTotalSize(ctx);
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
            state.lastFlushedLayoutStoreEstimateMeasurementCount = store.getMeasuredCount();
            const nextEstimate = totalMeasuredSize / measuredCount;
            didFlush = flushPrefixLayoutStoreEstimate(ctx, nextEstimate, startNoBuffer);
        }
    }

    return didFlush;
}

function hasEnoughNewMeasurementsForPeriodicFlush(state: InternalState, store: PrefixLayoutStore) {
    const lastMeasuredCount = state.lastFlushedLayoutStoreEstimateMeasurementCount ?? 0;
    return store.getMeasuredCount() - lastMeasuredCount >= PERIODIC_ESTIMATE_FLUSH_MIN_NEW_MEASUREMENTS;
}

function getPeriodicEstimateFlushDeferReason(state: InternalState) {
    const now = Date.now();
    const recentScrollAge = state.scrollTime > 0 ? now - state.scrollTime : Number.POSITIVE_INFINITY;
    let reason: string | undefined;

    if (!state.didContainersLayout) {
        reason = "layout";
    } else if (hasActiveInitialScroll(state) || state.queuedInitialLayout) {
        reason = "initial-scroll";
    } else if (state.scrollingTo || state.pendingScrollToEnd) {
        reason = "scroll-target";
    } else if (state.pendingLayoutEffectMeasurements?.size || state.userScrollAnchorReset?.keys.size) {
        reason = "pending-measurements";
    } else if (hasActiveMVCPAnchorLock(state)) {
        reason = "mvcp-anchor-lock";
    } else if (recentScrollAge < PERIODIC_ESTIMATE_FLUSH_DELAY) {
        reason = "recent-scroll";
    } else if (Math.abs(getScrollVelocity(state)) > PERIODIC_ESTIMATE_FLUSH_MAX_VELOCITY) {
        reason = "scroll-velocity";
    }

    return reason;
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
    const store = getActivePrefixLayoutStore(ctx);
    let didFlush = false;

    if (store && hasEnoughNewMeasurementsForPeriodicFlush(state, store)) {
        const deferReason = getPeriodicEstimateFlushDeferReason(state);
        if (deferReason) {
            schedulePeriodicPrefixLayoutEstimateFlush(ctx);
        } else {
            const measuredAverage = store.getMeasuredAverageSize();
            const anchorIndex = getEstimateFlushAnchorIndex(state);
            state.lastFlushedLayoutStoreEstimateMeasurementCount = store.getMeasuredCount();

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
    const store = getActivePrefixLayoutStore(ctx);
    let didSchedule = false;

    if (
        store &&
        state.queuedLayoutStoreEstimateFlush === undefined &&
        hasEnoughNewMeasurementsForPeriodicFlush(state, store)
    ) {
        const timeout: any = setTimeout(() => {
            state.queuedLayoutStoreEstimateFlush = undefined;
            state.timeouts.delete(timeout);
            flushPeriodicPrefixLayoutEstimate(ctx);
        }, PERIODIC_ESTIMATE_FLUSH_DELAY);
        state.queuedLayoutStoreEstimateFlush = timeout;
        state.timeouts.add(timeout);
        didSchedule = true;
    }

    return didSchedule;
}

export function resetPrefixLayoutStoreEstimateFlushState(state: InternalState) {
    if (state.queuedLayoutStoreEstimateFlush !== undefined) {
        clearTimeout(state.queuedLayoutStoreEstimateFlush);
        state.timeouts.delete(state.queuedLayoutStoreEstimateFlush);
        state.queuedLayoutStoreEstimateFlush = undefined;
    }
    state.didFlushInitialLayoutStoreEstimate = false;
    state.lastFlushedLayoutStoreEstimateMeasurementCount = 0;
    state.layoutStorePositionListenerOffsets = undefined;
}

export function setPrefixLayoutStoreMeasuredSize(
    ctx: StateContext,
    index: number | undefined,
    key: string,
    size: number,
) {
    const store = getActivePrefixLayoutStore(ctx);
    let didSet = false;
    if (store?.hasIndex(index)) {
        store.setMeasuredSize(index, size);
        ctx.state.sizes.set(key, size);
        syncPrefixLayoutStoreTotalSize(ctx);
        didSet = true;
    }
    return didSet;
}

export function isPrefixLayoutStoreSupported(ctx: StateContext) {
    const state = ctx.state;
    const {
        props: { horizontal, numColumns, overrideItemLayout },
    } = state;

    return (
        !state.disablePrefixLayoutStoreAfterKeylessDataChange &&
        isPrefixLayoutStorePropsSupported({ horizontal, numColumns, overrideItemLayout })
    );
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
        const {
            props: { data, estimatedItemSize, getFixedItemSize },
        } = state;
        const fallbackSize = (estimatedItemSize ?? 100) + ctx.scrollAxisGap;
        const previousData = state.previousData;
        const statePendingDataComparison = state.pendingDataComparison;
        const pendingDataComparison =
            statePendingDataComparison &&
            statePendingDataComparison.previousData === previousData &&
            statePendingDataComparison.nextData === data
                ? statePendingDataComparison
                : undefined;
        const canSeedCachedSizes = state.sizes.size > 0;
        const canSeedFixedSizes = !!getFixedItemSize;
        const canSeedKnownSizes = state.sizesKnown.size > 0;

        state.indexByKey.clear();
        state.idCache.length = 0;
        resetPrefixLayoutStoreEstimateFlushState(state);
        const sizeEntries: PrefixLayoutStoreSizeEntry[] = [];
        let totalSeedSize = 0;
        let measuredCount = 0;
        let measuredTotalSize = 0;
        let hasDuplicateKey = false;

        for (let index = 0; index < data.length; index++) {
            const item = data[index];
            const fixedLayoutSize = canSeedFixedSizes ? getFixedItemLayoutSize(ctx, index, item) : undefined;
            totalSeedSize += fixedLayoutSize ?? fallbackSize;
            const previousKey = options?.previousIdCache?.[index];
            const canReusePreviousKey =
                !options?.didKeyExtractorChange &&
                previousKey !== undefined &&
                previousData !== undefined &&
                (previousData[index] === item || pendingDataComparison?.byIndex[index] !== undefined);
            const key = canReusePreviousKey ? previousKey : getId(state, index);
            state.idCache[index] = key;

            if (state.indexByKey.has(key)) {
                hasDuplicateKey = true;
                break;
            }

            state.indexByKey.set(key, index);

            const knownSize = canSeedKnownSizes ? state.sizesKnown.get(key) : undefined;
            if (knownSize !== undefined) {
                state.sizes.set(key, knownSize);
                sizeEntries.push({ index, size: knownSize, type: "measured" });
                measuredCount++;
                measuredTotalSize += knownSize;
            } else {
                let didSeedSize = false;
                if (fixedLayoutSize !== undefined) {
                    state.sizesKnown.set(key, fixedLayoutSize);
                    state.sizes.set(key, fixedLayoutSize);
                    sizeEntries.push({ index, size: fixedLayoutSize, type: "measured" });
                    measuredCount++;
                    measuredTotalSize += fixedLayoutSize;
                    didSeedSize = true;
                }

                const cachedSize = !didSeedSize && canSeedCachedSizes ? state.sizes.get(key) : undefined;
                if (cachedSize !== undefined) {
                    sizeEntries.push({ index, size: cachedSize, type: "cached" });
                }
            }
        }

        didReconcile = !hasDuplicateKey;
        if (didReconcile) {
            applyPrefixLayoutStoreSeed(store, {
                estimatedSize: getPrefixLayoutStoreSeedEstimate({
                    dataLength: data.length,
                    fallbackSize,
                    fallbackTotalSize: totalSeedSize,
                    measuredCount,
                    measuredTotalSize,
                }),
                sizeEntries,
            });
        }
    }

    return didReconcile;
}

export function shouldRebuildPrefixLayoutStoreExact(input: PrefixLayoutStoreExactRebuildInput) {
    const { didDataChange, didScrollAxisGapChange, isFirst, next, previous } = input;
    const isNextSupported = isPrefixLayoutStorePropsSupported(next);
    const isPreviousSupported = isPrefixLayoutStorePropsSupported(previous);
    let shouldRebuild = false;

    if (!isFirst && !didDataChange && isNextSupported) {
        shouldRebuild =
            !isPreviousSupported ||
            previous.estimatedItemSize !== next.estimatedItemSize ||
            previous.hasReliableKeyExtractor !== next.hasReliableKeyExtractor ||
            didScrollAxisGapChange;
    }

    return shouldRebuild;
}

function isPrefixLayoutStorePropsSupported(props: {
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
        if (state.layoutStore) {
            state.layoutStore.resize(state.props.data.length);
            if (estimatedSize !== state.layoutStorePropEstimatedSize) {
                state.layoutStore.flushEstimatedSize(estimatedSize);
            }
        } else {
            state.layoutStore = new PrefixLayoutStore(state.props.data.length, estimatedSize);
            if (state.sizesKnown.size > 0) {
                const seed = getPrefixLayoutStoreSeed(ctx);
                applyPrefixLayoutStoreSeed(state.layoutStore, seed);
            }
        }
        state.layoutStorePropEstimatedSize = estimatedSize;
    } else {
        resetPrefixLayoutStoreEstimateFlushState(state);
        state.layoutStore = undefined;
        state.layoutStorePropEstimatedSize = undefined;
    }

    return state.layoutStore;
}

export function rebuildPrefixLayoutStoreExact(ctx: StateContext) {
    const state = ctx.state;
    const store = syncPrefixLayoutStoreStructure(ctx);
    if (store) {
        const seed = getPrefixLayoutStoreSeed(ctx);
        applyPrefixLayoutStoreSeed(store, seed);
    }
    return state.layoutStore;
}

export function syncPrefixLayoutStoreTotalSize(ctx: StateContext) {
    const store = getActivePrefixLayoutStore(ctx);
    let didSync = false;
    if (store) {
        addTotalSize(ctx, null, store.getTotalSize());
        syncPrefixLayoutStoreSnapOffsets(ctx, store);
        syncPrefixLayoutStorePositionListeners(ctx, store);
        didSync = true;
    }
    return didSync;
}

function syncPrefixLayoutStoreSnapOffsets(ctx: StateContext, store: PrefixLayoutStore) {
    const snapToIndices = ctx.state.props.snapToIndices;

    if (snapToIndices) {
        syncSnapOffsetsForLayout(ctx, snapToIndices, (index) =>
            store.hasIndex(index) ? store.getOffset(index) : undefined,
        );
    }
}

function syncPrefixLayoutStorePositionListeners(ctx: StateContext, store: PrefixLayoutStore) {
    const state = ctx.state;

    if (ctx.positionListeners.size > 0) {
        for (const [key] of ctx.positionListeners) {
            const index = state.indexByKey.get(key);
            if (store.hasIndex(index)) {
                notifyPrefixLayoutStorePosition(ctx, key, store.getOffset(index));
            }
        }
    }
}

function notifyPrefixLayoutStorePosition(ctx: StateContext, key: string, offset: number) {
    const state = ctx.state;
    let offsets = state.layoutStorePositionListenerOffsets;
    if (!offsets) {
        offsets = new Map();
        state.layoutStorePositionListenerOffsets = offsets;
    }
    if (offsets.get(key) !== offset) {
        offsets.set(key, offset);
        notifyPosition$(ctx, key, offset);
    }
}

function getPrefixLayoutStorePropEstimatedSize(ctx: StateContext) {
    return (ctx.state.props.estimatedItemSize ?? 100) + ctx.scrollAxisGap;
}

function getPrefixLayoutStoreSeed(ctx: StateContext): PrefixLayoutStoreSeed {
    const state = ctx.state;
    const { data, estimatedItemSize, getFixedItemSize } = state.props;
    const fallbackSize = (estimatedItemSize ?? 100) + ctx.scrollAxisGap;
    const sizeEntries: PrefixLayoutStoreSeed["sizeEntries"] = [];

    if ((!getFixedItemSize && state.sizesKnown.size === 0 && state.sizes.size === 0) || data.length === 0) {
        return { estimatedSize: fallbackSize, sizeEntries };
    }

    let fallbackTotalSize = 0;
    let measuredCount = 0;
    let measuredTotalSize = 0;

    for (let index = 0; index < data.length; index++) {
        const item = data[index];
        const key = getId(state, index);
        const fixedLayoutSize = getFixedItemSize ? getFixedItemLayoutSize(ctx, index, item) : undefined;
        const fallbackOrFixedSize = fixedLayoutSize ?? fallbackSize;

        fallbackTotalSize += fallbackOrFixedSize;

        const knownSize = state.sizesKnown.get(key);
        if (knownSize !== undefined) {
            measuredCount++;
            measuredTotalSize += knownSize;
            sizeEntries.push({
                index,
                size: knownSize,
                type: "measured",
            });
        } else {
            const cachedSize = state.sizes.get(key);
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

    return {
        estimatedSize: getPrefixLayoutStoreSeedEstimate({
            dataLength: data.length,
            fallbackSize,
            fallbackTotalSize,
            measuredCount,
            measuredTotalSize,
        }),
        sizeEntries,
    };
}
