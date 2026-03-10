import { peek$, type StateContext } from "@/state/state";

export type DeferredGeometryFlushReason =
    | "data-change"
    | "direction-change"
    | "hard-cap"
    | "momentum-end"
    | "scroll-direction-change"
    | "scroll-idle"
    | "scroll-momentum-end"
    | "settle-rebase"
    | "top-cap";

export type DeferredGeometryFlushPlan = {
    flushDeferredOffset: boolean;
    forceFullItemPositions: boolean;
    rebaseSharedOrigin: boolean;
    shouldFlushSharedOrigin: boolean;
    shouldTriggerCalculateItemsInView: boolean;
};

function isSharedOriginSettleReason(reason: DeferredGeometryFlushReason) {
    return (
        reason === "data-change" ||
        reason === "direction-change" ||
        reason === "hard-cap" ||
        reason === "momentum-end" ||
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
    const containerOriginOffset = peek$(ctx, "containerOriginOffset") ?? 0;
    const logicalSharedOriginOffset = state.sharedContainerLogicalOriginOffset ?? containerOriginOffset;
    const hasSharedOriginOffsetToRebase =
        canUseSharedOrigin && (containerOriginOffset !== 0 || logicalSharedOriginOffset !== containerOriginOffset);
    const rebaseSharedOrigin = !isScrollOwned && (reason === "settle-rebase" || isSharedOriginSettleReason(reason)) && hasSharedOriginOffsetToRebase;
    const shouldFlushSharedOrigin =
        !isScrollOwned && !rebaseSharedOrigin && canUseSharedOrigin && !isSharedOriginSettleReason(reason);

    return {
        flushDeferredOffset,
        forceFullItemPositions: rebaseSharedOrigin,
        rebaseSharedOrigin,
        shouldFlushSharedOrigin,
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
