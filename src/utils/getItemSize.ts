import { INTERNAL_PERF_CONFIG } from "@/core/internalPerfConfig";
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
        averageSizes,
        props: { estimatedItemSize, getEstimatedItemSize, getFixedItemSize, getItemType },
        scrollingTo,
    } = state;
    const sizeKnown = sizesKnown.get(key)!;
    if (sizeKnown !== undefined) {
        return sizeKnown;
    }

    const itemType = getItemType ? (getItemType(data, index) ?? "") : "";
    const scrollTargetIndex = state.scrollingTo?.index;
    const shouldLogForScrollTarget =
        INTERNAL_PERF_CONFIG.log && scrollTargetIndex !== undefined && Math.abs(index - scrollTargetIndex) <= 3;
    const logSource = (source: "cached" | "estimated" | "average" | "fixed") => {
        if (!shouldLogForScrollTarget) {
            return;
        }

        console.log(
            "[legend-list][perf]",
            JSON.stringify({
                average: averageSizes[itemType]?.avg,
                cachedSize: sizes.get(key),
                estimatedItemSize,
                event: "getItemSize-source",
                index,
                itemKey: key,
                scrollingTo: state.scrollingTo
                    ? {
                          animated: !!state.scrollingTo.animated,
                          index: state.scrollingTo.index,
                          offset: state.scrollingTo.offset,
                          targetOffset: state.scrollingTo.targetOffset,
                      }
                    : undefined,
                sizeKnown,
                source,
            }),
        );
    };

    let size: number | undefined;
    let shouldPersistSize = false;

    if (preferCachedSize) {
        const cachedSize = sizes.get(key);
        if (cachedSize !== undefined) {
            logSource("cached");
            return cachedSize;
        }
    }

    if (getFixedItemSize) {
        size = getFixedItemSize(data, index, itemType);
        if (size !== undefined) {
            sizesKnown.set(key, size);
            shouldPersistSize = true;
            logSource("fixed");
        }
    }

    // useAverageSize will be false if getEstimatedItemSize is defined
    if (size === undefined && useAverageSize && sizeKnown === undefined && !scrollingTo) {
        // Use item type specific average if available
        const averageSizeForType = averageSizes[itemType]?.avg;
        if (averageSizeForType !== undefined) {
            size = roundSize(averageSizeForType);
            shouldPersistSize = true;
            logSource("average");
        }
    }

    if (size === undefined) {
        size = sizes.get(key)!;

        if (size !== undefined) {
            logSource("cached");
            return size;
        }
    }

    if (size === undefined) {
        // Get estimated size if we don't have an average or already cached size
        size = getEstimatedItemSize ? getEstimatedItemSize(data, index, itemType) : estimatedItemSize!;
        logSource("estimated");
    }

    if (shouldPersistSize) {
        setSize(ctx, key, size);
    }

    return size;
}
