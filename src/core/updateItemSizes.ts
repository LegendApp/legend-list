import { schedulePreservedEndAnchorCorrection } from "@/core/bootstrapInitialScroll";
import { calculateItemsInView, schedulePendingDataChangeLayout } from "@/core/calculateItemsInView";
import { resolveContainerItemMetadata } from "@/core/containerItemMetadata";
import { doMaintainScrollAtEnd } from "@/core/doMaintainScrollAtEnd";
import { setSize } from "@/core/setSize";
import { maybeUpdateAnchoredEndSpace } from "@/core/updateAnchoredEndSpace";
import { Platform } from "@/platform/Platform";
import { peek$, type StateContext, set$ } from "@/state/state";
import { checkAllSizesKnown } from "@/utils/checkAllSizesKnown";
import { checkThresholds } from "@/utils/checkThresholds";
import { getId } from "@/utils/getId";
import { getItemSize, type ResolvedItemSize } from "@/utils/getItemSize";
import { roundSize } from "@/utils/helpers";
import { isNativeLayoutNoise } from "@/utils/layoutMeasurement";

export function runOrScheduleMVCPRecalculate(ctx: StateContext, isFollowingEnd?: boolean) {
    // Runs the MVCP recalculation pass after item-size changes.
    // On web, an active anchor lock coalesces recalculations to one RAF to reduce oscillating adjustments.
    // End following scrolls to the already published total, so its positions cannot wait for that RAF.
    const state = ctx.state;

    if (state.userScrollAnchorReset !== undefined) {
        calculateItemsInView(ctx);
        if (state.userScrollAnchorReset?.keys.size === 0) {
            state.userScrollAnchorReset = undefined;
        }
    } else if (Platform.OS === "web" && state.mvcpAnchorLock && !isFollowingEnd) {
        if (!state.scheduledWork.has("mvcpRecalculate")) {
            state.scheduledWork.frame(
                () => calculateItemsInView(ctx, { doMVCP: true, mvcpAdjustmentSource: "item-size" }),
                "mvcpRecalculate",
            );
        }
    } else {
        if (Platform.OS === "web") state.scheduledWork.cancel("mvcpRecalculate");
        calculateItemsInView(ctx, { doMVCP: true, mvcpAdjustmentSource: "item-size" });
    }
}

function updateOtherAxisSizeIfNeeded(
    ctx: StateContext,
    sizeObj: { width: number; height: number },
    horizontal: boolean,
) {
    const state = ctx.state;
    if (state.needsOtherAxisSize) {
        const otherAxisSize = horizontal ? sizeObj.height : sizeObj.width;
        const currentOtherAxisSize = peek$(ctx, "otherAxisSize");
        if (!currentOtherAxisSize || otherAxisSize > currentOtherAxisSize) {
            set$(ctx, "otherAxisSize", otherAxisSize);
        }
    }
}

export interface ItemSizeMeasurement {
    containerId?: number;
    itemKey: string;
    size: { width: number; height: number };
}

let activeItemSizeBatches: Map<StateContext, ItemSizeMeasurement[]> | undefined;

// Collects synchronous measurements and flushes one position update per list at the outer boundary.
export function batchItemSizeUpdates(runUpdates: () => void) {
    const isOuterBatch = activeItemSizeBatches === undefined;
    activeItemSizeBatches ??= new Map();

    try {
        runUpdates();
    } finally {
        if (isOuterBatch) {
            const batches = activeItemSizeBatches;
            activeItemSizeBatches = undefined;
            for (const [ctx, measurements] of batches) {
                updateItemSizesBatch(ctx, measurements);
            }
        }
    }
}

interface ItemSizeUpdateResult {
    didChange?: boolean;
    didMeasureUserScrollAnchorResetItem?: boolean;
    needsRecalculate?: boolean;
    shouldMaintainScrollAtEnd?: boolean;
}

