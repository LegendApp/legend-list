import { setSize } from "@/core/setSize";
import type { StateContext } from "@/state/state";
import { roundSize } from "@/utils/helpers";
import { getId } from "./getId";

interface ResolvedItemSize {
    didResolveFixedItemSize?: boolean;
    fixedItemSize?: number;
    itemType?: string;
}

function getKnownOrFixedSize(
    ctx: StateContext,
    key: string | undefined,
    index: number,
    data: any,
    resolved?: ResolvedItemSize,
) {
    const state = ctx.state;
    const { getFixedItemSize, getItemType } = state.props;
    let size = key ? state.sizesKnown.get(key) : undefined;

    if (size === undefined && key && getFixedItemSize) {
        const itemType = resolved?.itemType ?? (getItemType ? (getItemType(data, index) ?? "") : "");
        const fixedSize = resolved?.didResolveFixedItemSize
            ? resolved.fixedItemSize
            : getFixedItemSize(data, index, itemType);
        if (fixedSize !== undefined) {
            size = fixedSize + ctx.scrollAxisGap;
            state.sizesKnown.set(key, size);
        }
    }

    return size;
}

export function getKnownOrFixedItemSize(ctx: StateContext, index: number) {
    const key = getId(ctx.state, index);
    return getKnownOrFixedSize(ctx, key, index, ctx.state.props.data[index]);
}

export function areKnownOrFixedItemSizesAvailable(ctx: StateContext, startIndex: number, endIndex: number) {
    for (let index = startIndex; index <= endIndex; index++) {
        if (getKnownOrFixedItemSize(ctx, index) === undefined) {
            return false;
        }
    }
    return true;
}

export function getItemSize(
    ctx: StateContext,
    key: string,
    index: number,
    data: any,
    useAverageSize?: boolean,
    preferCachedSize?: boolean,
    notifyTotalSize?: boolean,
    resolved?: ResolvedItemSize,
) {
    const state = ctx.state;
    const {
        sizes,
        averageSizes,
        props: { estimatedItemSize, getItemType },
        scrollingTo,
    } = state;
    const sizeKnown = state.sizesKnown.get(key);
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

    size = getKnownOrFixedSize(ctx, key, index, data, resolved);
    if (size !== undefined) {
        setSize(ctx, key, size, notifyTotalSize);
        return size;
    }

    const itemType = resolved?.itemType ?? (getItemType ? (getItemType(data, index) ?? "") : "");

    if (useAverageSize && !scrollingTo) {
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
    if (size === undefined && useAverageSize && scrollingTo) {
        const averageSizeForType = scrollingTo.averageSizeSnapshot?.[itemType];
        if (averageSizeForType !== undefined) {
            size = roundSize(averageSizeForType);
        }
    }

    // Last fallback: static estimatedItemSize prop.
    if (size === undefined) {
        size = estimatedItemSize! + ctx.scrollAxisGap;
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
