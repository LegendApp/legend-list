import type { StateContext } from "@/state/state";

export type DeferredGeometryFlushReason =
    | "data-change"
    | "hard-cap"
    | "scroll-direction-change"
    | "scroll-idle"
    | "scroll-momentum-end"
    | "settle-rebase"
    | "top-cap";

export type DeferredGeometryFlushPlan = {
    flushDeferredOffset: boolean;
    forceFullItemPositions: boolean;
    rebaseDeferredPositionDelta: boolean;
    shouldTriggerCalculateItemsInView: boolean;
};

function isDeferredPositionBoundaryReason(reason: DeferredGeometryFlushReason) {
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
    reason: DeferredGeometryFlushReason;
}): DeferredGeometryFlushPlan {
    const { canUseDeferredPositionDelta, ctx, reason } = params;
    const state = ctx.state;
    const isScrollOwned = !!state.scrollingTo || !!state.postInitialSettleTarget;
    const flushDeferredOffset = !isScrollOwned && state.scrollAdjustHandler.hasPendingAdjust();
    const hasDeferredPositionDeltaToRebase =
        canUseDeferredPositionDelta && Math.abs(state.deferredPositionDelta ?? 0) > 0.1;
    const rebaseDeferredPositionDelta =
        !isScrollOwned &&
        (reason === "settle-rebase" || isDeferredPositionBoundaryReason(reason)) &&
        hasDeferredPositionDeltaToRebase;

    return {
        flushDeferredOffset,
        forceFullItemPositions: rebaseDeferredPositionDelta,
        rebaseDeferredPositionDelta,
        shouldTriggerCalculateItemsInView: flushDeferredOffset || rebaseDeferredPositionDelta,
    };
}

export function queueDeferredGeometryFlush(params: {
    ctx: StateContext;
    plan: DeferredGeometryFlushPlan;
}) {
    const { ctx, plan } = params;
    const state = ctx.state;

    if (plan.flushDeferredOffset) {
        state.deferredGeometryFlushPending = true;
    }
    if (plan.rebaseDeferredPositionDelta) {
        state.deferredPositionRebasePending = true;
    }
    if (plan.shouldTriggerCalculateItemsInView) {
        state.triggerCalculateItemsInView?.({
            forceFullItemPositions: plan.forceFullItemPositions,
        });
    }
}
