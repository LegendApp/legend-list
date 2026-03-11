import { peek$, type StateContext, set$ } from "@/state/state";
import type { InternalState } from "@/types.base";
import { getScrollVelocity } from "@/utils/getScrollVelocity";
import { canUseDeferredGeometry } from "@/core/canUseDeferredGeometry";

const RENDERED_TOTAL_SIZE_VIEWPORT_SAFETY_PX = 1;

export function hasPendingRenderedTotalSize(state: InternalState) {
    return (
        state.pendingRenderedTotalSize !== undefined &&
        Math.abs(state.pendingRenderedTotalSize - state.renderedTotalSize) > 0.1
    );
}

export function flushRenderedTotalSize(
    ctx: StateContext,
    value = ctx.state.pendingRenderedTotalSize ?? ctx.state.totalSize,
) {
    const state = ctx.state;
    state.pendingRenderedTotalSize = undefined;
    if (state.renderedTotalSize !== value || peek$(ctx, "renderedTotalSize") !== value) {
        state.renderedTotalSize = value;
        set$(ctx, "renderedTotalSize", value);
    }
}

export function commitTotalSize(ctx: StateContext, nextTotalSize: number) {
    const state = ctx.state;
    state.totalSize = nextTotalSize;
    set$(ctx, "totalSize", nextTotalSize);
    updateRenderedTotalSize(ctx, nextTotalSize);
}

export function shouldDeferRenderedTotalSize(state: InternalState, nextTotalSize: number, numColumns: number) {
    const mismatchBoundary = Math.min(state.renderedTotalSize, nextTotalSize);
    const viewportBottom = state.scroll + state.scrollLength;
    return (
        mismatchBoundary > viewportBottom + RENDERED_TOTAL_SIZE_VIEWPORT_SAFETY_PX &&
        canUseDeferredGeometry(state, numColumns) &&
        !state.deferredPositionNeedsStablePass &&
        !state.didDataChange &&
        !state.dataChangeNeedsScrollUpdate &&
        !state.pendingNativeMVCPAdjust &&
        !state.pendingMaintainScrollAtEnd &&
        !state.postInitialSettleTarget &&
        !state.isAtEnd &&
        getScrollVelocity(state) < 0
    );
}

export function updateRenderedTotalSize(ctx: StateContext, nextTotalSize: number) {
    const state = ctx.state;
    const numColumns = peek$(ctx, "numColumns") ?? 1;

    if (shouldDeferRenderedTotalSize(state, nextTotalSize, numColumns)) {
        state.pendingRenderedTotalSize = nextTotalSize;
        return false;
    }

    flushRenderedTotalSize(ctx, nextTotalSize);
    return true;
}
