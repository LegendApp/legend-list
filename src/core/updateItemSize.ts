import { calculateItemsInView } from "@/core/calculateItemsInView";
import { doMaintainScrollAtEnd } from "@/core/doMaintainScrollAtEnd";
import { addTotalSize } from "@/core/updateTotalSize";
import { Platform } from "@/platform/Platform";
import { peek$, type StateContext, set$ } from "@/state/state";
import type { InternalState, MaintainScrollAtEndOptions } from "@/types";
import { checkAllSizesKnown } from "@/utils/checkAllSizesKnown";
import { getItemSize } from "@/utils/getItemSize";
import { IS_DEV } from "@/utils/devEnvironment";

export function updateItemSize(
    ctx: StateContext,
    state: InternalState,
    itemKey: string,
    sizeObj: { width: number; height: number },
) {
    const {
        sizesKnown,
        props: {
            getFixedItemSize,
            getItemType,
            horizontal,
            suggestEstimatedItemSize,
            onItemSizeChanged,
            data,
            maintainScrollAtEnd,
        },
    } = state;
    if (!data) return;

    const index = state.indexByKey.get(itemKey)!;

    if (getFixedItemSize) {
        if (index === undefined) {
            return;
        }
        const itemData = state.props.data[index];
        if (itemData === undefined) {
            return;
        }
        const type = getItemType ? (getItemType(itemData, index) ?? "") : "";
        const size = getFixedItemSize(index, itemData, type);
        if (size !== undefined && size === sizesKnown.get(itemKey)) {
            return;
        }
    }

    // Actually update the item size
    const containersDidLayout = peek$(ctx, "containersDidLayout");
    // Need to calculate if haven't all laid out yet
    let needsRecalculate = !containersDidLayout;
    let shouldMaintainScrollAtEnd = false;
    let minIndexSizeChanged: number | undefined;
    let maxOtherAxisSize = peek$(ctx, "otherAxisSize") || 0;

    const prevSizeKnown = state.sizesKnown.get(itemKey);

    const diff = updateOneItemSize(state, itemKey, sizeObj);
    const size = Math.floor((horizontal ? sizeObj.width : sizeObj.height) * 8) / 8;

    if (diff !== 0) {
        minIndexSizeChanged = minIndexSizeChanged !== undefined ? Math.min(minIndexSizeChanged, index) : index;

        // Check if item is in view
        const { startBuffered, endBuffered } = state;
        needsRecalculate ||= index >= startBuffered && index <= endBuffered;
        if (!needsRecalculate) {
            const numContainers = ctx.values.get("numContainers") as number;
            for (let i = 0; i < numContainers; i++) {
                if (peek$(ctx, `containerItemKey${i}`) === itemKey) {
                    needsRecalculate = true;
                    break;
                }
            }
        }

        // Handle other axis size
        if (state.needsOtherAxisSize) {
            const otherAxisSize = horizontal ? sizeObj.height : sizeObj.width;
            maxOtherAxisSize = Math.max(maxOtherAxisSize, otherAxisSize);
        }

        // Check if we should maintain scroll at end
        if (prevSizeKnown !== undefined && Math.abs(prevSizeKnown - size) > 5) {
            shouldMaintainScrollAtEnd = true;
        }

        addTotalSize(ctx, state, itemKey, diff);

        // Call onItemSizeChanged callback
        onItemSizeChanged?.({
            index,
            itemData: state.props.data[index],
            itemKey,
            previous: size - diff,
            size,
        });
    }

    // Update state with minimum changed index
    if (minIndexSizeChanged !== undefined) {
        state.minIndexSizeChanged =
            state.minIndexSizeChanged !== undefined
                ? Math.min(state.minIndexSizeChanged, minIndexSizeChanged)
                : minIndexSizeChanged;
    }

    // Handle dev warning about estimated size
    if (IS_DEV && suggestEstimatedItemSize && minIndexSizeChanged !== undefined) {
        if (state.timeoutSizeMessage) clearTimeout(state.timeoutSizeMessage);
        state.timeoutSizeMessage = setTimeout(() => {
            state.timeoutSizeMessage = undefined;
            const num = state.sizesKnown.size;
            const avg = state.averageSizes[""]?.avg;
            console.warn(
                `[legend-list] Based on the ${num} items rendered so far, the optimal estimated size is ${avg}.`,
            );
        }, 1000);
    }

    const cur = peek$(ctx, "otherAxisSize");
    if (!cur || maxOtherAxisSize > cur) {
        set$(ctx, "otherAxisSize", maxOtherAxisSize);
    }

    if (containersDidLayout || checkAllSizesKnown(state)) {
        if (needsRecalculate) {
            state.scrollForNextCalculateItemsInView = undefined;

            calculateItemsInView(ctx, state, { doMVCP: true });
        }
        if (shouldMaintainScrollAtEnd) {
            if (maintainScrollAtEnd === true || (maintainScrollAtEnd as MaintainScrollAtEndOptions).onItemLayout) {
                doMaintainScrollAtEnd(ctx, state, false);
            }
        }
    }
}

export function updateOneItemSize(state: InternalState, itemKey: string, sizeObj: { width: number; height: number }) {
    const {
        sizes,
        indexByKey,
        sizesKnown,
        averageSizes,
        props: { data, horizontal, getEstimatedItemSize, getItemType, getFixedItemSize },
    } = state;
    if (!data) return 0;

    const index = indexByKey.get(itemKey)!;

    const prevSize = getItemSize(state, itemKey, index, data[index]);
    const rawSize = horizontal ? sizeObj.width : sizeObj.height;
    // On web, prefer whole-pixel sizes to avoid cumulative subpixel gaps/overlaps with transforms
    const size = Platform.OS === "web" ? Math.round(rawSize) : Math.floor(rawSize * 8) / 8;

    sizesKnown.set(itemKey, size);

    // Update averages per item type
    // If user has provided getEstimatedItemSize that has precedence over averages
    // Don't update averages if size is 0, because it likely is rendering conditionally
    // and that shouldn't affect averages.
    if (!getEstimatedItemSize && !getFixedItemSize && size > 0) {
        const itemType = getItemType ? (getItemType(data[index], index) ?? "") : "";
        let averages = averageSizes[itemType];
        if (!averages) {
            averages = averageSizes[itemType] = { avg: 0, num: 0 };
        }
        averages.avg = (averages.avg * averages.num + size) / (averages.num + 1);
        averages.num++;
    }

    // Update saved size if it changed
    if (!prevSize || Math.abs(prevSize - size) > 0.1) {
        sizes.set(itemKey, size);
        return size - prevSize;
    }
    return 0;
}
