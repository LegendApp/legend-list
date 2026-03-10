import { setSize } from "@/core/setSize";
import type { StateContext } from "@/state/state";
import { roundSize } from "@/utils/helpers";

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
        staticEstimatedItemKeys,
        averageSizes,
        props: { estimatedItemSize, getEstimatedItemSize, getFixedItemSize, getItemType },
        scrollingTo,
    } = state;
    const sizeKnown = sizesKnown.get(key)!;
    if (sizeKnown !== undefined) {
        return sizeKnown;
    }

    const itemType = getItemType ? (getItemType(data, index) ?? "") : "";

    let size: number | undefined;
    let shouldPersistSize = false;

    if (preferCachedSize) {
        const cachedSize = sizes.get(key);
        if (cachedSize !== undefined && !staticEstimatedItemKeys.has(key)) {
            return cachedSize;
        }
    }

    if (getFixedItemSize) {
        size = getFixedItemSize(data, index, itemType);
        if (size !== undefined) {
            sizesKnown.set(key, size);
            shouldPersistSize = true;
        }
    }

    // useAverageSize will be false if getEstimatedItemSize is defined
    if (size === undefined && useAverageSize && sizeKnown === undefined && !scrollingTo) {
        // Use item type specific average if available
        const averageSizeForType = averageSizes[itemType]?.avg;
        if (averageSizeForType !== undefined) {
            size = roundSize(averageSizeForType);
            shouldPersistSize = true;
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
        shouldPersistSize = size !== undefined;
    }

    if (shouldPersistSize) {
        if (getEstimatedItemSize === undefined && size === estimatedItemSize) {
            staticEstimatedItemKeys.add(key);
        } else {
            staticEstimatedItemKeys.delete(key);
        }
        setSize(ctx, key, size);
    }

    return size;
}