function mergeItemSizeUpdateResult(result: ItemSizeUpdateResult, next: ItemSizeUpdateResult) {
    result.didChange ||= next.didChange;
    result.didMeasureUserScrollAnchorResetItem ||= next.didMeasureUserScrollAnchorResetItem;
    result.needsRecalculate ||= next.needsRecalculate;
    result.shouldMaintainScrollAtEnd ||= next.shouldMaintainScrollAtEnd;
}

function flushItemSizeUpdates(ctx: StateContext, result: ItemSizeUpdateResult) {
    const state = ctx.state;
    // The parent's data-change layout pass consumes these sizes and preserves the
    // old positions for MVCP. A child measurement must not overwrite them first.
    if (state.didDataChange && !state.isFirst && state.previousIndexByKey !== state.indexByKey) {
        schedulePendingDataChangeLayout(ctx);
        if (result.shouldMaintainScrollAtEnd) {
            state.scheduledWork.microtask(
                () => doMaintainScrollAtEnd(ctx, { immediate: true }),
                "dataChangeItemSizeFollow",
            );
        }
        return;
    }
    if (result.shouldMaintainScrollAtEnd && Platform.OS === "web") {
        queueMicrotask(() => doMaintainScrollAtEnd(ctx, { immediate: true }));
    }
    if (result.needsRecalculate) {
        if (result.didChange) {
            // Keep the saved end target through MVCP and ScrollAdjust's temporary padding.
            schedulePreservedEndAnchorCorrection(ctx);
        }
        state.scrollForNextCalculateItemsInView = undefined;
        runOrScheduleMVCPRecalculate(
            ctx,
            result.shouldMaintainScrollAtEnd &&
                (peek$(ctx, "isFollowingEnd") || peek$(ctx, "isWithinMaintainScrollAtEndThreshold")),
        );
    } else if (result.didMeasureUserScrollAnchorResetItem && state.userScrollAnchorReset?.keys.size === 0) {
        state.userScrollAnchorReset = undefined;
    }
    if (result.didChange) {
        maybeUpdateAnchoredEndSpace(ctx);
        checkThresholds(ctx);
    }
    if (result.shouldMaintainScrollAtEnd && Platform.OS !== "web") {
        doMaintainScrollAtEnd(ctx, { immediate: true });
    }
}

export function updateItemSizes(ctx: StateContext, measurement: ItemSizeMeasurement) {
    if (activeItemSizeBatches) {
        const measurements = activeItemSizeBatches.get(ctx);
        if (measurements) {
            measurements.push(measurement);
        } else {
            activeItemSizeBatches.set(ctx, [measurement]);
        }
    } else {
        updateItemSizesBatch(ctx, [measurement]);
    }
}

export function isContainerItemCurrent(ctx: StateContext, containerId: number, itemKey: string) {
    if (peek$(ctx, `containerItemKey${containerId}`) !== itemKey) return false;
    const state = ctx.state;
    const index = state.indexByKey.get(itemKey);
    if (index !== undefined && index < state.props.data.length && getId(state, index) === itemKey) return true;

    // The parent refreshes the index map after child layout effects. Remeasure the
    // committed slot afterward, including when recycling has changed its assignment.
    state.scheduledWork.microtask(
        () => ctx.containerLayoutTriggers.get(containerId)?.(),
        `containerMeasurementRetry${containerId}`,
    );
    return false;
}

