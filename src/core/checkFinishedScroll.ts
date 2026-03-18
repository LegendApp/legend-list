import { clampScrollOffset } from "@/core/clampScrollOffset";
import { finishScrollTo } from "@/core/finishScrollTo";
import { logInitialScrollFinishGate, logInitialScrollTrace } from "@/core/logInitialScrollTrace";
import type { StateContext } from "@/state/state";

function getLogicalTargetOffset(scrollingTo: NonNullable<StateContext["state"]["scrollingTo"]>) {
    return scrollingTo.logicalTargetOffset ?? scrollingTo.targetOffset ?? scrollingTo.offset;
}

function getFinishedScrollState(ctx: StateContext, scrollingTo: NonNullable<StateContext["state"]["scrollingTo"]>) {
    const { state } = ctx;
    const scroll = state.scrollPending;
    const adjust = state.scrollAdjustHandler.getAdjust();
    const logicalTargetOffset = getLogicalTargetOffset(scrollingTo);
    const clampedTargetOffset =
        scrollingTo.targetOffset ??
        clampScrollOffset(ctx, scrollingTo.offset - (scrollingTo.viewOffset || 0), scrollingTo);
    const maxOffset = clampScrollOffset(ctx, scroll, scrollingTo);
    const hasQueuedInitialClamp =
        !!scrollingTo.isInitialScroll && logicalTargetOffset > clampedTargetOffset + 1;
    const canHandOffTransientClampToBootstrap =
        hasQueuedInitialClamp &&
        !!state.initialBootstrap &&
        !state.initialScrollUsesOffset &&
        !!state.didContainersLayout &&
        (!!state.hasScrolled || !!state.didDispatchNativeScroll) &&
        Math.abs(clampedTargetOffset - maxOffset) < 1;
    const hasTransientInitialClamp =
        hasQueuedInitialClamp &&
        !!state.queuedInitialLayout &&
        !canHandOffTransientClampToBootstrap;

    // Check both with adjust and without because each possibility
    // can happen in different scenarios
    const diff1 = Math.abs(scroll - clampedTargetOffset);
    const diff2 = Math.abs(diff1 - adjust);
    const isNotOverscrolled = Math.abs(scroll - maxOffset) < 1;
    // Non-animated scrollTo may include an immediate adjust offset, so accept either distance.
    const isAtTarget = diff1 < 1 || (!scrollingTo.animated && diff2 < 1);
    const canFinishInitialScrollWithoutObservedMovement =
        !!scrollingTo.isInitialScroll &&
        (canHandOffTransientClampToBootstrap || Math.abs(clampedTargetOffset) < 1);
    const hasCompletionOwnership =
        !scrollingTo.isInitialScroll || !!state.hasScrolled || canFinishInitialScrollWithoutObservedMovement;

    return {
        adjust,
        canHandOffTransientClampToBootstrap,
        canFinishInitialScrollWithoutObservedMovement,
        clampedTargetOffset,
        diff1,
        diff2,
        hasTransientInitialClamp,
        hasCompletionOwnership,
        isAtTarget,
        isNotOverscrolled,
        logicalTargetOffset,
        maxOffset,
        scroll,
    };
}

export function checkFinishedScroll(ctx: StateContext) {
    // Wait a frame because there may be some requestAdjust after this which
    // change things so it would need to wait longer
    ctx.state.animFrameCheckFinishedScroll = requestAnimationFrame(() => checkFinishedScrollFrame(ctx));
}

function checkFinishedScrollFrame(ctx: StateContext) {
    const scrollingTo = ctx.state.scrollingTo;

    if (scrollingTo) {
        const { state } = ctx;
        state.animFrameCheckFinishedScroll = undefined;
        const {
            adjust,
            canHandOffTransientClampToBootstrap,
            canFinishInitialScrollWithoutObservedMovement,
            clampedTargetOffset,
            diff1,
            diff2,
            hasCompletionOwnership,
            hasTransientInitialClamp,
            isAtTarget,
            isNotOverscrolled,
            logicalTargetOffset,
            maxOffset,
            scroll,
        } = getFinishedScrollState(ctx, scrollingTo);

        logInitialScrollFinishGate(ctx, "frame", {
            adjust,
            canHandOffTransientClampToBootstrap,
            clampedTargetOffset,
            diff1,
            diff2,
            hasTransientInitialClamp,
            isAtTarget,
            isNotOverscrolled,
            logicalTargetOffset,
            maxOffset,
            scroll,
        });

        if (isNotOverscrolled && isAtTarget && !hasTransientInitialClamp) {
            if (!hasCompletionOwnership) {
                return;
            }
            logInitialScrollTrace(ctx, "finish-gate:allow", {
                adjust,
                canHandOffTransientClampToBootstrap,
                canFinishInitialScrollWithoutObservedMovement,
                clampedTargetOffset,
                diff1,
                diff2,
                hasTransientInitialClamp,
                logicalTargetOffset,
                reason: canHandOffTransientClampToBootstrap ? "bootstrap-handoff-at-clamp" : "at-target",
                scroll,
                source: "frame",
            });
            finishScrollTo(ctx);
        }
    }
}

