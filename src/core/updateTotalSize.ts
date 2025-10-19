import { type StateContext, set$ } from "@/state/state";
import type { InternalState } from "@/types";
import { getId } from "@/utils/getId";
import { getItemSize } from "@/utils/getItemSize";
import { updateAlignItemsPaddingTop } from "@/utils/updateAlignItemsPaddingTop";

export function updateTotalSize(ctx: StateContext, state: InternalState) {
    const {
        positions,
        props: { data },
    } = state;

    if (data.length === 0) {
        addTotalSize(ctx, state, null, 0);
    } else {
        const lastId = getId(state, data.length - 1);
        if (lastId !== undefined) {
            const lastPosition = positions.get(lastId);
            if (lastPosition !== undefined) {
                const lastSize = getItemSize(ctx, state, lastId, data.length - 1, data[data.length - 1]);
                // TODO: This is likely incorrect for columns with rows having different heights, need to get max size of the last row
                if (lastSize !== undefined) {
                    const totalSize = lastPosition + lastSize;
                    addTotalSize(ctx, state, null, totalSize);
                }
            }
        }
    }
}

export function addTotalSize(ctx: StateContext, state: InternalState, key: string | null, add: number) {
    const { alignItemsAtEnd } = state.props;

    const prevTotalSize = state.totalSize;

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

    if (prevTotalSize !== state.totalSize) {
        set$(ctx, "totalSize", state.totalSize);

        if (alignItemsAtEnd) {
            updateAlignItemsPaddingTop(ctx, state);
        }
    }
}
