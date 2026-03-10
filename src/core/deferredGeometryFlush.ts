import type { StateContext } from "@/state/state";

export type DeferredGeometryBoundaryReason = "scroll-direction-change" | "scroll-idle" | "scroll-momentum-end";

export function queueDeferredGeometryBoundary(params: {
    canUseDeferredPositionDelta: boolean;
    ctx: StateContext;
    reason: DeferredGeometryBoundaryReason;
}) {
    const { canUseDeferredPositionDelta, ctx, reason } = params;
    const state = ctx.state;
    const isScrollOwned = !!state.scrollingTo || !!state.postInitialSettleTarget;
    if (isScrollOwned) {
        return;
    }

    const hasPendingDeferredOffset = state.scrollAdjustHandler.hasPendingAdjust();
    const hasDeferredPositionDelta = canUseDeferredPositionDelta && Math.abs(state.deferredPositionDelta) > 0.1;
    if (!hasPendingDeferredOffset && !hasDeferredPositionDelta) {
        return;
    }

    state.pendingDeferredGeometryBoundary = reason;
    state.triggerCalculateItemsInView?.({
        forceFullItemPositions: hasDeferredPositionDelta,
    });
}

export function consumeDeferredGeometryBoundary(ctx: StateContext) {
    const reason = ctx.state.pendingDeferredGeometryBoundary;
    if (!reason) {
        return undefined;
    }

    ctx.state.pendingDeferredGeometryBoundary = undefined;
    return reason;
}
