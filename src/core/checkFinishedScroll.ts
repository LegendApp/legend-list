import { clampScrollOffset } from "@/core/clampScrollOffset";
import { finishScrollTo } from "@/core/finishScrollTo";
import { logInitialScrollTrace } from "@/core/logInitialScrollTrace";
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
    const hasTransientInitialClamp =
        !!scrollingTo.isInitialScroll && !!state.queuedInitialLayout && logicalTargetOffset > clampedTargetOffset + 1;

    // Check both with adjust and without because each possibility
    // can happen in different scenarios
    const diff1 = Math.abs(scroll - clampedTargetOffset);
    const diff2 = Math.abs(diff1 - adjust);
    const isNotOverscrolled = Math.abs(scroll - maxOffset) < 1;
    // Non-animated scrollTo may include an immediate adjust offset, so accept either distance.
    const isAtTarget = diff1 < 1 || (!scrollingTo.animated && diff2 < 1);

    return {
        adjust,
        clampedTargetOffset,
        diff1,
        diff2,
        hasTransientInitialClamp,
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
            clampedTargetOffset,
            diff1,
            diff2,
            hasTransientInitialClamp,
            isAtTarget,
            isNotOverscrolled,
            logicalTargetOffset,
            maxOffset,
            scroll,
        } = getFinishedScrollState(ctx, scrollingTo);

        logInitialScrollTrace(ctx, "checkFinishedScroll:frame", {
            adjust,
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
            logInitialScrollTrace(ctx, "checkFinishedScroll:frame:finish", {
                adjust,
                clampedTargetOffset,
                diff1,
                diff2,
                hasTransientInitialClamp,
                logicalTargetOffset,
                scroll,
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
                    const shouldFinishAfterMovement = state.hasScrolled || isAtResolvedTarget;

                    logInitialScrollTrace(ctx, "checkFinishedScroll:fallback:tick", {
                        fallbackDiff1: finishedScrollState.diff1,
                        fallbackDiff2: finishedScrollState.diff2,
                        fallbackHasTransientInitialClamp: finishedScrollState.hasTransientInitialClamp,
                        fallbackIsAtResolvedTarget: isAtResolvedTarget,
                        logicalTargetOffset: finishedScrollState.logicalTargetOffset,
                        maxChecks,
                        numChecks,
                        shouldFinishAfterMovement,
                    });

                    if (shouldFinishAfterMovement || numChecks > maxChecks) {
                        logInitialScrollTrace(ctx, "checkFinishedScroll:fallback:finish", {
                            fallbackDiff1: finishedScrollState.diff1,
                            fallbackDiff2: finishedScrollState.diff2,
                            fallbackHasTransientInitialClamp: finishedScrollState.hasTransientInitialClamp,
                            fallbackIsAtResolvedTarget: isAtResolvedTarget,
                            finishReason: shouldFinishAfterMovement ? "at-target-after-scroll" : "max-checks",
                            logicalTargetOffset: finishedScrollState.logicalTargetOffset,
                            maxChecks,
                            numChecks,
                            shouldFinishAfterMovement,
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

    logInitialScrollTrace(ctx, "checkFinishedScroll:fallback:scheduled", {
        delayMs: slowTimeout ? 500 : 100,
        slowTimeout,
    });
}