// In case checkFinishedScroll does not work correctly, set a maximum timeout
// to make sure it does eventually get cleared, just waiting for scroll to end
export function checkFinishedScrollFallback(ctx: StateContext) {
    const state = ctx.state;
    const scrollingTo = state.scrollingTo;
    const slowTimeout = !!scrollingTo?.isInitialScroll || !state.didContainersLayout;

    state.timeoutCheckFinishedScrollFallback = setTimeout(
        () => {
            let numChecks = 0;
            const checkHasScrolled = () => {
                state.timeoutCheckFinishedScrollFallback = undefined;

                const isStillScrollingTo = state.scrollingTo;
                if (isStillScrollingTo) {
                    numChecks++;
                    const finishedScrollState = getFinishedScrollState(ctx, isStillScrollingTo);
                    const isAtResolvedTarget =
                        finishedScrollState.isAtTarget &&
                        finishedScrollState.isNotOverscrolled &&
                        !finishedScrollState.hasTransientInitialClamp;
                    const maxChecks = 5;
                    const isWaitingForObservedMovement =
                        !!isStillScrollingTo.isInitialScroll &&
                        !finishedScrollState.hasCompletionOwnership &&
                        Math.abs(finishedScrollState.logicalTargetOffset) >= 1;
                    const shouldFinishAfterMovement =
                        isAtResolvedTarget && finishedScrollState.hasCompletionOwnership;
                    const shouldForceFinish = !isWaitingForObservedMovement && numChecks > maxChecks;

                    logInitialScrollFinishGate(ctx, "fallback", {
                        fallbackCanFinishInitialScrollWithoutObservedMovement:
                            finishedScrollState.canFinishInitialScrollWithoutObservedMovement,
                        fallbackDiff1: finishedScrollState.diff1,
                        fallbackDiff2: finishedScrollState.diff2,
                        fallbackHasCompletionOwnership: finishedScrollState.hasCompletionOwnership,
                        fallbackHasTransientInitialClamp: finishedScrollState.hasTransientInitialClamp,
                        fallbackIsAtResolvedTarget: isAtResolvedTarget,
                        fallbackWaitingForObservedMovement: isWaitingForObservedMovement,
                        logicalTargetOffset: finishedScrollState.logicalTargetOffset,
                        maxChecks,
                        numChecks,
                        shouldFinishAfterMovement,
                    });

                    if (shouldFinishAfterMovement || shouldForceFinish) {
                        logInitialScrollTrace(ctx, "finish-gate:allow", {
                            fallbackCanFinishInitialScrollWithoutObservedMovement:
                                finishedScrollState.canFinishInitialScrollWithoutObservedMovement,
                            fallbackDiff1: finishedScrollState.diff1,
                            fallbackDiff2: finishedScrollState.diff2,
                            fallbackHasCompletionOwnership: finishedScrollState.hasCompletionOwnership,
                            fallbackHasTransientInitialClamp: finishedScrollState.hasTransientInitialClamp,
                            fallbackIsAtResolvedTarget: isAtResolvedTarget,
                            fallbackWaitingForObservedMovement: isWaitingForObservedMovement,
                            finishReason: shouldFinishAfterMovement ? "at-resolved-target" : "max-checks",
                            logicalTargetOffset: finishedScrollState.logicalTargetOffset,
                            maxChecks,
                            numChecks,
                            reason: shouldFinishAfterMovement ? "at-resolved-target" : "max-checks",
                            shouldFinishAfterMovement,
                            source: "fallback",
                        });
                        finishScrollTo(ctx);
                    } else {
                        state.timeoutCheckFinishedScrollFallback = setTimeout(checkHasScrolled, 100);
                    }
                }
            };
            checkHasScrolled();
        },
        slowTimeout ? 500 : 100,
    );

    logInitialScrollTrace(ctx, "finish-gate:fallback-scheduled", {
        delayMs: slowTimeout ? 500 : 100,
        slowTimeout,
    });
}
