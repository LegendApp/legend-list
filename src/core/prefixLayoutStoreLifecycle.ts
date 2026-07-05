import { addTotalSize } from "@/core/addTotalSize";
import { syncSnapOffsetsForLayout } from "@/core/layoutSnapOffsets";
import { PrefixLayoutStore } from "@/core/PrefixLayoutStore";
import { notifyPosition$, type StateContext } from "@/state/state";
import type { InternalState } from "@/types.internal";
import { getId } from "@/utils/getId";
import { getScrollVelocity } from "@/utils/getScrollVelocity";
import { hasActiveInitialScroll } from "@/utils/hasActiveInitialScroll";
import { hasActiveMVCPAnchorLock } from "@/utils/hasActiveMVCPAnchorLock";
import { requestAdjust } from "@/utils/requestAdjust";

const ENABLE_PREFIX_LAYOUT_STORE = true;
const INITIAL_ESTIMATE_FLUSH_THRESHOLD = 1;
const INITIAL_ESTIMATE_FLUSH_MIN_MEASUREMENTS = 2;
const PERIODIC_ESTIMATE_FLUSH_DELAY = 250;
const PERIODIC_ESTIMATE_FLUSH_MAX_VELOCITY = 0.25;
const PERIODIC_ESTIMATE_FLUSH_MIN_NEW_MEASUREMENTS = 4;
const PREFIX_LAYOUT_STORE_SEED_MAX_ITEMS = 20;
const PREFIX_LAYOUT_STORE_SEED_MIN_ITEMS = 5;

interface PrefixLayoutStoreSeed {
    estimatedSize: number;
    fixedSizes: Array<{ index: number; key: string; size: number }>;
}

