import { calculateOffsetWithOffsetPosition } from "@/core/calculateOffsetWithOffsetPosition";
import { checkFinishedScroll } from "@/core/checkFinishedScroll";
import { clampScrollOffset } from "@/core/clampScrollOffset";
import { flushDeferredPositionStateBoundary } from "@/core/deferredPositionState";
import { doScrollTo } from "@/core/doScrollTo";
import { logInitialScrollTrace } from "@/core/logInitialScrollTrace";
import { Platform } from "@/platform/Platform";
import type { StateContext } from "@/state/state";
import type { ScrollTarget } from "@/types.base";

const WATCHDOG_OFFSET_EPSILON = 1;
type ScrollToParams = ScrollTarget & {
    forceScroll?: boolean;
    noScrollingTo?: boolean;
};

export function scrollTo(ctx: StateContext, params: ScrollToParams) {
    const state = ctx.state;
    const { noScrollingTo, forceScroll, ...scrollTarget } = params;
    const { animated, isInitialScroll, offset: scrollTargetOffset, precomputedWithViewOffset } = scrollTarget;
    const previousWatchdog = state.initialNativeScrollWatchdog
        ? {
              startScroll: state.initialNativeScrollWatchdog.startScroll,
              targetOffset: state.initialNativeScrollWatchdog.targetOffset,
          }
        : undefined;
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

    flushDeferredPositionStateBoundary(ctx);

    const requestedLogicalOffset = precomputedWithViewOffset
        ? scrollTargetOffset
        : calculateOffsetWithOffsetPosition(ctx, scrollTargetOffset, scrollTarget);
    const offset = clampScrollOffset(ctx, requestedLogicalOffset, scrollTarget);
    const clampDelta = requestedLogicalOffset - offset;
    const nextLogicalTargetOffset =
        noScrollingTo && state.scrollingTo?.isInitialScroll
            ? (state.scrollingTo.logicalTargetOffset ?? state.scrollingTo.targetOffset ?? state.scrollingTo.offset)
            : requestedLogicalOffset;

    if (noScrollingTo && state.scrollingTo?.isInitialScroll) {
        state.scrollingTo = {
            ...state.scrollingTo,
            logicalTargetOffset: nextLogicalTargetOffset,
            offset,
            targetOffset: offset,
        };
    }

    const activeInitialTargetOffset = state.scrollingTo?.isInitialScroll
        ? (state.scrollingTo.logicalTargetOffset ?? state.scrollingTo.targetOffset ?? state.scrollingTo.offset)
        : undefined;
    const didLowerActiveInitialTarget =
        !!isInitialScroll &&
        activeInitialTargetOffset !== undefined &&
        offset < activeInitialTargetOffset - WATCHDOG_OFFSET_EPSILON;
    const isDuplicateSettledInitialScroll =
        !state.didFinishInitialScroll &&
        isInitialScroll &&
        activeInitialTargetOffset !== undefined &&
        Math.abs(activeInitialTargetOffset - offset) <= WATCHDOG_OFFSET_EPSILON &&
        Math.abs(state.scroll - offset) <= WATCHDOG_OFFSET_EPSILON &&
        Math.abs(state.scrollPending - offset) <= WATCHDOG_OFFSET_EPSILON;
    if (isDuplicateSettledInitialScroll) {
        logInitialScrollTrace(ctx, "scrollTo:skip-duplicate-settled-target", {
            activeInitialTargetOffset,
            request: {
                animated,
                index: scrollTarget.index,
                isInitialScroll,
                offset: scrollTargetOffset,
                precomputedWithViewOffset,
                viewOffset: scrollTarget.viewOffset,
                viewPosition: scrollTarget.viewPosition,
            },
            resolvedOffset: offset,
        });
        checkFinishedScroll(ctx);
        return;
    }

    // Disable scroll adjust while scrolling so that it doesn't do extra work affecting the target offset
    state.scrollHistory.length = 0;

    // noScrollingTo is used for the workaround in mvcp to fake it with scroll
    if (!noScrollingTo) {
        state.scrollingTo = {
            ...scrollTarget,
            logicalTargetOffset: nextLogicalTargetOffset,
            targetOffset: offset,
        };
    }
    state.scrollPending = offset;

    // Keep the initial native-scroll watchdog anchored to the original starting point across retries.
    // That lets fallback nudges detect real progress instead of treating each retry as a brand new attempt.
    const shouldWatchInitialNativeScroll =
        !state.didFinishInitialScroll &&
        (isInitialScroll || !!state.initialNativeScrollWatchdog) &&
        offset > WATCHDOG_OFFSET_EPSILON;
    const shouldClearInitialNativeScrollWatchdog =
        !state.didFinishInitialScroll && !!state.initialNativeScrollWatchdog && offset <= WATCHDOG_OFFSET_EPSILON;
    if (shouldWatchInitialNativeScroll) {
        state.hasScrolled = false;
        state.initialNativeScrollWatchdog = {
            startScroll: state.initialNativeScrollWatchdog?.startScroll ?? state.scroll,
            targetOffset: nextLogicalTargetOffset,
        };
    } else if (shouldClearInitialNativeScrollWatchdog) {
        // A post-layout retry can collapse an initial target to zero when the content fits the viewport.
        // Clear any stale non-zero watchdog target so fallback does not keep retrying an impossible scroll.
        state.initialNativeScrollWatchdog = undefined;
    }

    logInitialScrollTrace(ctx, "scrollTo", {
        activeInitialTargetOffset,
        clampDelta,
        didLowerActiveInitialTarget,
        forceScroll: !!forceScroll,
        noScrollingTo: !!noScrollingTo,
        previousWatchdog,
        request: {
            animated,
            index: scrollTarget.index,
            isInitialScroll,
            offset: scrollTargetOffset,
            precomputedWithViewOffset,
            viewOffset: scrollTarget.viewOffset,
            viewPosition: scrollTarget.viewPosition,
        },
        requestedLogicalOffset,
        resolvedOffset: offset,
    });

    if (forceScroll || !isInitialScroll || Platform.OS === "android") {
        doScrollTo(ctx, { animated, horizontal, isInitialScroll, offset });
    } else {
        state.scroll = offset;
    }
}