// Applies every measurement from one committed layout pass before recalculating positions once.
export function updateItemSizesBatch(ctx: StateContext, measurements: ItemSizeMeasurement[]) {
    const state = ctx.state;
    const result: ItemSizeUpdateResult = {};
    const previousTotalSize = state.totalSize;

    for (const measurement of measurements) {
        // Measurements can arrive after recycling. Only explicit imperative sizes,
        // which have no container id, bypass the current-assignment check.
        const ownsMeasuredItem =
            measurement.containerId === undefined ||
            isContainerItemCurrent(ctx, measurement.containerId, measurement.itemKey);
        if (ownsMeasuredItem) {
            const index = state.indexByKey.get(measurement.itemKey);
            const itemData = index === undefined ? undefined : state.props.data?.[index];
            const metadata =
                measurement.containerId !== undefined && index !== undefined && itemData !== undefined
                    ? resolveContainerItemMetadata(state, measurement.containerId, index, itemData)
                    : undefined;
            const nextResult = applyItemSize(ctx, measurement.itemKey, measurement.size, metadata);
            mergeItemSizeUpdateResult(result, nextResult);
        }
    }

    // Total-size subscribers can commit synchronously, hiding a browser end clamp.
    // Capture it before publishing; the follow microtask uses the committed geometry.
    if (result.shouldMaintainScrollAtEnd && Platform.OS === "web") {
        doMaintainScrollAtEnd(ctx, { prepareOnly: true });
    }

    // Publish the batch total before recalculating scroll positions. If the total is unchanged,
    // preserve any published old-architecture pending shrink or temporary padding compensation.
    if (state.totalSize !== previousTotalSize) {
        set$(ctx, "totalSize", state.totalSize);
    }

    flushItemSizeUpdates(ctx, result);
}

function applyItemSize(
    ctx: StateContext,
    itemKey: string,
    sizeObj: { width: number; height: number },
    resolvedMeasurementItem?: ResolvedItemSize,
) {
    const state = ctx.state;
    const wasPendingEndMeasurement = !!state.pendingEndMeasurements?.delete(itemKey);
    const userScrollAnchorReset = state.userScrollAnchorReset;
    const didMeasureUserScrollAnchorResetItem = !!userScrollAnchorReset?.keys.delete(itemKey);
    const {
        didContainersLayout,
        sizesKnown,
        props: { getFixedItemSize, getItemType, horizontal, onItemSizeChanged, data, maintainScrollAtEnd },
    } = state;
    if (!data) return { didMeasureUserScrollAnchorResetItem };

    const index = state.indexByKey.get(itemKey)!;
    if (getFixedItemSize) {
        if (index === undefined) {
            return { didMeasureUserScrollAnchorResetItem };
        }
        const itemData = state.props.data[index];
        if (itemData === undefined) {
            return { didMeasureUserScrollAnchorResetItem };
        }
        if (!resolvedMeasurementItem?.didResolveFixedItemSize) {
            const type = resolvedMeasurementItem?.itemType ?? (getItemType ? (getItemType(itemData, index) ?? "") : "");
            resolvedMeasurementItem = {
                didResolveFixedItemSize: true,
                fixedItemSize: getFixedItemSize(itemData, index, type),
                itemType: type,
            };
        }
        const size = resolvedMeasurementItem.fixedItemSize;
        if (size !== undefined && size === sizesKnown.get(itemKey)) {
            updateOtherAxisSizeIfNeeded(ctx, sizeObj, horizontal);
            return { didMeasureUserScrollAnchorResetItem };
        }
    }

    // Need to calculate if haven't all laid out yet
    let needsRecalculate = !didContainersLayout;

    const prevSizeKnown = state.sizesKnown.get(itemKey);
    const didMeasurePendingEnd = prevSizeKnown === undefined && !!state.pendingMaintainScrollAtEnd;

    const diff = updateOneItemSize(ctx, itemKey, sizeObj, resolvedMeasurementItem, false);
    const size = roundSize(horizontal ? sizeObj.width : sizeObj.height);

    if (diff !== 0) {
        // Check if item is in view
        const { startBuffered, endBuffered } = state;
        needsRecalculate ||= index >= startBuffered && index <= endBuffered;
        needsRecalculate ||= state.containerItemKeys.has(itemKey);

        // Call onItemSizeChanged callback
        onItemSizeChanged?.({
            index,
            itemData: state.props.data[index],
            itemKey,
            previous: size - diff,
            size,
        });

        state.positionRecalculationStartIndex = Math.min(state.positionRecalculationStartIndex ?? index, index);
    }
    updateOtherAxisSizeIfNeeded(ctx, sizeObj, horizontal);

    if (didContainersLayout || checkAllSizesKnown(state, state.startBuffered, state.endBuffered)) {
        const canMaintainScrollAtEnd =
            ((diff !== 0 && prevSizeKnown !== size) || didMeasurePendingEnd) &&
            (!!maintainScrollAtEnd?.onItemLayout || wasPendingEndMeasurement || !!state.pendingMaintainScrollAtEnd);
        return {
            didChange: diff !== 0,
            didMeasureUserScrollAnchorResetItem,
            needsRecalculate,
            shouldMaintainScrollAtEnd: canMaintainScrollAtEnd,
        };
    }

    return {
        didChange: diff !== 0,
        didMeasureUserScrollAnchorResetItem,
    };
}

