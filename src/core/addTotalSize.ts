import { IsNewArchitecture } from "@/constants-platform";
import { type StateContext, set$ } from "@/state/state";

export function addTotalSize(
    ctx: StateContext,
    key: string | null,
    add: number,
) {
    const state = ctx.state;
    const prevTotalSize = state.totalSize;

    let totalSize = state.totalSize;

    if (key === null) {
        totalSize = add;

        // If a setPaddingTop timeout is queued to revert the totalSize
        // it would set size incorrectly, so cancel it
        if (state.timeoutSetPaddingTop) {
            clearTimeout(state.timeoutSetPaddingTop);
            state.timeoutSetPaddingTop = undefined;
        }
    } else {
        totalSize += add;
    }

    if (prevTotalSize !== totalSize) {
        const shouldStagePendingTotalSize = !IsNewArchitecture && state.initialScroll && totalSize < prevTotalSize;
        if (shouldStagePendingTotalSize) {
            // Set a pendingTotalSize if the total size shrinks during initial scroll in old architecture
            // to prevent the system from adjusting scroll because it's out of bounds
            state.pendingTotalSize = totalSize;
        } else {
            state.pendingTotalSize = undefined;
            state.totalSize = totalSize;
            set$(ctx, "totalSize", totalSize);
        }
    }
}
