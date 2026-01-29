import { addTotalSize } from "@/core/addTotalSize";
import { peek$, type StateContext } from "@/state/state";
import { getId } from "@/utils/getId";
import { getItemSize } from "@/utils/getItemSize";

export function updateTotalSize(ctx: StateContext) {
    const state = ctx.state;
    const {
        positions,
        props: { data },
    } = state;
    const numColumns = peek$(ctx, "numColumns") ?? 1;

    if (data.length === 0) {
        addTotalSize(ctx, null, 0);
    } else {
        const lastId = getId(state, data.length - 1);
        if (lastId !== undefined) {
            const lastPosition = positions.get(lastId);
            if (lastPosition !== undefined) {
                if (numColumns > 1) {
                    let rowStart = data.length - 1;
                    while (rowStart > 0) {
                        const rowId = state.idCache[rowStart] ?? getId(state, rowStart);
                        const column = state.columns.get(rowId);
                        if (column === 1 || column === undefined) {
                            break;
                        }
                        rowStart -= 1;
                    }

                    let maxSize = 0;
                    for (let i = rowStart; i < data.length; i++) {
                        const rowId = state.idCache[i] ?? getId(state, i);
                        const size = getItemSize(ctx, rowId, i, data[i]);
                        if (size > maxSize) {
                            maxSize = size;
                        }
                    }

                    addTotalSize(ctx, null, lastPosition + maxSize);
                } else {
                    const lastSize = getItemSize(ctx, lastId, data.length - 1, data[data.length - 1]);
                    if (lastSize !== undefined) {
                        const totalSize = lastPosition + lastSize;
                        addTotalSize(ctx, null, totalSize);
                    }
                }
            }
        }
    }
}
