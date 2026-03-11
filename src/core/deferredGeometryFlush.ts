import { hasPendingRenderedTotalSize } from "@/core/renderedTotalSize";
import type { StateContext } from "@/state/state";

// Queues the next calculate pass to flush deferred scroll geometry only when
// user-scroll ownership is active and there is something pending to commit.
export function queueDeferredGeometryBoundary(params: {
    canUseDeferredPositionDelta: boolean;
    ctx: StateContext;
}) {
    const { canUseDeferredPositionDelta, ctx } = params;
    const state = ctx.state;
    const isScrollOwned = !!state.scrollingTo || !!state.postInitialSettleTarget;
    if (isScrollOwned) {
        return;
    }

    const hasPendingDeferredOffset = state.scrollAdjustHandler.hasPendingAdjust();
    const hasDeferredPositionDelta = canUseDeferredPositionDelta && Math.abs(state.deferredPositionDelta) > 0.1;
    const hasDeferredRenderedTotalSize = hasPendingRenderedTotalSize(state);
    if (!hasPendingDeferredOffset && !hasDeferredPositionDelta && !hasDeferredRenderedTotalSize) {
        return;
    }

    state.pendingDeferredGeometryFlush = true;
    state.triggerCalculateItemsInView?.({
        forceFullItemPositions: hasPendingDeferredOffset || hasDeferredPositionDelta || hasDeferredRenderedTotalSize,
    });
}

// Returns and clears the queued user-scroll boundary so a single calculate pass
// can consume it atomically.
export function consumeDeferredGeometryBoundary(ctx: StateContext) {
    const shouldFlush = ctx.state.pendingDeferredGeometryFlush;
    if (!shouldFlush) {
        return false;
    }

    ctx.state.pendingDeferredGeometryFlush = false;
    return true;
}
