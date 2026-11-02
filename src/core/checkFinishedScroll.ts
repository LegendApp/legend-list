import { USER_MOMENTUM_STALL_TIMEOUT_MS } from "@/constants";
import { cancelScroll } from "@/core/cancelScroll";
import { clampScrollOffset } from "@/core/clampScrollOffset";
import { getNativeScrollPoint } from "@/core/doScrollParams";
import { finishScrollTo } from "@/core/finishScrollTo";
import { getCurrentTargetOffset, isEndAlignedLastItemTarget } from "@/core/getCurrentTargetOffset";
import { initialScrollCompletion, initialScrollWatchdog } from "@/core/initialScrollSession";
import { getObservedScrollOffset } from "@/core/observedScroll";
import { Platform } from "@/platform/Platform";
import { getContentSize } from "@/state/getContentSize";
import type { StateContext } from "@/state/state";

export { getCurrentTargetOffset };

type ActiveScrollTarget = NonNullable<StateContext["state"]["scrollingTo"]>;
const INITIAL_SCROLL_MAX_FALLBACK_CHECKS = 20;
const INITIAL_SCROLL_COMPLETION_TARGET_EPSILON = 1;
const INITIAL_SCROLL_ZERO_TARGET_EPSILON = 1;
const SILENT_INITIAL_SCROLL_RETRY_DELAY_MS = 16;
const SILENT_INITIAL_SCROLL_TARGET_EPSILON = 1;

export function checkFinishedScroll(ctx: StateContext, options?: { onlyIfAligned?: boolean }) {
    const scrollingTo = ctx.state.scrollingTo;
    if (options?.onlyIfAligned) {
        if (!scrollingTo?.isInitialScroll || scrollingTo.animated) {
            return;
        }

        if (!getResolvedScrollCompletionState(ctx, scrollingTo).isAtResolvedTarget) {
            return;
        }
    }

    // Wait a frame because there may be some requestAdjust after this which
    // change things so it would need to wait longer
    ctx.state.scheduledWork.frame(() => checkFinishedScrollFrame(ctx), "checkFinishedScrollFrame");
}

function isSilentInitialDispatch(state: StateContext["state"], scrollingTo: ActiveScrollTarget | undefined) {
    return (
        !!scrollingTo?.isInitialScroll && initialScrollCompletion.didDispatchNativeScroll(state) && !state.hasScrolled
    );
}

function isNativeInitialNonZeroTarget(state: StateContext["state"]) {
    const targetOffset = initialScrollWatchdog.get(state)?.targetOffset;
    return !state.didFinishInitialScroll && initialScrollWatchdog.hasNonZeroTargetOffset(targetOffset);
}

