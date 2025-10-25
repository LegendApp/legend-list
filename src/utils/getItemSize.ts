import { setSize } from "@/core/setSize";
import { peek$, type StateContext } from "@/state/state";
import type { InternalState } from "@/types";
import { roundSize } from "@/utils/helpers";

export function getItemSize(
    ctx: StateContext,
    state: InternalState,
    key: string,
    index: number,
    data: any,
    useAverageSize?: boolean,
) {
    const {
        sizesKnown,
        sizes,
        averageSizes,
        props: { estimatedItemSize, getEstimatedItemSize, getFixedItemSize, getItemType },
    } = state;
    const sizeKnown = sizesKnown.get(key)!;
    if (sizeKnown !== undefined) {
        return sizeKnown;
    }

    let size: number | undefined;

    const itemType = getItemType ? (getItemType(data, index) ?? "") : "";
    const scrollingTo = peek$(ctx, "scrollingTo");

    if (getFixedItemSize) {
        size = getFixedItemSize(index, data, itemType);
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
        size = getEstimatedItemSize ? getEstimatedItemSize(index, data, itemType) : estimatedItemSize!;
    }

    setSize(ctx, state, key, size);

    return size;
}
