import { addTotalSize } from "@/core/addTotalSize";
import { getLayoutOffset } from "@/core/layoutAccessors";
import { syncPrefixLayoutStoreTotalSize } from "@/core/prefixLayoutStoreLifecycle";
import { peek$, type StateContext } from "@/state/state";
import { getId } from "@/utils/getId";
import { getItemSize } from "@/utils/getItemSize";

type LayoutOffsetGetter = (index: number) => number | undefined;

export function updateTotalSize(ctx: StateContext) {
    const dataLength = ctx.state.props.data.length;

    if (dataLength > 0 && syncPrefixLayoutStoreTotalSize(ctx)) {
        return;
    }
    updateArrayLayoutTotalSize(ctx, undefined, dataLength);
}

export function updateArrayLayoutTotalSize(
    ctx: StateContext,
    getOffset: LayoutOffsetGetter = (index) => getLayoutOffset(ctx, index),
    dataLength = ctx.state.props.data.length,
) {
    const state = ctx.state;
    const {
        props: { data },
    } = state;
    const numColumns = peek$(ctx, "numColumns") ?? 1;

    if (dataLength === 0) {
        addTotalSize(ctx, null, 0);
    } else {
        const lastIndex = dataLength - 1;
        const lastId = getId(state, lastIndex);
        const lastPosition = getOffset(lastIndex);
        if (lastId !== undefined && lastPosition !== undefined) {
            if (numColumns > 1) {
                let rowStart = lastIndex;
                while (rowStart > 0) {
                    const column = state.columns[rowStart];
                    if (column === 1 || column === undefined) {
                        break;
                    }
                    rowStart -= 1;
                }

                let maxSize = 0;
                for (let i = rowStart; i <= lastIndex; i++) {
                    const rowId = state.idCache[i] ?? getId(state, i);
                    const size = getItemSize(ctx, rowId, i, data[i]);
                    if (size > maxSize) {
                        maxSize = size;
                    }
                }

                addTotalSize(ctx, null, lastPosition + maxSize);
            } else {
                const lastSize = getItemSize(ctx, lastId, lastIndex, data[lastIndex]);
                if (lastSize !== undefined) {
                    const totalSize = lastPosition + lastSize;
                    addTotalSize(ctx, null, totalSize);
                }
            }
        }
    }
}
