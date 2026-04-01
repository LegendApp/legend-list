import { clampScrollOffset } from "@/core/clampScrollOffset";
import { finishScrollTo } from "@/core/finishScrollTo";
import { Platform } from "@/platform/Platform";
import { getContentSize } from "@/state/getContentSize";
import type { StateContext } from "@/state/state";

const INITIAL_SCROLL_MIN_TARGET_OFFSET = 1;
const INITIAL_SCROLL_MAX_FALLBACK_CHECKS = 20;
const INITIAL_SCROLL_ZERO_TARGET_EPSILON = 1;
const SILENT_INITIAL_SCROLL_RETRY_DELAY_MS = 16;
const SILENT_INITIAL_SCROLL_TARGET_EPSILON = 1;

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

        const scroll = state.scrollPending;
        const adjust = state.scrollAdjustHandler.getAdjust();
        const clampedTargetOffset =
            scrollingTo.targetOffset ??
            clampScrollOffset(ctx, scrollingTo.offset - (scrollingTo.viewOffset || 0), scrollingTo);
        const maxOffset = clampScrollOffset(ctx, scroll, scrollingTo);

        // Check both with adjust and without because each possibility
        // can happen in different scenarios
        const diff1 = Math.abs(scroll - clampedTargetOffset);
        const diff2 = Math.abs(diff1 - adjust);
        const isNotOverscrolled = Math.abs(scroll - maxOffset) < 1;
        // Non-animated scrollTo may include an immediate adjust offset, so accept either distance.
        const isAtTarget = diff1 < 1 || (!scrollingTo.animated && diff2 < 1);
        const hasCompletionOwnership =
            !scrollingTo.isInitialScroll || state.hasScrolled || clampedTargetOffset <= INITIAL_SCROLL_MIN_TARGET_OFFSET;

        if (isNotOverscrolled && isAtTarget && hasCompletionOwnership) {
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
    const isSilentInitialDispatch =
        !!scrollingTo?.isInitialScroll && !!state.didDispatchNativeScroll && !state.hasScrolled;
    const canFinishInitialWithoutNativeProgress =
        scrollingTo !== undefined ? shouldFinishInitialScrollWithoutNativeProgress(state, scrollingTo) : false;
    const slowTimeout =
        (scrollingTo?.isInitialScroll && !shouldFinishInitialZeroTarget && !canFinishInitialWithoutNativeProgress) ||
        !state.didContainersLayout;
    const initialDelay =
        shouldFinishInitialZeroTarget || canFinishInitialWithoutNativeProgress
            ? 0
            : isSilentInitialDispatch
              ? SILENT_INITIAL_SCROLL_RETRY_DELAY_MS
              : slowTimeout
                ? 500
                : 100;

    state.timeoutCheckFinishedScrollFallback = setTimeout(
        () => {
            let numChecks = 0;
            const checkHasScrolled = () => {
                state.timeoutCheckFinishedScrollFallback = undefined;

                const isStillScrollingTo = state.scrollingTo;
                if (isStillScrollingTo) {
                    numChecks++;
                    const isNativeInitialPending = isNativeInitialNonZeroTarget(state) && !state.hasScrolled;
                    const maxChecks = isSilentInitialDispatch ? 5 : isNativeInitialPending ? INITIAL_SCROLL_MAX_FALLBACK_CHECKS : 5;
                    const shouldFinishZeroTarget = shouldFinishInitialZeroTargetScroll(ctx);
                    const canFinishInitialScrollWithoutNativeProgress = shouldFinishInitialScrollWithoutNativeProgress(
                        state,
                        isStillScrollingTo,
                    );
                    const scroll = state.scrollPending;
                    const adjust = state.scrollAdjustHandler.getAdjust();
                    const clampedTargetOffset =
                        isStillScrollingTo.targetOffset ??
                        clampScrollOffset(
                            ctx,
                            isStillScrollingTo.offset - (isStillScrollingTo.viewOffset || 0),
                            isStillScrollingTo,
                        );
                    const maxOffset = clampScrollOffset(ctx, scroll, isStillScrollingTo);
                    const diff1 = Math.abs(scroll - clampedTargetOffset);
                    const diff2 = Math.abs(diff1 - adjust);
                    const isAtResolvedTarget =
                        Math.abs(scroll - maxOffset) < 1 &&
                        (diff1 < 1 || (!isStillScrollingTo.animated && diff2 < 1));
                    const canFinishAfterSilentNativeDispatch =
                        isSilentInitialDispatch && isAtResolvedTarget && numChecks >= 1;
                    const shouldRetrySilentInitialNativeScroll =
                        Platform.OS === "android" &&
                        canFinishAfterSilentNativeDispatch &&
                        !state.didRetrySilentInitialScroll;

                    if (shouldRetrySilentInitialNativeScroll) {
                        const targetOffset = state.initialNativeScrollWatchdog?.targetOffset ?? isStillScrollingTo.targetOffset ?? 0;
                        const jiggleOffset =
                            targetOffset >= SILENT_INITIAL_SCROLL_TARGET_EPSILON
                                ? targetOffset - SILENT_INITIAL_SCROLL_TARGET_EPSILON
                                : targetOffset + SILENT_INITIAL_SCROLL_TARGET_EPSILON;
                        const scroller = state.refScroller.current;
                        state.didRetrySilentInitialScroll = true;
                        scroller?.scrollTo({
                            animated: false,
                            x: state.props.horizontal ? jiggleOffset : 0,
                            y: state.props.horizontal ? 0 : jiggleOffset,
                        });
                        requestAnimationFrame(() => {
                            state.refScroller.current?.scrollTo({
                                animated: false,
                                x: state.props.horizontal ? targetOffset : 0,
                                y: state.props.horizontal ? 0 : targetOffset,
                            });
                        });
                        state.timeoutCheckFinishedScrollFallback = setTimeout(
                            checkHasScrolled,
                            SILENT_INITIAL_SCROLL_RETRY_DELAY_MS,
                        );
                    } else if (
                        shouldFinishZeroTarget ||
                        state.hasScrolled ||
                        canFinishInitialScrollWithoutNativeProgress ||
                        canFinishAfterSilentNativeDispatch ||
                        numChecks > maxChecks
                    ) {
                        finishScrollTo(ctx);
                    } else if (isNativeInitialPending && numChecks <= maxChecks) {
                        const targetOffset = state.initialNativeScrollWatchdog?.targetOffset ?? state.scrollPending;
                        const scroller = state.refScroller.current;
                        if (scroller) {
                            scroller.scrollTo({
                                animated: false,
                                x: state.props.horizontal ? targetOffset : 0,
                                y: state.props.horizontal ? 0 : targetOffset,
                            });
                        }
                        state.timeoutCheckFinishedScrollFallback = setTimeout(
                            checkHasScrolled,
                            isSilentInitialDispatch ? SILENT_INITIAL_SCROLL_RETRY_DELAY_MS : 100,
                        );
                    } else {
                        state.timeoutCheckFinishedScrollFallback = setTimeout(
                            checkHasScrolled,
                            isSilentInitialDispatch ? SILENT_INITIAL_SCROLL_RETRY_DELAY_MS : 100,
                        );
                    }
                }
            };
            checkHasScrolled();
        },
        initialDelay,
    );
}