function shouldFinishInitialScrollWithoutNativeProgress(state: StateContext["state"], scrollingTo: ActiveScrollTarget) {
    if (!scrollingTo.isInitialScroll || scrollingTo.animated || !state.didContainersLayout) {
        return false;
    }

    if (state.initialScrollSession?.kind === "bootstrap") {
        return false;
    }

    const targetOffset = scrollingTo.targetOffset ?? scrollingTo.offset;
    if (
        initialScrollWatchdog.hasNonZeroTargetOffset(targetOffset) &&
        initialScrollCompletion.didDispatchNativeScroll(state) &&
        !state.hasScrolled
    ) {
        return false;
    }

    if (
        initialScrollWatchdog.isAtZeroTargetOffset(targetOffset) ||
        Math.abs(state.scroll - targetOffset) > 1 ||
        Math.abs(state.scrollPending - targetOffset) > 1
    ) {
        return false;
    }

    return !!scrollingTo.waitForInitialScrollCompletionFrame || isNativeInitialNonZeroTarget(state);
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

function getResolvedScrollCompletionState(ctx: StateContext, scrollingTo: ActiveScrollTarget) {
    const { state } = ctx;
    const isWebInitialScroll = Platform.OS === "web" && scrollingTo.isInitialScroll;
    const scroll = isWebInitialScroll ? getObservedScrollOffset(ctx, state.scrollPending) : state.scrollPending;
    const adjust = state.scrollAdjustHandler.getAdjust();
    const clampedTargetOffset = getCurrentTargetOffset(ctx, scrollingTo);
    const maxOffset = clampScrollOffset(ctx, scroll, scrollingTo);
    const diff1 = Math.abs(scroll - clampedTargetOffset);
    const adjustedTargetOffset = clampedTargetOffset + adjust;
    const diff2 = Math.abs(scroll - adjustedTargetOffset);
    const canUseAdjustedCompletion = !isWebInitialScroll && (!scrollingTo.animated || Platform.OS === "ios");
    // Layout can predict the end before an explicit native command lands. Keep its
    // owner until native catches up, so later measurements can correct the target.
    const isWaitingForNativeEnd =
        Platform.OS !== "web" &&
        scrollingTo.isScrollToEnd &&
        !state.maintainingScrollAtEnd &&
        !scrollingTo.isInitialScroll &&
        !scrollingTo.animated &&
        state.lastNativeScroll !== undefined &&
        state.lastNativeScroll < Math.min(clampedTargetOffset, adjustedTargetOffset) - 1;

    return {
        clampedTargetOffset,
        isAtResolvedTarget:
            !isWaitingForNativeEnd &&
            Math.abs(scroll - maxOffset) < 1 &&
            (diff1 < 1 || (canUseAdjustedCompletion && diff2 < 1)),
    };
}

function checkFinishedScrollFrame(ctx: StateContext) {
    const scrollingTo = ctx.state.scrollingTo;
    if (!scrollingTo) {
        return;
    }

    const { state } = ctx;
    const completionState = getResolvedScrollCompletionState(ctx, scrollingTo);
    // Passing a newly measured target does not stop the browser's animation toward the issued offset.
    const isPassingWebTarget =
        Platform.OS === "web" &&
        scrollingTo.animated &&
        !scrollingTo.isInitialScroll &&
        Math.abs(completionState.clampedTargetOffset - (scrollingTo.targetOffset ?? scrollingTo.offset)) > 1;
    if (
        !isPassingWebTarget &&
        completionState.isAtResolvedTarget &&
        (!scrollingTo.isInitialScroll ||
            state.hasScrolled ||
            completionState.clampedTargetOffset <= INITIAL_SCROLL_COMPLETION_TARGET_EPSILON)
    ) {
        finishScrollTo(ctx);
    }
}

function scrollToFallbackOffset(ctx: StateContext, offset: number, animated = false) {
    ctx.state.refScroller.current?.scrollTo({ animated, ...getNativeScrollPoint(ctx, offset) });
}

// In case checkFinishedScroll does not work correctly, set a maximum timeout
// to make sure it does eventually get cleared, just waiting for scroll to end
export function checkFinishedScrollFallback(ctx: StateContext) {
    const state = ctx.state;
    if (state.scheduledWork.has("checkFinishedScrollFallback")) {
        return;
    }

    const scrollingTo = state.scrollingTo;
    const shouldFinishInitialZeroTarget = shouldFinishInitialZeroTargetScroll(ctx);
    const silentInitialDispatch = isSilentInitialDispatch(state, scrollingTo);
    const canFinishInitialWithoutNativeProgress =
        scrollingTo !== undefined ? shouldFinishInitialScrollWithoutNativeProgress(state, scrollingTo) : false;
    const slowTimeout =
        (scrollingTo?.isInitialScroll && !shouldFinishInitialZeroTarget && !canFinishInitialWithoutNativeProgress) ||
        !state.didContainersLayout ||
        // Allow native animations to deliver their first event after an idle period.
        (Platform.OS !== "web" && !!scrollingTo?.animated);
    const initialDelay =
        shouldFinishInitialZeroTarget || canFinishInitialWithoutNativeProgress
            ? 0
            : silentInitialDispatch
              ? SILENT_INITIAL_SCROLL_RETRY_DELAY_MS
              : slowTimeout
                ? 500
                : 100;

    let numChecks = 0;
    let previousScroll = state.scrollPending;
    const scheduleFallbackCheck = (delay: number) => {
        state.scheduledWork.timeout(checkHasScrolled, delay, "checkFinishedScrollFallback");
    };
    const checkHasScrolled = () => {
        const isStillScrollingTo = state.scrollingTo;
        if (isStillScrollingTo) {
            numChecks++;
            const isNativeInitialPending = isNativeInitialNonZeroTarget(state) && !state.hasScrolled;
            const maxChecks = !silentInitialDispatch && isNativeInitialPending ? INITIAL_SCROLL_MAX_FALLBACK_CHECKS : 5;
            const shouldFinishZeroTarget = shouldFinishInitialZeroTargetScroll(ctx);
            const canFinishInitialScrollWithoutNativeProgress = shouldFinishInitialScrollWithoutNativeProgress(
                state,
                isStillScrollingTo,
            );
            const completionState = getResolvedScrollCompletionState(ctx, isStillScrollingTo);
            const canFinishAfterSilentNativeDispatch =
                Platform.OS === "android" && silentInitialDispatch && completionState.isAtResolvedTarget;
            const shouldRetrySilentInitialNativeScroll =
                canFinishAfterSilentNativeDispatch && !initialScrollCompletion.didRetrySilentInitialScroll(state);
            const shouldFinishAfterObservedScroll =
                state.hasScrolled && (!isStillScrollingTo.isInitialScroll || completionState.isAtResolvedTarget);
            const shouldRetryUnalignedInitialScroll =
                isStillScrollingTo.isInitialScroll && !completionState.isAtResolvedTarget;
            const shouldRetryUnalignedEndScroll =
                Platform.OS !== "web" &&
                !isStillScrollingTo.isInitialScroll &&
                isEndAlignedLastItemTarget(ctx, isStillScrollingTo) &&
                !completionState.isAtResolvedTarget &&
                numChecks <= maxChecks;
            const isAnimatedMaintain = !!(
                isStillScrollingTo.animated &&
                isStillScrollingTo.isScrollToEnd &&
                state.maintainingScrollAtEnd === "animated"
            );
            const didMaintainProgress = isAnimatedMaintain && Math.abs(state.scrollPending - previousScroll) > 0.1;
            previousScroll = state.scrollPending;
            const isMovingNativeRequest =
                Platform.OS !== "web" &&
                !isStillScrollingTo.isInitialScroll &&
                isStillScrollingTo.animated &&
                Date.now() - (state.lastNativeScrollTime ?? 0) < USER_MOMENTUM_STALL_TIMEOUT_MS;
            if ((didMaintainProgress || isMovingNativeRequest) && !completionState.isAtResolvedTarget) {
                // A stale momentum-end event can arrive during an animation, including a native
                // status-bar interruption whose sparse final frames precede onScrollToTop.
                numChecks = 0;
                scheduleFallbackCheck(100);
            } else if (shouldRetrySilentInitialNativeScroll) {
                const targetOffset =
                    initialScrollWatchdog.get(state)?.targetOffset ?? isStillScrollingTo.targetOffset ?? 0;
                const jiggleOffset =
                    targetOffset >= SILENT_INITIAL_SCROLL_TARGET_EPSILON
                        ? targetOffset - SILENT_INITIAL_SCROLL_TARGET_EPSILON
                        : targetOffset + SILENT_INITIAL_SCROLL_TARGET_EPSILON;
                initialScrollCompletion.markSilentInitialScrollRetry(state);
                scrollToFallbackOffset(ctx, jiggleOffset);
                state.scheduledWork.frame(
                    () => scrollToFallbackOffset(ctx, targetOffset),
                    "checkFinishedScrollRetryFrame",
                );
                scheduleFallbackCheck(SILENT_INITIAL_SCROLL_RETRY_DELAY_MS);
            } else if (shouldRetryUnalignedEndScroll) {
                scrollToFallbackOffset(ctx, completionState.clampedTargetOffset, !!isStillScrollingTo.animated);
                scheduleFallbackCheck(100);
            } else if (
                shouldFinishZeroTarget ||
                shouldFinishAfterObservedScroll ||
                canFinishInitialScrollWithoutNativeProgress ||
                canFinishAfterSilentNativeDispatch ||
                numChecks > maxChecks
            ) {
                if (
                    Platform.OS !== "web" &&
                    !isStillScrollingTo.isInitialScroll &&
                    !(isStillScrollingTo.isScrollToEnd && state.maintainingScrollAtEnd) &&
                    !ctx.scrollRequestTracker?.isWaitingToRun() &&
                    !completionState.isAtResolvedTarget
                ) {
                    cancelScroll(ctx, false);
                } else {
                    finishScrollTo(ctx);
                }
            } else {
                if (isNativeInitialPending || shouldRetryUnalignedInitialScroll) {
                    const watchdog = initialScrollWatchdog.get(state);
                    const targetOffset =
                        Platform.OS === "web"
                            ? completionState.clampedTargetOffset
                            : (watchdog?.targetOffset ?? isStillScrollingTo.targetOffset ?? state.scrollPending);
                    if (Platform.OS === "web" && watchdog) {
                        watchdog.targetOffset = targetOffset;
                    }
                    scrollToFallbackOffset(ctx, targetOffset);
                }
                scheduleFallbackCheck(silentInitialDispatch ? SILENT_INITIAL_SCROLL_RETRY_DELAY_MS : 100);
            }
        }
    };
    scheduleFallbackCheck(initialDelay);
}
