import { finishScrollTo } from "@/core/finishScrollTo";
import { getBootstrapInitialScrollSession, getInitialScrollSessionWatchdog } from "@/core/initialScrollSession";
import { getResolvedScrollCompletionState } from "@/core/resolvedScrollCompletion";
import { Platform } from "@/platform/Platform";
import { getContentSize } from "@/state/getContentSize";
import type { StateContext } from "@/state/state";

type ActiveScrollTarget = NonNullable<StateContext["state"]["scrollingTo"]>;
const INITIAL_SCROLL_MAX_FALLBACK_CHECKS = 20;
const INITIAL_SCROLL_COMPLETION_TARGET_EPSILON = 1;
const INITIAL_SCROLL_MIN_TARGET_OFFSET = 1;
const INITIAL_SCROLL_ZERO_TARGET_EPSILON = 1;
const SILENT_INITIAL_SCROLL_RETRY_DELAY_MS = 16;
const SILENT_INITIAL_SCROLL_TARGET_EPSILON = 1;

export function checkFinishedScroll(ctx: StateContext) {
    // Wait a frame because there may be some requestAdjust after this which
    // change things so it would need to wait longer
    ctx.state.animFrameCheckFinishedScroll = requestAnimationFrame(() => checkFinishedScrollFrame(ctx));
}

function hasScrollCompletionOwnership(
    state: StateContext["state"],
    options: { clampedTargetOffset: number; scrollingTo: ActiveScrollTarget },
) {
    const { clampedTargetOffset, scrollingTo } = options;
    return (
        !scrollingTo.isInitialScroll ||
        state.hasScrolled ||
        clampedTargetOffset <= INITIAL_SCROLL_COMPLETION_TARGET_EPSILON
    );
}

function didDispatchInitialScrollNativeScroll(state: StateContext["state"]) {
    return !!state.initialScrollSession?.completion?.didDispatchNativeScroll;
}

function didRetrySilentInitialScroll(state: StateContext["state"]) {
    return !!state.initialScrollSession?.completion?.didRetrySilentInitialScroll;
}

function markSilentInitialScrollRetry(state: StateContext["state"]) {
    if (state.initialScrollSession) {
        state.initialScrollSession.completion ??= {};
        state.initialScrollSession.completion.didRetrySilentInitialScroll = true;
    }
}

function isSilentInitialDispatch(state: StateContext["state"], scrollingTo: ActiveScrollTarget | undefined) {
    return !!scrollingTo?.isInitialScroll && didDispatchInitialScrollNativeScroll(state) && !state.hasScrolled;
}

function isNativeInitialNonZeroTarget(state: StateContext["state"]) {
    const targetOffset = getInitialScrollSessionWatchdog(state)?.targetOffset;
    return (
        !state.didFinishInitialScroll && targetOffset !== undefined && targetOffset > INITIAL_SCROLL_MIN_TARGET_OFFSET
    );
}

