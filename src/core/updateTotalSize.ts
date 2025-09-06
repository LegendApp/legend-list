import { type StateContext, set$ } from "@/state/state";
import type { InternalState } from "@/types";
import { getId } from "@/utils/getId";
import { getItemSize } from "@/utils/getItemSize";
import { getPositionByIndex } from "@/utils/getPosition";
import { updateAlignItemsPaddingTop } from "@/utils/updateAlignItemsPaddingTop";

export function updateTotalSize(ctx: StateContext, state: InternalState) {
    const {
        props: { data },
    } = state;

    if (data.length === 0) {
        addTotalSize(ctx, state, null, 0);
    } else {
        const lastIndex = data.length - 1;
        const lastId = getId(state, lastIndex);
        if (lastId !== undefined) {
            const lastPosition = getPositionByIndex(ctx, state, lastIndex);
            if (lastPosition !== undefined) {
                const lastSize = getItemSize(state, lastId, data.length - 1, data[data.length - 1]);
                // TODO: This is likely incorrect for columns with rows having different heights, need to get max size of the last row
                if (lastSize !== undefined) {
                    const totalSize = lastPosition + lastSize;
                    addTotalSize(ctx, state, null, totalSize);
                }
            }
        }
    }
}

function addTotalSize(ctx: StateContext, state: InternalState, key: string | null, add: number) {
    const { alignItemsAtEnd } = state.props;

    if (key === null) {
        state.totalSize = add;

        // If a setPaddingTop timeout is queued to revert the totalSize
        // it would set size incorrectly, so cancel it
        if (state.timeoutSetPaddingTop) {
            clearTimeout(state.timeoutSetPaddingTop);
            state.timeoutSetPaddingTop = undefined;
        }
    } else {
        state.totalSize += add;
    }

    set$(ctx, "totalSize", state.totalSize);

    if (alignItemsAtEnd) {
        updateAlignItemsPaddingTop(ctx, state);
    }
}
