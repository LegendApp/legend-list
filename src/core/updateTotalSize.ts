import { addTotalSize } from "@/core/addTotalSize";
import { logInitialScrollTrace } from "@/core/logInitialScrollTrace";
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
        logInitialScrollTrace(ctx, "updateTotalSize", {
            computedTotalSize: 0,
            dataLength: data.length,
            source: "empty-data",
        });
        addTotalSize(ctx, null, 0, { source: "updateTotalSize:empty-data" });
    } else {
        const lastIndex = data.length - 1;
        const lastId = getId(state, lastIndex);
        const lastPosition = positions[lastIndex];
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

                const totalSize = lastPosition + maxSize;
                logInitialScrollTrace(ctx, "updateTotalSize", {
                    computedTotalSize: totalSize,
                    dataLength: data.length,
                    lastId,
                    lastIndex,
                    lastPosition,
                    lastSize: maxSize,
                    rowStart,
                    source: "multi-column",
                });
                addTotalSize(ctx, null, totalSize, {
                    lastIndex,
                    lastPosition,
                    lastSize: maxSize,
                    rowStart,
                    source: "updateTotalSize:multi-column",
                });
            } else {
                const lastSize = getItemSize(ctx, lastId, lastIndex, data[lastIndex]);
                if (lastSize !== undefined) {
                    const totalSize = lastPosition + lastSize;
                    logInitialScrollTrace(ctx, "updateTotalSize", {
                        computedTotalSize: totalSize,
                        dataLength: data.length,
                        lastId,
                        lastIndex,
                        lastPosition,
                        lastSize,
                        source: "single-column",
                    });
                    addTotalSize(ctx, null, totalSize, {
                        lastIndex,
                        lastPosition,
                        lastSize,
                        source: "updateTotalSize:single-column",
                    });
                }
            }
        }
    }
}
