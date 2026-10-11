import { getDataItem } from "@/core/IndexedData";
import { setSize } from "@/core/setSize";
import type { StateContext } from "@/state/state";
import { normalizeLayoutSize } from "@/utils/layoutMeasurement";
import { getId } from "./getId";

export interface ResolvedItemSize {
    didResolveFixedItemSize?: boolean;
    fixedItemSize?: number;
    itemType?: string;
}

export function getFixedItemLayoutSize(ctx: StateContext, index: number, data: any, resolved?: ResolvedItemSize) {
    const state = ctx.state;
    const { getFixedItemSize, getItemType } = state.props;
    let size: number | undefined;

    if (getFixedItemSize) {
        const itemType = resolved?.itemType ?? (getItemType ? (getItemType(data, index) ?? "") : "");
        const fixedSize = resolved?.didResolveFixedItemSize
            ? resolved.fixedItemSize
            : getFixedItemSize(data, index, itemType);
        if (fixedSize !== undefined) {
            size = normalizeLayoutSize(fixedSize + ctx.scrollAxisGap);
        }
    }

    return size;
}

function getKnownOrFixedSize(
    ctx: StateContext,
    key: string | undefined,
    index: number,
    data: any,
    resolved?: ResolvedItemSize,
) {
    const state = ctx.state;
    let size = key ? state.sizesKnown.get(key) : undefined;

    if (size === undefined && key) {
        const fixedLayoutSize = getFixedItemLayoutSize(ctx, index, data, resolved);
        if (fixedLayoutSize !== undefined) {
            size = fixedLayoutSize;
            state.sizesKnown.set(key, size);
        }
    }

    return size;
}

export function getKnownOrFixedItemSize(ctx: StateContext, index: number) {
    const key = getId(ctx.state, index);
    return getKnownOrFixedSize(ctx, key, index, getDataItem(ctx.state, index));
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
    notifyTotalSize?: boolean,
    resolved?: ResolvedItemSize,
) {
    const state = ctx.state;
    const sizeKnown = state.sizesKnown.get(key);
    if (sizeKnown !== undefined) {
        return sizeKnown;
    }

    const fixedSize = getKnownOrFixedSize(ctx, key, index, data, resolved);
    if (fixedSize !== undefined) {
        setSize(ctx, key, fixedSize, notifyTotalSize);
        return fixedSize;
    }

    const renderedSize = state.sizes.get(key);
    if (renderedSize !== undefined) {
        return renderedSize;
    }

    const size = state.props.estimatedItemSize! + ctx.scrollAxisGap;
    setSize(ctx, key, size, notifyTotalSize);
    return size;
}

export function getItemSizeAtIndex(ctx: StateContext, index: number | undefined) {
    if (index === undefined || index < 0) {
        return undefined;
    }

    const targetId = getId(ctx.state, index);
    return getItemSize(ctx, targetId, index, getDataItem(ctx.state, index));
}
