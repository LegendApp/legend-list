import { clampScrollOffset } from "@/core/clampScrollOffset";
import { finishScrollTo } from "@/core/finishScrollTo";
import type { StateContext } from "@/state/state";
import { debugInitialScroll } from "@/utils/debugInitialScroll";

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
    const hasQueuedInitialClamp = !!scrollingTo.isInitialScroll && logicalTargetOffset > clampedTargetOffset + 1;
    const canHandOffTransientClampToBootstrap =
        hasQueuedInitialClamp &&
        !!state.initialBootstrap &&
        !state.initialScrollUsesOffset &&
        !!state.didContainersLayout &&
        (!!state.hasScrolled || !!state.didDispatchNativeScroll) &&
        Math.abs(clampedTargetOffset - maxOffset) < 1;
    const hasTransientInitialClamp =
        hasQueuedInitialClamp && !!state.queuedInitialLayout && !canHandOffTransientClampToBootstrap;

    // Check both with adjust and without because each possibility
    // can happen in different scenarios
    const diff1 = Math.abs(scroll - clampedTargetOffset);
    const diff2 = Math.abs(diff1 - adjust);
    const isNotOverscrolled = Math.abs(scroll - maxOffset) < 1;
    // Non-animated scrollTo may include an immediate adjust offset, so accept either distance.
    const isAtTarget = diff1 < 1 || (!scrollingTo.animated && diff2 < 1);
    const canFinishInitialScrollWithoutObservedMovement =
        !!scrollingTo.isInitialScroll && (canHandOffTransientClampToBootstrap || Math.abs(clampedTargetOffset) < 1);
    const hasCompletionOwnership =
        !scrollingTo.isInitialScroll || !!state.hasScrolled || canFinishInitialScrollWithoutObservedMovement;

    return {
        hasCompletionOwnership,
        hasTransientInitialClamp,
        isAtTarget,
        isNotOverscrolled,
        logicalTargetOffset,
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
        const { hasCompletionOwnership, hasTransientInitialClamp, isAtTarget, isNotOverscrolled } =
            getFinishedScrollState(ctx, scrollingTo);

        if (isNotOverscrolled && isAtTarget && !hasTransientInitialClamp) {
            if (!hasCompletionOwnership) {
                return;
            }
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
                    const canFinishAfterSilentNativeDispatch =
                        !!isStillScrollingTo.isInitialScroll &&
                        !!state.didDispatchNativeScroll &&
                        !state.hasScrolled &&
                        isAtResolvedTarget &&
                        numChecks >= 2;
                    const shouldFinishAfterMovement =
                        isAtResolvedTarget &&
                        (finishedScrollState.hasCompletionOwnership || canFinishAfterSilentNativeDispatch);
                    const shouldForceFinish = !isWaitingForObservedMovement && numChecks > maxChecks;

                    if (shouldFinishAfterMovement || shouldForceFinish) {
                        if (canFinishAfterSilentNativeDispatch) {
                            debugInitialScroll("checkFinishedScrollFallback-silent-native", {
                                logicalTargetOffset: finishedScrollState.logicalTargetOffset,
                                numChecks,
                                scroll: state.scroll,
                                scrollPending: state.scrollPending,
                            });
                        }
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
}