function shouldFinishInitialScrollWithoutNativeProgress(state: StateContext["state"], scrollingTo: ActiveScrollTarget) {
    if (!scrollingTo.isInitialScroll || scrollingTo.animated || !state.didContainersLayout) {
        return false;
    }

    if (getBootstrapInitialScrollSession(state)) {
        return false;
    }

    const targetOffset = scrollingTo.targetOffset ?? scrollingTo.offset;
    if (
        targetOffset > INITIAL_SCROLL_MIN_TARGET_OFFSET &&
        didDispatchInitialScrollNativeScroll(state) &&
        !state.hasScrolled
    ) {
        return false;
    }

    if (
        targetOffset <= INITIAL_SCROLL_MIN_TARGET_OFFSET ||
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

function checkFinishedScrollFrame(ctx: StateContext) {
    const scrollingTo = ctx.state.scrollingTo;
    if (!scrollingTo) {
        return;
    }

    const { state } = ctx;
    state.animFrameCheckFinishedScroll = undefined;
    const completionState = getResolvedScrollCompletionState(ctx, scrollingTo);
    if (
        completionState.isAtResolvedTarget &&
        hasScrollCompletionOwnership(state, {
            clampedTargetOffset: completionState.clampedTargetOffset,
            scrollingTo,
        })
    ) {
        finishScrollTo(ctx);
    }
}

function scrollToFallbackOffset(ctx: StateContext, offset: number) {
    ctx.state.refScroller.current?.scrollTo({
        animated: false,
        x: ctx.state.props.horizontal ? offset : 0,
        y: ctx.state.props.horizontal ? 0 : offset,
    });
}

// In case checkFinishedScroll does not work correctly, set a maximum timeout
// to make sure it does eventually get cleared, just waiting for scroll to end
export function checkFinishedScrollFallback(ctx: StateContext) {
    const state = ctx.state;
    const scrollingTo = state.scrollingTo;
    const shouldFinishInitialZeroTarget = shouldFinishInitialZeroTargetScroll(ctx);
    const silentInitialDispatch = isSilentInitialDispatch(state, scrollingTo);
    const canFinishInitialWithoutNativeProgress =
        scrollingTo !== undefined ? shouldFinishInitialScrollWithoutNativeProgress(state, scrollingTo) : false;
    const slowTimeout =
        (scrollingTo?.isInitialScroll && !shouldFinishInitialZeroTarget && !canFinishInitialWithoutNativeProgress) ||
        !state.didContainersLayout;
    const initialDelay =
        shouldFinishInitialZeroTarget || canFinishInitialWithoutNativeProgress
            ? 0
            : silentInitialDispatch
              ? SILENT_INITIAL_SCROLL_RETRY_DELAY_MS
              : slowTimeout
                ? 500
                : 100;

    state.timeoutCheckFinishedScrollFallback = setTimeout(() => {
        let numChecks = 0;
        const scheduleFallbackCheck = (delay: number) => {
            state.timeoutCheckFinishedScrollFallback = setTimeout(checkHasScrolled, delay);
        };
        const checkHasScrolled = () => {
            state.timeoutCheckFinishedScrollFallback = undefined;

            const isStillScrollingTo = state.scrollingTo;
            if (isStillScrollingTo) {
                numChecks++;
                const isNativeInitialPending = isNativeInitialNonZeroTarget(state) && !state.hasScrolled;
                const maxChecks = silentInitialDispatch
                    ? 5
                    : isNativeInitialPending
                      ? INITIAL_SCROLL_MAX_FALLBACK_CHECKS
                      : 5;
                const shouldFinishZeroTarget = shouldFinishInitialZeroTargetScroll(ctx);
                const canFinishInitialScrollWithoutNativeProgress = shouldFinishInitialScrollWithoutNativeProgress(
                    state,
                    isStillScrollingTo,
                );
                const completionState = getResolvedScrollCompletionState(ctx, isStillScrollingTo);
                const canFinishAfterSilentNativeDispatch =
                    silentInitialDispatch && completionState.isAtResolvedTarget && numChecks >= 1;
                const shouldRetrySilentInitialNativeScroll =
                    Platform.OS === "android" &&
                    canFinishAfterSilentNativeDispatch &&
                    !didRetrySilentInitialScroll(state);

                if (shouldRetrySilentInitialNativeScroll) {
                    const targetOffset =
                        getInitialScrollSessionWatchdog(state)?.targetOffset ?? isStillScrollingTo.targetOffset ?? 0;
                    const jiggleOffset =
                        targetOffset >= SILENT_INITIAL_SCROLL_TARGET_EPSILON
                            ? targetOffset - SILENT_INITIAL_SCROLL_TARGET_EPSILON
                            : targetOffset + SILENT_INITIAL_SCROLL_TARGET_EPSILON;
                    markSilentInitialScrollRetry(state);
                    scrollToFallbackOffset(ctx, jiggleOffset);
                    requestAnimationFrame(() => {
                        scrollToFallbackOffset(ctx, targetOffset);
                    });
                    scheduleFallbackCheck(SILENT_INITIAL_SCROLL_RETRY_DELAY_MS);
                } else if (
                    shouldFinishZeroTarget ||
                    state.hasScrolled ||
                    canFinishInitialScrollWithoutNativeProgress ||
                    canFinishAfterSilentNativeDispatch ||
                    numChecks > maxChecks
                ) {
                    finishScrollTo(ctx);
                } else if (isNativeInitialPending && numChecks <= maxChecks) {
                    const targetOffset = getInitialScrollSessionWatchdog(state)?.targetOffset ?? state.scrollPending;
                    scrollToFallbackOffset(ctx, targetOffset);
                    scheduleFallbackCheck(silentInitialDispatch ? SILENT_INITIAL_SCROLL_RETRY_DELAY_MS : 100);
                } else {
                    scheduleFallbackCheck(silentInitialDispatch ? SILENT_INITIAL_SCROLL_RETRY_DELAY_MS : 100);
                }
            }
        };
        checkHasScrolled();
    }, initialDelay);
}
