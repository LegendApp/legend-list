import { getDeferredPublishedSizeFloor } from "@/core/deferredPositions";
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

        const publishedSizeFloor =
            getDeferredPublishedSizeFloor(state.deferredPositions) ??
            (state.initialScroll && state.initialScrollUsesOffset && totalSizeExact < prevPublishedTotalSize
                ? prevPublishedTotalSize
                : undefined);
        if (publishedSizeFloor !== undefined) {
            const nextPublishedTotalSize = publishedSizeFloor;
            if (prevPublishedTotalSize !== nextPublishedTotalSize) {
                set$(ctx, "totalSize", nextPublishedTotalSize);
            }
        } else {
            if (prevPublishedTotalSize !== totalSizeExact) {
                set$(ctx, "totalSize", totalSizeExact);
            }
        }
    }
}
