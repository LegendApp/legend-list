import { IsNewArchitecture } from "@/constants-platform";
import { calculateItemsInView } from "@/core/calculateItemsInView";
import { doMaintainScrollAtEnd } from "@/core/doMaintainScrollAtEnd";
import { setSize } from "@/core/setSize";
import { maybeUpdateAnchoredEndSpace } from "@/core/updateAnchoredEndSpace";
import { Platform } from "@/platform/Platform";
import { peek$, type StateContext, set$ } from "@/state/state";
import { checkAllSizesKnown } from "@/utils/checkAllSizesKnown";
import { getItemSize } from "@/utils/getItemSize";
import { roundSize } from "@/utils/helpers";
import { isNativeLayoutNoise } from "@/utils/layoutMeasurement";

export function runOrScheduleMVCPRecalculate(ctx: StateContext) {
    // Runs the MVCP recalculation pass after item-size changes.
    // On web, an active anchor lock coalesces recalculations to one RAF to reduce oscillating adjustments.
    const state = ctx.state;

    if (state.userScrollAnchorReset !== undefined) {
        calculateItemsInView(ctx);
        if (state.userScrollAnchorReset?.keys.size === 0) {
            state.userScrollAnchorReset = undefined;
        }
    } else if (Platform.OS === "web") {
        if (!state.mvcpAnchorLock) {
            if (state.queuedMVCPRecalculate !== undefined) {
                cancelAnimationFrame(state.queuedMVCPRecalculate);
                state.queuedMVCPRecalculate = undefined;
            }
            calculateItemsInView(ctx, { doMVCP: true });
        } else if (state.queuedMVCPRecalculate === undefined) {
            state.queuedMVCPRecalculate = requestAnimationFrame(() => {
                state.queuedMVCPRecalculate = undefined;
                calculateItemsInView(ctx, { doMVCP: true });
            });
        }
    } else {
        calculateItemsInView(ctx, { doMVCP: true });
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

interface ResolvedMeasurementItem {
    didResolveFixedItemSize?: boolean;
    fixedItemSize?: number;
    itemData?: any;
    itemType?: string;
}

export interface ItemSizeMeasurement {
    containerId?: number;
    fromLayoutEffect?: boolean;
    itemKey: string;
    size: { width: number; height: number };
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
    if (result.needsRecalculate) {
        state.scrollForNextCalculateItemsInView = undefined;
        runOrScheduleMVCPRecalculate(ctx);
    } else if (result.didMeasureUserScrollAnchorResetItem && state.userScrollAnchorReset?.keys.size === 0) {
        state.userScrollAnchorReset = undefined;
    }
    if (result.didChange && result.shouldMaintainScrollAtEnd) {
        doMaintainScrollAtEnd(ctx);
    }
}

/**
 * Updates the current measured item. On Fabric layout-effect measurements, also synchronously
 * measures any pending replacement containers so the whole pass resolves with one recalc.
 */
export function updateItemSizes(ctx: StateContext, measurement: ItemSizeMeasurement) {
    const state = ctx.state;
    const pendingKeys = state.userScrollAnchorReset?.keys;
    const shouldBatchPendingMeasurements = IsNewArchitecture && measurement.fromLayoutEffect && !!pendingKeys?.size;

    if (!shouldBatchPendingMeasurements) {
        flushItemSizeUpdates(ctx, applyItemSize(ctx, measurement.itemKey, measurement.size));
    } else {
        const result: ItemSizeUpdateResult = {};

        const updateContainerItemSize = (
            itemKey: string,
            containerId: number | undefined,
            size: { width: number; height: number },
        ) => {
            if (containerId !== undefined && peek$(ctx, `containerItemKey${containerId}`) === itemKey) {
                mergeItemSizeUpdateResult(result, applyItemSize(ctx, itemKey, size));
            }
        };

        updateContainerItemSize(measurement.itemKey, measurement.containerId, measurement.size);

        const keys = Array.from(pendingKeys);
        for (const itemKey of keys) {
            const containerId = state.containerItemKeys.get(itemKey);
            if (containerId !== undefined) {
                ctx.viewRefs.get(containerId)?.current?.measure?.((_x, _y, width, height) => {
                    if (pendingKeys.has(itemKey)) {
                        updateContainerItemSize(itemKey, containerId, { height, width });
                    }
                });
            }
        }

        flushItemSizeUpdates(ctx, result);
    }
}

function applyItemSize(ctx: StateContext, itemKey: string, sizeObj: { width: number; height: number }) {
    const state = ctx.state;
    const userScrollAnchorReset = state.userScrollAnchorReset;
    const didMeasureUserScrollAnchorResetItem = !!userScrollAnchorReset?.keys.delete(itemKey);
    const {
        didContainersLayout,
        sizesKnown,
        props: { getFixedItemSize, getItemType, horizontal, onItemSizeChanged, data, maintainScrollAtEnd },
    } = state;
    if (!data) return { didMeasureUserScrollAnchorResetItem };

    const index = state.indexByKey.get(itemKey)!;
    let resolvedMeasurementItem: ResolvedMeasurementItem | undefined;

    if (getFixedItemSize) {
        if (index === undefined) {
            return { didMeasureUserScrollAnchorResetItem };
        }
        const itemData = state.props.data[index];
        if (itemData === undefined) {
            return { didMeasureUserScrollAnchorResetItem };
        }
        const type = getItemType ? (getItemType(itemData, index) ?? "") : "";
        const size = getFixedItemSize(itemData, index, type);
        resolvedMeasurementItem = {
            didResolveFixedItemSize: true,
            fixedItemSize: size,
            itemData,
            itemType: type,
        };
        if (size !== undefined && size === sizesKnown.get(itemKey)) {
            updateOtherAxisSizeIfNeeded(ctx, sizeObj, horizontal);
            return { didMeasureUserScrollAnchorResetItem };
        }
    }

    // Need to calculate if haven't all laid out yet
    let needsRecalculate = !didContainersLayout;
    let shouldMaintainScrollAtEnd = false;
    let minIndexSizeChanged: number | undefined;

    const prevSizeKnown = state.sizesKnown.get(itemKey);

    const diff = updateOneItemSize(ctx, itemKey, sizeObj, resolvedMeasurementItem);
    const size = roundSize(horizontal ? sizeObj.width : sizeObj.height);

    if (diff !== 0) {
        minIndexSizeChanged = minIndexSizeChanged !== undefined ? Math.min(minIndexSizeChanged, index) : index;

        // Check if item is in view
        const { startBuffered, endBuffered } = state;
        needsRecalculate ||= index >= startBuffered && index <= endBuffered;
        if (!needsRecalculate && state.containerItemKeys.has(itemKey)) {
            needsRecalculate = true;
        }

        // Check if we should maintain scroll at end
        if (prevSizeKnown !== undefined && Math.abs(prevSizeKnown - size) > 5) {
            shouldMaintainScrollAtEnd = true;
        }

        // Call onItemSizeChanged callback
        onItemSizeChanged?.({
            index,
            itemData: state.props.data[index],
            itemKey,
            previous: size - diff,
            size,
        });

        maybeUpdateAnchoredEndSpace(ctx);
    }

    // Update state with minimum changed index
    if (minIndexSizeChanged !== undefined) {
        state.minIndexSizeChanged =
            state.minIndexSizeChanged !== undefined
                ? Math.min(state.minIndexSizeChanged, minIndexSizeChanged)
                : minIndexSizeChanged;
    }

    updateOtherAxisSizeIfNeeded(ctx, sizeObj, horizontal);

    if (didContainersLayout || checkAllSizesKnown(state, state.startBuffered, state.endBuffered)) {
        const canMaintainScrollAtEnd = shouldMaintainScrollAtEnd && !!maintainScrollAtEnd?.onItemLayout;
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
    resolvedMeasurementItem?: ResolvedMeasurementItem,
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

    const itemData = resolvedMeasurementItem?.itemData ?? data[index];
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
    const prevSize = getItemSize(ctx, itemKey, index, itemData, undefined, undefined, undefined, resolvedItemSize);
    const rawSize = horizontal ? sizeObj.width : sizeObj.height;
    const prevSizeKnown = sizesKnown.get(itemKey);
    if (Platform.OS !== "web" && prevSizeKnown !== undefined && isNativeLayoutNoise(rawSize - prevSizeKnown)) {
        return 0;
    }

    // On web, prefer whole-pixel sizes to avoid cumulative subpixel gaps/overlaps with transforms
    const size = Platform.OS === "web" ? Math.round(rawSize) : roundSize(rawSize);
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
        setSize(ctx, itemKey, size);
        return size - prevSize;
    }
    return 0;
}
