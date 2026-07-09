import { getDataItem } from "@/core/IndexedData";
import type { StateContext } from "@/state/state";
import { getFixedItemLayoutSize } from "@/utils/getItemSize";

export function materializeFixedLayoutStoreRange(ctx: StateContext, startIndex: number, endIndex: number) {
    const state = ctx.state;
    const store = state.layoutStoreRuntime?.store;
    let didChange = false;

    if (store && state.props.getFixedItemSize) {
        const start = Math.max(0, Math.trunc(startIndex));
        const end = Math.min(store.length - 1, Math.trunc(endIndex));
        for (let index = start; index <= end; index++) {
            const existingKey = state.idCache[index];
            const knownSize = existingKey !== undefined ? state.sizesKnown.get(existingKey) : undefined;
            const fixedSize = knownSize ?? getFixedItemLayoutSize(ctx, index, getDataItem(state, index));
            if (fixedSize !== undefined) {
                didChange = store.setMeasuredSize(index, fixedSize) || didChange;
                if (existingKey !== undefined) {
                    state.sizesKnown.set(existingKey, fixedSize);
                    state.sizes.set(existingKey, fixedSize);
                }
            }
        }
    }

    return didChange;
}

export function materializeFixedLayoutStoreIndex(ctx: StateContext, index: number | undefined) {
    let didChange = false;
    if (index !== undefined && Number.isInteger(index)) {
        didChange = materializeFixedLayoutStoreRange(ctx, index, index);
    }
    return didChange;
}

export function materializeFixedLayoutStoreRangeAtOffsets(ctx: StateContext, startOffset: number, endOffset: number) {
    const store = ctx.state.layoutStoreRuntime?.store;
    let range = store?.findIndexRangeAtOffsets(startOffset, endOffset);
    let didChange = false;

    if (store && range && ctx.state.props.getFixedItemSize) {
        let materializedEnd = range.start - 1;
        let nextEnd = range.end;
        while (nextEnd > materializedEnd) {
            didChange = materializeFixedLayoutStoreRange(ctx, materializedEnd + 1, nextEnd) || didChange;
            materializedEnd = nextEnd;
            range = store.findIndexRangeAtOffsets(startOffset, endOffset);
            nextEnd = range?.end ?? materializedEnd;
        }
    }

    return { didChange, range };
}
