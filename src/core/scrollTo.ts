import { calculateOffsetWithOffsetPosition } from "@/core/calculateOffsetWithOffsetPosition";
import { clampScrollOffset } from "@/core/clampScrollOffset";
import { doScrollTo } from "@/core/doScrollTo";
import {
    ensureInitialScrollSessionCompletion,
    INITIAL_SCROLL_MIN_TARGET_OFFSET,
    resetInitialScrollCompletionFlags,
} from "@/core/initialScrollSession";
import { Platform } from "@/platform/Platform";
import type { StateContext } from "@/state/state";

type InternalScrollTarget = NonNullable<StateContext["state"]["scrollingTo"]>;

function getInitialScrollWatchdog(state: StateContext["state"]) {
    return state.initialScrollSession?.completion?.watchdog;
}

function setInitialScrollWatchdog(
    state: StateContext["state"],
    watchdog: NonNullable<NonNullable<StateContext["state"]["initialScrollSession"]>["completion"]>["watchdog"],
) {
    if (!watchdog && !state.initialScrollSession?.completion?.watchdog) {
        return;
    }

    const completion = ensureInitialScrollSessionCompletion(state, "bootstrap");
    completion.watchdog = watchdog
        ? {
              startScroll: watchdog.startScroll,
              targetOffset: watchdog.targetOffset,
          }
        : undefined;
}

function didObserveInitialScrollProgress(
    newScroll: number,
    watchdog: NonNullable<NonNullable<StateContext["state"]["initialScrollSession"]>["completion"]>["watchdog"],
) {
    const previousDistance = Math.abs(watchdog.startScroll - watchdog.targetOffset);
    const nextDistance = Math.abs(newScroll - watchdog.targetOffset);
    return (
        nextDistance <= INITIAL_SCROLL_MIN_TARGET_OFFSET ||
        nextDistance + INITIAL_SCROLL_MIN_TARGET_OFFSET < previousDistance
    );
}

function syncInitialScrollNativeWatchdog(
    state: StateContext["state"],
    options: {
        isInitialScroll: boolean | undefined;
        requestedOffset: number;
        targetOffset: number;
    },
) {
    const { isInitialScroll, requestedOffset, targetOffset } = options;
    const existingWatchdog = getInitialScrollWatchdog(state);
    const shouldWatchInitialNativeScroll =
        !state.didFinishInitialScroll &&
        (isInitialScroll || !!existingWatchdog) &&
        targetOffset > INITIAL_SCROLL_MIN_TARGET_OFFSET;
    const shouldClearInitialNativeScrollWatchdog =
        !state.didFinishInitialScroll && !!existingWatchdog && requestedOffset <= INITIAL_SCROLL_MIN_TARGET_OFFSET;

    if (shouldWatchInitialNativeScroll) {
        state.hasScrolled = false;
        setInitialScrollWatchdog(state, {
            startScroll: existingWatchdog?.startScroll ?? state.scroll,
            targetOffset,
        });
        return;
    }

    if (shouldClearInitialNativeScrollWatchdog) {
        setInitialScrollWatchdog(state, undefined);
    }
}

export function trackInitialScrollNativeProgress(state: StateContext["state"], newScroll: number) {
    const initialNativeScrollWatchdog = getInitialScrollWatchdog(state);
    const didInitialScrollProgress =
        !!initialNativeScrollWatchdog && didObserveInitialScrollProgress(newScroll, initialNativeScrollWatchdog);

    if (didInitialScrollProgress) {
        setInitialScrollWatchdog(state, undefined);
        return;
    }

    if (initialNativeScrollWatchdog) {
        state.hasScrolled = false;
        setInitialScrollWatchdog(state, initialNativeScrollWatchdog);
    }
}

export function scrollTo(
    ctx: StateContext,
    params: InternalScrollTarget & { noScrollingTo?: boolean; forceScroll?: boolean },
) {
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
    const shouldPreserveRawInitialOffsetRequest = !!isInitialScroll && state.initialScrollSession?.kind === "offset";
    const targetOffset = clampScrollOffset(ctx, requestedOffset, scrollTarget);
    const offset = shouldPreserveRawInitialOffsetRequest ? requestedOffset : targetOffset;

    // Disable scroll adjust while scrolling so that it doesn't do extra work affecting the target offset
    state.scrollHistory.length = 0;

    // noScrollingTo is used for the workaround in mvcp to fake it with scroll
    if (!noScrollingTo) {
        if (isInitialScroll) {
            resetInitialScrollCompletionFlags(state);
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
    syncInitialScrollNativeWatchdog(state, { isInitialScroll, requestedOffset: offset, targetOffset });

    if (forceScroll || !isInitialScroll || Platform.OS === "android") {
        doScrollTo(ctx, { animated, horizontal, isInitialScroll, offset });
    } else {
        state.scroll = offset;
    }
}