function isNativeInitialNonZeroTarget(state: StateContext["state"]) {
    return (
        !state.didFinishInitialScroll &&
        !!state.initialNativeScrollWatchdog &&
        state.initialNativeScrollWatchdog.targetOffset > INITIAL_SCROLL_MIN_TARGET_OFFSET
    );
}

function shouldFinishInitialScrollWithoutNativeProgress(
    state: StateContext["state"],
    scrollingTo: NonNullable<StateContext["state"]["scrollingTo"]>,
) {
    if (!scrollingTo.isInitialScroll || scrollingTo.animated || !state.didContainersLayout) {
        return false;
    }

    if (state.bootstrapInitialScroll && !state.bootstrapInitialScroll.pendingFinalCorrection) {
        return false;
    }

    const targetOffset = scrollingTo.targetOffset ?? scrollingTo.offset;
    if (targetOffset > INITIAL_SCROLL_MIN_TARGET_OFFSET && state.didDispatchNativeScroll && !state.hasScrolled) {
        return false;
    }

    if (
        targetOffset <= INITIAL_SCROLL_MIN_TARGET_OFFSET ||
        Math.abs(state.scroll - targetOffset) > 1 ||
        Math.abs(state.scrollPending - targetOffset) > 1
    ) {
        return false;
    }

    return !!state.bootstrapInitialScroll?.pendingFinalCorrection || isNativeInitialNonZeroTarget(state);
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
