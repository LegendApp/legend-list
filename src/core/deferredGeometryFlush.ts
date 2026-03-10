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
    rebaseSharedOrigin: boolean;
    shouldTriggerCalculateItemsInView: boolean;
};

function isSharedOriginSettleReason(reason: DeferredGeometryFlushReason) {
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
    canUseSharedOrigin: boolean;
    ctx: StateContext;
    reason: DeferredGeometryFlushReason;
}): DeferredGeometryFlushPlan {
    const { canUseSharedOrigin, ctx, reason } = params;
    const state = ctx.state;
    const isScrollOwned = !!state.scrollingTo || !!state.postInitialSettleTarget;
    const flushDeferredOffset = !isScrollOwned && state.scrollAdjustHandler.hasPendingAdjust();
    const hasSharedOriginOffsetToRebase = canUseSharedOrigin && Math.abs(state.sharedContainerLogicalOriginOffset ?? 0) > 0.1;
    const rebaseSharedOrigin = !isScrollOwned && (reason === "settle-rebase" || isSharedOriginSettleReason(reason)) && hasSharedOriginOffsetToRebase;

    return {
        flushDeferredOffset,
        forceFullItemPositions: rebaseSharedOrigin,
        rebaseSharedOrigin,
        shouldTriggerCalculateItemsInView: flushDeferredOffset || rebaseSharedOrigin,
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
    if (plan.rebaseSharedOrigin) {
        state.sharedContainerRebasePending = true;
    }
    if (plan.shouldTriggerCalculateItemsInView) {
        state.triggerCalculateItemsInView?.({
            forceFullItemPositions: plan.forceFullItemPositions,
        });
    }
}
