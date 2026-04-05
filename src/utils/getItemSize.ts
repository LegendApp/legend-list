import { setSize } from "@/core/setSize";
import type { StateContext } from "@/state/state";
import { roundSize } from "@/utils/helpers";
import { getId } from "./getId";

export function getItemSize(
    ctx: StateContext,
    key: string,
    index: number,
    data: any,
    useAverageSize?: boolean,
    preferCachedSize?: boolean,
) {
    const state = ctx.state;
    const {
        sizesKnown,
        sizes,
        averageSizes,
        props: { estimatedItemSize, getEstimatedItemSize, getFixedItemSize, getItemType },
        scrollingTo,
    } = state;
    const sizeKnown = sizesKnown.get(key)!;
    if (sizeKnown !== undefined) {
        return sizeKnown;
    }

    let size: number | undefined;

    if (preferCachedSize) {
        const cachedSize = sizes.get(key);
        if (cachedSize !== undefined) {
            return cachedSize;
        }
    }

    const itemType = getItemType ? (getItemType(data, index) ?? "") : "";

    if (getFixedItemSize) {
        size = getFixedItemSize(data, index, itemType);
        if (size !== undefined) {
            sizesKnown.set(key, size);
        }
    }

    // useAverageSize will be false if getEstimatedItemSize is defined
    if (size === undefined && useAverageSize && sizeKnown === undefined && !scrollingTo) {
        // Use item type specific average if available
        const averageSizeForType = averageSizes[itemType]?.avg;
        if (averageSizeForType !== undefined) {
            size = roundSize(averageSizeForType);
        }
    }

    if (size === undefined) {
        size = sizes.get(key)!;

        if (size !== undefined) {
            return size;
        }
    }

    if (size === undefined) {
        // Get estimated size if we don't have an average or already cached size
        size = getEstimatedItemSize ? getEstimatedItemSize(data, index, itemType) : estimatedItemSize!;
    }

    setSize(ctx, key, size);

    return size;
}

export function getItemSizeAtIndex(ctx: StateContext, index: number | undefined) {
    if (index === undefined || index < 0) {
        return undefined;
    }

    const targetId = getId(ctx.state, index);
    return getItemSize(ctx, targetId, index, ctx.state.props.data[index]);
}
