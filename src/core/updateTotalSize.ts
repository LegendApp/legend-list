import { addTotalSize } from "@/core/addTotalSize";
import type { StateContext } from "@/state/state";
import { getId } from "@/utils/getId";
import { getItemSize } from "@/utils/getItemSize";

export function updateTotalSize(ctx: StateContext) {
    const state = ctx.state!;
    const {
        positions,
        props: { data },
    } = state;

    if (data.length === 0) {
        addTotalSize(ctx, null, 0);
    } else {
        const lastId = getId(state, data.length - 1);
        if (lastId !== undefined) {
            const lastPosition = positions.get(lastId);
            if (lastPosition !== undefined) {
                const lastSize = getItemSize(ctx, lastId, data.length - 1, data[data.length - 1]);
                // TODO: This is likely incorrect for columns with rows having different heights, need to get max size of the last row
                if (lastSize !== undefined) {
                    const totalSize = lastPosition + lastSize;
                    addTotalSize(ctx, null, totalSize);
                }
            }
        }
    }
}
