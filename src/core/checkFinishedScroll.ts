import { USER_MOMENTUM_STALL_TIMEOUT_MS } from "@/constants";
import { cancelScroll } from "@/core/cancelScroll";
import { clampScrollOffset } from "@/core/clampScrollOffset";
import { getNativeScrollPoint } from "@/core/doScrollParams";
import { finishScrollTo } from "@/core/finishScrollTo";
import { getCurrentTargetOffset, isEndAlignedLastItemTarget, isIndexScrollTarget } from "@/core/getCurrentTargetOffset";
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

/** The target follows its item's measured position; see getCurrentTargetOffset. */
function isMeasuredIndexTarget(ctx: StateContext, scrollingTo: ActiveScrollTarget) {
    return (
        isIndexScrollTarget(ctx, scrollingTo) &&
        scrollingTo.index !== undefined &&
        ctx.state.positions[scrollingTo.index] !== undefined
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
    const hasMeasuredIndexTarget = isMeasuredIndexTarget(ctx, scrollingTo);
    // The current index offset already includes measurement changes; adding the
    // applied MVCP adjustment again would accept a second, incorrect landing.
    const canUseAdjustedCompletion =
        !isWebInitialScroll && !hasMeasuredIndexTarget && (!scrollingTo.animated || Platform.OS === "ios");
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
        // A measurement moved the target away from the offset already issued.
        didTargetOffsetChange: Math.abs(clampedTargetOffset - (scrollingTo.targetOffset ?? scrollingTo.offset)) > 1,
        hasMeasuredIndexTarget,
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
    // Passing a newly measured target does not stop the platform's animation toward the issued offset.
    const isPassingTarget =
        (Platform.OS === "web" ||
            (completionState.hasMeasuredIndexTarget && !isEndAlignedLastItemTarget(ctx, scrollingTo))) &&
        scrollingTo.animated &&
        !scrollingTo.isInitialScroll &&
        completionState.didTargetOffsetChange;
    if (
        !isPassingTarget &&
        completionState.isAtResolvedTarget &&
        (!scrollingTo.isInitialScroll ||
            state.hasScrolled ||
            completionState.clampedTargetOffset <= INITIAL_SCROLL_COMPLETION_TARGET_EPSILON)
    ) {
        finishScrollTo(ctx);
    }
}

function scrollToFallbackOffset(ctx: StateContext, offset: number, animated = false) {
    if (Platform.OS !== "web") {
        // Like doScrollTo, the offset already includes every queued adjustment.
        ctx.state.initialMountAdjusts = undefined;
    }
    ctx.state.refScroller.current?.scrollTo({ animated, ...getNativeScrollPoint(ctx, offset) });
}

/** Initial-scroll retries target the index's current offset, or the offset the session was asked for. */
function getRetryTargetOffset(ctx: StateContext, scrollingTo: ActiveScrollTarget) {
    const state = ctx.state;
    const watchdog = initialScrollWatchdog.get(state);
    const targetOffset =
        Platform.OS === "web" || isMeasuredIndexTarget(ctx, scrollingTo)
            ? getCurrentTargetOffset(ctx, scrollingTo)
            : (watchdog?.targetOffset ?? scrollingTo.targetOffset ?? state.scrollPending);
    if (watchdog) {
        watchdog.targetOffset = targetOffset;
    }
    return targetOffset;
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
            const shouldRetryUnalignedIndexScroll =
                Platform.OS !== "web" &&
                !isStillScrollingTo.isInitialScroll &&
                (isEndAlignedLastItemTarget(ctx, isStillScrollingTo) ||
                    (isStillScrollingTo.index !== undefined && completionState.didTargetOffsetChange)) &&
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
            if (
                (didMaintainProgress || isMovingNativeRequest) &&
                (!completionState.isAtResolvedTarget || completionState.didTargetOffsetChange)
            ) {
                // A stale momentum-end event can arrive during an animation, including a native
                // status-bar interruption whose sparse final frames precede onScrollToTop.
                numChecks = 0;
                scheduleFallbackCheck(100);
            } else if (shouldRetrySilentInitialNativeScroll) {
                const targetOffset = getRetryTargetOffset(ctx, isStillScrollingTo);
                const jiggleOffset =
                    targetOffset >= SILENT_INITIAL_SCROLL_TARGET_EPSILON
                        ? targetOffset - SILENT_INITIAL_SCROLL_TARGET_EPSILON
                        : targetOffset + SILENT_INITIAL_SCROLL_TARGET_EPSILON;
                initialScrollCompletion.markSilentInitialScrollRetry(state);
                scrollToFallbackOffset(ctx, jiggleOffset);
                // Adjustments can move the target while the nudge is pending, so return to its current offset.
                state.scheduledWork.frame(
                    () => scrollToFallbackOffset(ctx, getRetryTargetOffset(ctx, isStillScrollingTo)),
                    "checkFinishedScrollRetryFrame",
                );
                scheduleFallbackCheck(SILENT_INITIAL_SCROLL_RETRY_DELAY_MS);
            } else if (shouldRetryUnalignedIndexScroll) {
                // Completion compares against the command actually in flight, including a measured retarget.
                isStillScrollingTo.targetOffset = completionState.clampedTargetOffset;
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
                    scrollToFallbackOffset(ctx, getRetryTargetOffset(ctx, isStillScrollingTo));
                }
                scheduleFallbackCheck(silentInitialDispatch ? SILENT_INITIAL_SCROLL_RETRY_DELAY_MS : 100);
            }
        }
    };
    scheduleFallbackCheck(initialDelay);
}
