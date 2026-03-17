import { clampScrollOffset } from "@/core/clampScrollOffset";
import { finishScrollTo } from "@/core/finishScrollTo";
import { logInitialScrollTrace } from "@/core/logInitialScrollTrace";
import { getContentSize } from "@/state/getContentSize";
import type { StateContext } from "@/state/state";

const INITIAL_SCROLL_MIN_TARGET_OFFSET = 1;
const INITIAL_SCROLL_MAX_FALLBACK_CHECKS = 20;
const INITIAL_SCROLL_ZERO_TARGET_EPSILON = 1;

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
    const shouldFinishInitialZeroTarget = shouldFinishInitialZeroTargetScroll(ctx);
    const slowTimeout = (scrollingTo?.isInitialScroll && !shouldFinishInitialZeroTarget) || !state.didContainersLayout;

    state.timeoutCheckFinishedScrollFallback = setTimeout(
        () => {
            let numChecks = 0;
            const checkHasScrolled = () => {
                state.timeoutCheckFinishedScrollFallback = undefined;

                const isStillScrollingTo = state.scrollingTo;
                if (isStillScrollingTo) {
                    numChecks++;
                    const isNativeInitialPending = isNativeInitialNonZeroTarget(state);
                    const shouldFinishZeroTarget = shouldFinishInitialZeroTargetScroll(ctx);
                    const targetOffset =
                        state.initialNativeScrollWatchdog?.targetOffset ?? getLogicalTargetOffset(isStillScrollingTo);
                    const finishedScrollState = getFinishedScrollState(ctx, isStillScrollingTo);
                    const isAtResolvedTarget =
                        finishedScrollState.isAtTarget &&
                        finishedScrollState.isNotOverscrolled &&
                        !finishedScrollState.hasTransientInitialClamp;
                    const shouldRetryInitialTarget =
                        isNativeInitialPending &&
                        isStillScrollingTo.isInitialScroll &&
                        (!state.hasScrolled || !isAtResolvedTarget);
                    const maxChecks = shouldRetryInitialTarget ? INITIAL_SCROLL_MAX_FALLBACK_CHECKS : 5;
                    const shouldFinishAfterMovement =
                        state.hasScrolled && (!isStillScrollingTo.isInitialScroll || isAtResolvedTarget);

                    logInitialScrollTrace(ctx, "checkFinishedScroll:fallback:tick", {
                        fallbackDiff1: finishedScrollState.diff1,
                        fallbackDiff2: finishedScrollState.diff2,
                        fallbackHasTransientInitialClamp: finishedScrollState.hasTransientInitialClamp,
                        fallbackIsAtResolvedTarget: isAtResolvedTarget,
                        isNativeInitialPending,
                        logicalTargetOffset: finishedScrollState.logicalTargetOffset,
                        maxChecks,
                        numChecks,
                        shouldFinishAfterMovement,
                        shouldFinishZeroTarget,
                        shouldRetryInitialTarget,
                        targetOffset,
                    });

                    if (shouldFinishZeroTarget || shouldFinishAfterMovement || numChecks > maxChecks) {
                        logInitialScrollTrace(ctx, "checkFinishedScroll:fallback:finish", {
                            fallbackDiff1: finishedScrollState.diff1,
                            fallbackDiff2: finishedScrollState.diff2,
                            fallbackHasTransientInitialClamp: finishedScrollState.hasTransientInitialClamp,
                            fallbackIsAtResolvedTarget: isAtResolvedTarget,
                            finishReason: shouldFinishZeroTarget
                                ? "zero-target"
                                : shouldFinishAfterMovement
                                  ? "at-target-after-scroll"
                                  : "max-checks",
                            isNativeInitialPending,
                            logicalTargetOffset: finishedScrollState.logicalTargetOffset,
                            maxChecks,
                            numChecks,
                            shouldFinishAfterMovement,
                            shouldFinishZeroTarget,
                            shouldRetryInitialTarget,
                            targetOffset,
                        });
                        finishScrollTo(ctx);
                    } else if (shouldRetryInitialTarget && numChecks <= maxChecks) {
                        const scroller = state.refScroller.current;
                        logInitialScrollTrace(ctx, "checkFinishedScroll:fallback:retry", {
                            numChecks,
                            targetOffset,
                        });
                        if (scroller) {
                            scroller.scrollTo({
                                animated: false,
                                x: state.props.horizontal ? targetOffset : 0,
                                y: state.props.horizontal ? 0 : targetOffset,
                            });
                        }
                        state.timeoutCheckFinishedScrollFallback = setTimeout(checkHasScrolled, 100);
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
        shouldFinishInitialZeroTarget: shouldFinishInitialZeroTarget,
        slowTimeout,
    });
}

function isNativeInitialNonZeroTarget(state: StateContext["state"]) {
    return (
        !state.didFinishInitialScroll &&
        !!state.initialNativeScrollWatchdog &&
        state.initialNativeScrollWatchdog.targetOffset > INITIAL_SCROLL_MIN_TARGET_OFFSET
    );
}

function shouldFinishInitialZeroTargetScroll(ctx: StateContext) {
    const { state } = ctx;
    return (
        !!state.scrollingTo?.isInitialScroll &&
        state.props.data.length > 0 &&
        getContentSize(ctx) <= state.scrollLength &&
        state.scrollPending <= INITIAL_SCROLL_ZERO_TARGET_EPSILON
    );
}
