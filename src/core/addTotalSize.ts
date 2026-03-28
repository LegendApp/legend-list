import { IsNewArchitecture } from "@/constants-platform";
import { peek$, type StateContext, set$ } from "@/state/state";

export function addTotalSize(ctx: StateContext, key: string | null, add: number) {
    const state = ctx.state;

    const prevTotalSizeExact = state.totalSizeExact;
    const prevPublishedTotalSize = peek$(ctx, "totalSize") ?? 0;

    let totalSizeExact = state.totalSizeExact;

    if (key === null) {
        totalSizeExact = add;

        // If a setPaddingTop timeout is queued to revert the totalSize
        // it would set size incorrectly, so cancel it
        if (state.timeoutSetPaddingTop) {
            clearTimeout(state.timeoutSetPaddingTop);
            state.timeoutSetPaddingTop = undefined;
        }
    } else {
        totalSizeExact += add;
    }

    if (prevTotalSizeExact !== totalSizeExact) {
        state.totalSizeExact = totalSizeExact;

        if (!IsNewArchitecture && state.initialScroll && totalSizeExact < prevPublishedTotalSize) {
            // Set a pendingTotalSize if the total size shrinks during initial scroll in old architecture
            // to prevent the system from adjusting scroll because it's out of bounds
            state.pendingTotalSize = totalSizeExact;
        } else {
            state.pendingTotalSize = undefined;
            if (prevPublishedTotalSize !== totalSizeExact) {
                set$(ctx, "totalSize", totalSizeExact);
            }
        }
    }
}
