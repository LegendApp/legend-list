import type { StateContext } from "@/state/state";

export type DeferredGeometryBoundaryReason =
    | "data-change"
    | "hard-cap"
    | "scroll-direction-change"
    | "scroll-idle"
    | "scroll-momentum-end"
    | "top-cap";

export type DeferredGeometryBoundaryAction = {
    flushDeferredOffset: boolean;
    forceFullItemPositions: boolean;
    rebaseDeferredPositionDelta: boolean;
    shouldTriggerCalculateItemsInView: boolean;
};

function isDeferredPositionBoundaryReason(reason: DeferredGeometryBoundaryReason) {
    return (
        reason === "data-change" ||
        reason === "hard-cap" ||
        reason === "scroll-direction-change" ||
        reason === "scroll-idle" ||
        reason === "scroll-momentum-end" ||
        reason === "top-cap"
    );
}

export function resolveDeferredGeometryFlushPlan(params: {
    canUseDeferredPositionDelta: boolean;
    ctx: StateContext;
    reason: DeferredGeometryBoundaryReason;
}): DeferredGeometryBoundaryAction {
    const { canUseDeferredPositionDelta, ctx, reason } = params;
    const state = ctx.state;
    const isScrollOwned = !!state.scrollingTo || !!state.postInitialSettleTarget;
    const flushDeferredOffset = !isScrollOwned && state.scrollAdjustHandler.hasPendingAdjust();
    const hasDeferredPositionDeltaToRebase =
        canUseDeferredPositionDelta && Math.abs(state.deferredPositionDelta ?? 0) > 0.1;
    const rebaseDeferredPositionDelta =
        !isScrollOwned && isDeferredPositionBoundaryReason(reason) && hasDeferredPositionDeltaToRebase;

    return {
        flushDeferredOffset,
        forceFullItemPositions: rebaseDeferredPositionDelta,
        rebaseDeferredPositionDelta,
        shouldTriggerCalculateItemsInView: flushDeferredOffset || rebaseDeferredPositionDelta,
    };
}

export function queueDeferredGeometryBoundary(params: {
    canUseDeferredPositionDelta: boolean;
    ctx: StateContext;
    reason: DeferredGeometryBoundaryReason;
}) {
    const { canUseDeferredPositionDelta, ctx, reason } = params;
    const state = ctx.state;
    const action = resolveDeferredGeometryFlushPlan({
        canUseDeferredPositionDelta,
        ctx,
        reason,
    });

    if (action.shouldTriggerCalculateItemsInView) {
        state.pendingDeferredGeometryBoundary = reason;
        state.triggerCalculateItemsInView?.({
            forceFullItemPositions: action.forceFullItemPositions,
        });
    }
}

export function consumeDeferredGeometryBoundary(params: {
    canUseDeferredPositionDelta: boolean;
    ctx: StateContext;
}) {
    const { canUseDeferredPositionDelta, ctx } = params;
    const reason = ctx.state.pendingDeferredGeometryBoundary;
    if (!reason) {
        return { action: undefined, reason: undefined };
    }

    ctx.state.pendingDeferredGeometryBoundary = undefined;
    return {
        action: resolveDeferredGeometryFlushPlan({
            canUseDeferredPositionDelta,
            ctx,
            reason,
        }),
        reason,
    };
}