export function updateOneItemSize(
    ctx: StateContext,
    itemKey: string,
    sizeObj: { width: number; height: number },
    resolvedMeasurementItem?: ResolvedItemSize,
    notifyTotalSize = true,
) {
    const state = ctx.state;
    const {
        indexByKey,
        sizesKnown,
        averageSizes,
        props: { data, horizontal, getItemType, getFixedItemSize },
    } = state;
    if (!data) return 0;

    const index = indexByKey.get(itemKey)!;

    const itemData = data[index];
    let itemType = resolvedMeasurementItem?.itemType;
    let fixedItemSize = resolvedMeasurementItem?.fixedItemSize;
    if (getFixedItemSize && !resolvedMeasurementItem?.didResolveFixedItemSize) {
        itemType = getItemType ? (getItemType(itemData, index) ?? "") : "";
        fixedItemSize = getFixedItemSize(itemData, index, itemType);
    }
    const resolvedItemSize =
        resolvedMeasurementItem?.didResolveFixedItemSize || itemType !== undefined || fixedItemSize !== undefined
            ? {
                  didResolveFixedItemSize: resolvedMeasurementItem?.didResolveFixedItemSize,
                  fixedItemSize,
                  itemType,
              }
            : undefined;
    const prevSize = getItemSize(
        ctx,
        itemKey,
        index,
        itemData,
        undefined,
        undefined,
        notifyTotalSize,
        resolvedItemSize,
    );
    const rawSize = horizontal ? sizeObj.width : sizeObj.height;
    if (fixedItemSize === undefined) {
        state.fixedItemSizeKeys?.delete(itemKey);
    } else {
        state.fixedItemSizeKeys ??= new Set();
        state.fixedItemSizeKeys.add(itemKey);
    }
    const prevSizeKnown = sizesKnown.get(itemKey);
    if (Platform.OS !== "web" && prevSizeKnown !== undefined && isNativeLayoutNoise(rawSize - prevSizeKnown)) {
        return 0;
    }

    // On web, prefer whole-pixel sizes to avoid cumulative subpixel gaps/overlaps with transforms
    const size = Platform.OS === "web" ? Math.round(rawSize) : roundSize(rawSize);
    if (prevSizeKnown !== size) state.positionsAreCurrent = false;
    sizesKnown.set(itemKey, size);

    // Update averages per item type
    // Don't update averages if size is 0, because it likely is rendering conditionally
    // and that shouldn't affect averages.
    if (fixedItemSize === undefined && size > 0) {
        itemType ??= getItemType ? (getItemType(itemData, index) ?? "") : "";
        let averages = averageSizes[itemType];
        if (!averages) {
            averages = averageSizes[itemType] = { avg: 0, num: 0 };
        }

        // If averages were just reset then the number might be 0
        if (averages.num === 0) {
            averages.avg = size;
            averages.num++;
        }
        // TODO: It's possible there might be an issue with items toggling to/from 0 as it might skip
        // this first block if previous size was 0. But I think it's won't cause any real problems so it's fine.
        else if (prevSizeKnown !== undefined && prevSizeKnown > 0) {
            // Add the diff / num
            averages.avg += (size - prevSizeKnown) / averages.num;
        } else {
            // Add size to total and divide by new num
            averages.avg = (averages.avg * averages.num + size) / (averages.num + 1);
            averages.num++;
        }
    }

    // Update saved size if it changed
    if (!prevSize || Math.abs(prevSize - size) > 0.1) {
        setSize(ctx, itemKey, size, notifyTotalSize);
        return size - prevSize;
    }
    return 0;
}
