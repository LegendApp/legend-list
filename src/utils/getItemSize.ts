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
    notifyTotalSize?: boolean,
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
    // Exact measured sizes always win.
    if (sizeKnown !== undefined) {
        return sizeKnown;
    }

    let size: number | undefined;
    const renderedSize = sizes.get(key);

    // Some callers need the last rendered measurement to win over any average-based fallback.
    if (preferCachedSize) {
        if (renderedSize !== undefined) {
            return renderedSize;
        }
    }

    const itemType = getItemType ? (getItemType(data, index) ?? "") : "";

    // A fixed-size resolver is authoritative and promotes the result to known size immediately.
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

    // Reuse a rendered measurement before falling back to scroll-scoped or estimated values.
    if (size === undefined && renderedSize !== undefined) {
        return renderedSize;
    }

    // While scrolling to a target, use the average snapshot captured at scroll start instead of the live average.
    if (size === undefined && useAverageSize && sizeKnown === undefined && scrollingTo) {
        const averageSizeForType = scrollingTo.averageSizeSnapshot?.[itemType];
        if (averageSizeForType !== undefined) {
            size = roundSize(averageSizeForType);
        }
    }

    // Last fallback: explicit estimated-size resolver or the static estimatedItemSize prop.
    if (size === undefined) {
        // Get estimated size if we don't have an average or already cached size
        size = getEstimatedItemSize ? getEstimatedItemSize(data, index, itemType) : estimatedItemSize!;
    }

    setSize(ctx, key, size, notifyTotalSize);

    return size;
}

export function getItemSizeAtIndex(ctx: StateContext, index: number | undefined) {
    if (index === undefined || index < 0) {
        return undefined;
    }

    const targetId = getId(ctx.state, index);
    return getItemSize(ctx, targetId, index, ctx.state.props.data[index]);
}
