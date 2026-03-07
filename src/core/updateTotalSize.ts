import { addTotalSize } from "@/core/addTotalSize";
import { Platform } from "@/platform/Platform";
import { peek$, type StateContext } from "@/state/state";
import { getId } from "@/utils/getId";
import { getItemSize } from "@/utils/getItemSize";

export function updateTotalSize(ctx: StateContext) {
    const state = ctx.state;
    const shouldLogNativeMVCP =
        Platform.OS !== "web" &&
        (state.didDataChange || state.dataChangeNeedsScrollUpdate || !!state.pendingNativeMVCPAdjust);
    const {
        positions,
        props: { data },
    } = state;
    const numColumns = peek$(ctx, "numColumns") ?? 1;

    if (data.length === 0) {
        addTotalSize(ctx, null, 0);
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

                if (shouldLogNativeMVCP) {
                    console.info("[legend-list][mvcp] updateTotalSize", {
                        computedTotalSize: lastPosition + maxSize,
                        dataLength: data.length,
                        lastIndex,
                        lastPosition,
                        maxSize,
                        mode: "multi-column",
                        pendingNativeAmount: state.pendingNativeMVCPAdjust?.amount,
                        pendingNativeStartScroll: state.pendingNativeMVCPAdjust?.startScroll,
                        prevStateTotalSize: state.totalSize,
                        rowStart,
                    });
                }
                addTotalSize(ctx, null, lastPosition + maxSize);
            } else {
                const lastSize = getItemSize(ctx, lastId, lastIndex, data[lastIndex]);
                if (lastSize !== undefined) {
                    const totalSize = lastPosition + lastSize;
                    if (shouldLogNativeMVCP) {
                        console.info("[legend-list][mvcp] updateTotalSize", {
                            computedTotalSize: totalSize,
                            dataLength: data.length,
                            lastId,
                            lastIndex,
                            lastPosition,
                            lastSize,
                            mode: "single-column",
                            pendingNativeAmount: state.pendingNativeMVCPAdjust?.amount,
                            pendingNativeStartScroll: state.pendingNativeMVCPAdjust?.startScroll,
                            prevStateTotalSize: state.totalSize,
                        });
                    }
                    addTotalSize(ctx, null, totalSize);
                }
            }
        }
    }
}
