import { calculateOffsetWithOffsetPosition } from "@/core/calculateOffsetWithOffsetPosition";
import { clampScrollOffset } from "@/core/clampScrollOffset";
import { doScrollTo } from "@/core/doScrollTo";
import { Platform } from "@/platform/Platform";
import type { StateContext } from "@/state/state";
import type { ScrollTarget } from "@/types.base";

const WATCHDOG_OFFSET_EPSILON = 1;

export function scrollTo(ctx: StateContext, params: ScrollTarget & { noScrollingTo?: boolean; forceScroll?: boolean }) {
    const state = ctx.state;
    const { noScrollingTo, forceScroll, ...scrollTarget } = params;
    const {
        animated,
        isInitialScroll,
        offset: scrollTargetOffset,
        precomputedWithViewOffset,
        waitForInitialScrollCompletionFrame,
    } = scrollTarget;
    const {
        props: { horizontal },
    } = state;

    // Clear out previous timeouts which would finishScrollTo
    if (state.animFrameCheckFinishedScroll) {
        cancelAnimationFrame(ctx.state.animFrameCheckFinishedScroll);
    }
    if (state.timeoutCheckFinishedScrollFallback) {
        clearTimeout(ctx.state.timeoutCheckFinishedScrollFallback);
    }

    const requestedOffset = precomputedWithViewOffset
        ? scrollTargetOffset
        : calculateOffsetWithOffsetPosition(ctx, scrollTargetOffset, scrollTarget);
    const shouldPreserveRawInitialOffsetRequest = !!isInitialScroll && state.initialScrollUsesOffset;
    const targetOffset = clampScrollOffset(ctx, requestedOffset, scrollTarget);
    const offset = shouldPreserveRawInitialOffsetRequest ? requestedOffset : targetOffset;

    // Disable scroll adjust while scrolling so that it doesn't do extra work affecting the target offset
    state.scrollHistory.length = 0;

    // noScrollingTo is used for the workaround in mvcp to fake it with scroll
    if (!noScrollingTo) {
        if (isInitialScroll) {
            state.didDispatchNativeScroll = undefined;
            state.didRetrySilentInitialScroll = undefined;
        }
        state.scrollingTo = {
            ...scrollTarget,
            targetOffset,
            waitForInitialScrollCompletionFrame,
        };
    }
    state.scrollPending = targetOffset;

    // Keep the initial native-scroll watchdog anchored to the original starting point across retries.
    // That lets fallback nudges detect real progress instead of treating each retry as a brand new attempt.
    const shouldWatchInitialNativeScroll =
        !state.didFinishInitialScroll &&
        (isInitialScroll || !!state.initialNativeScrollWatchdog) &&
        targetOffset > WATCHDOG_OFFSET_EPSILON;
    const shouldClearInitialNativeScrollWatchdog =
        !state.didFinishInitialScroll && !!state.initialNativeScrollWatchdog && offset <= WATCHDOG_OFFSET_EPSILON;
    if (shouldWatchInitialNativeScroll) {
        state.hasScrolled = false;
        state.initialNativeScrollWatchdog = {
            startScroll: state.initialNativeScrollWatchdog?.startScroll ?? state.scroll,
            targetOffset,
        };
    } else if (shouldClearInitialNativeScrollWatchdog) {
        // A post-layout retry can collapse an initial target to zero when the content fits the viewport.
        // Clear any stale non-zero watchdog target so fallback does not keep retrying an impossible scroll.
        state.initialNativeScrollWatchdog = undefined;
    }

    if (forceScroll || !isInitialScroll || Platform.OS === "android") {
        doScrollTo(ctx, { animated, horizontal, isInitialScroll, offset });
    } else {
        state.scroll = offset;
    }
}