export function clearPrefixLayoutStoreMeasurements(ctx: StateContext) {
    ctx.state.layoutStore?.clearMeasurements();
    resetPrefixLayoutStoreEstimateFlushState(ctx.state);
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
            if (ctx.positionListeners.has(id)) {
                notifyPrefixLayoutStorePosition(ctx, id, layout.offset);
            }
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

function getMaterializeRange(state: InternalState, fallbackStart: number, fallbackEnd: number) {
    const start =
        typeof state.startBuffered === "number" && state.startBuffered >= 0 ? state.startBuffered : fallbackStart;
    const end = typeof state.endBuffered === "number" && state.endBuffered >= start ? state.endBuffered : fallbackEnd;
    return { end, start };
}

function getPreviousMaterializedLayoutOffset(state: InternalState, store: PrefixLayoutStore, index: number) {
    return state.positions[index] ?? store.getOffset(index);
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

    if (store && Math.abs(estimatedSize - store.getEstimatedSize()) > INITIAL_ESTIMATE_FLUSH_THRESHOLD) {
        const canCorrectAnchor = state.didContainersLayout && state.props.maintainVisibleContentPosition.size;
        if (!options?.requireAnchorCorrection || anchorIndex === 0 || canCorrectAnchor) {
            const oldAnchorTop = getPreviousMaterializedLayoutOffset(state, store, anchorIndex);
            store.flushEstimatedSize(estimatedSize);
            syncPrefixLayoutStoreTotalSize(ctx);
            const newAnchorTop = store.getOffset(anchorIndex);
            const positionDiff = newAnchorTop - oldAnchorTop;

            if (canCorrectAnchor) {
                requestAdjust(ctx, positionDiff);
            }

            const range = getMaterializeRange(state, anchorIndex, anchorIndex);
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
        props: { horizontal, numColumns, overrideItemLayout },
    } = state;

    return ENABLE_PREFIX_LAYOUT_STORE && !horizontal && numColumns === 1 && !overrideItemLayout;
}

export function syncPrefixLayoutStore(ctx: StateContext) {
    const state = ctx.state;
    if (isPrefixLayoutStoreSupported(ctx)) {
        const seed = getPrefixLayoutStoreSeed(ctx);
        if (state.layoutStore) {
            state.layoutStore.resize(state.props.data.length);
            if (seed.estimatedSize !== state.layoutStorePropEstimatedSize) {
                state.layoutStore.flushEstimatedSize(seed.estimatedSize);
            }
        } else {
            state.layoutStore = new PrefixLayoutStore(state.props.data.length, seed.estimatedSize);
        }
        for (const { index, key, size } of seed.fixedSizes) {
            state.layoutStore.setMeasuredSize(index, key, size);
        }
        state.layoutStorePropEstimatedSize = seed.estimatedSize;
    } else {
        resetPrefixLayoutStoreEstimateFlushState(state);
        state.layoutStore = undefined;
        state.layoutStorePropEstimatedSize = undefined;
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
            index >= 0 && index < store.length ? store.getOffset(index) : undefined,
        );
    }
}

function syncPrefixLayoutStorePositionListeners(ctx: StateContext, store: PrefixLayoutStore) {
    const state = ctx.state;

    if (ctx.positionListeners.size > 0) {
        for (const [key] of ctx.positionListeners) {
            const index = state.indexByKey.get(key);
            if (index !== undefined && index >= 0 && index < store.length) {
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

function getPrefixLayoutStoreSeed(ctx: StateContext): PrefixLayoutStoreSeed {
    const state = ctx.state;
    const { data, estimatedItemSize, getFixedItemSize, getItemType } = state.props;
    const fallbackSize = (estimatedItemSize ?? 100) + ctx.scrollAxisGap;
    const fixedSizes: PrefixLayoutStoreSeed["fixedSizes"] = [];

    if (!getFixedItemSize || data.length === 0) {
        return { estimatedSize: fallbackSize, fixedSizes };
    }

    const maxSamples = Math.min(PREFIX_LAYOUT_STORE_SEED_MAX_ITEMS, data.length);
    const minSamples = Math.min(PREFIX_LAYOUT_STORE_SEED_MIN_ITEMS, maxSamples);
    const targetSize = state.scrollLength > 0 ? state.scrollLength : fallbackSize * minSamples;
    const { direction, startIndex } = getPrefixLayoutStoreSeedStart(state, maxSamples);
    let totalSize = 0;
    let sampleCount = 0;
    let index = startIndex;

    while (
        index >= 0 &&
        index < data.length &&
        sampleCount < maxSamples &&
        (sampleCount < minSamples || totalSize < targetSize)
    ) {
        const item = data[index];
        const itemType = getItemType ? (getItemType(item, index) ?? "") : "";
        const fixedSize = getFixedItemSize(item, index, itemType);
        const size = fixedSize !== undefined ? fixedSize + ctx.scrollAxisGap : fallbackSize;

        totalSize += size;
        sampleCount++;

        if (fixedSize !== undefined) {
            fixedSizes.push({
                index,
                key: getId(state, index),
                size,
            });
        }

        index += direction;
    }

    return {
        estimatedSize: sampleCount > 0 ? totalSize / sampleCount : fallbackSize,
        fixedSizes,
    };
}

function getPrefixLayoutStoreSeedStart(state: InternalState, maxSamples: number) {
    const dataLength = state.props.data.length;
    const initialIndex = state.initialScroll?.index;
    let direction = 1;
    let startIndex = 0;

    if (initialIndex !== undefined && dataLength > 0) {
        const clampedIndex = Math.max(0, Math.min(dataLength - 1, initialIndex));
        const viewPosition = Math.max(0, Math.min(1, state.initialScroll?.viewPosition ?? 0));
        const isTailAligned = clampedIndex === dataLength - 1 && viewPosition === 1;

        if (isTailAligned) {
            direction = -1;
            startIndex = clampedIndex;
        } else {
            const leadingSampleCount = Math.floor((maxSamples - 1) * viewPosition);
            startIndex = Math.max(0, Math.min(dataLength - maxSamples, clampedIndex - leadingSampleCount));
        }
    }

    return { direction, startIndex };
}
