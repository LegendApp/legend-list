import { calculateOffsetWithOffsetPosition } from "@/core/calculateOffsetWithOffsetPosition";
import { clampScrollOffset } from "@/core/clampScrollOffset";
import { doScrollTo } from "@/core/doScrollTo";
import { Platform } from "@/platform/Platform";
import type { StateContext } from "@/state/state";
import type { ScrollTarget } from "@/types.base";

const WATCHDOG_OFFSET_EPSILON = 1;

function debugInitialEnd(event: string, payload: Record<string, unknown>) {
    if (Platform.OS !== "web") {
        return;
    }

    const debugState = ((globalThis as any).__legendInitialEndDebug ??= { seq: 0 }) as { seq: number };
    console.log(`${Date.now()} [debug-log bidirectional-initial-end initial-end-v2] ${event}`, {
        seq: ++debugState.seq,
        ...payload,
    });
}

export function scrollTo(ctx: StateContext, params: ScrollTarget & { noScrollingTo?: boolean; forceScroll?: boolean }) {
    const state = ctx.state;
    const { noScrollingTo, forceScroll, ...scrollTarget } = params;
    const { animated, isInitialScroll, offset: scrollTargetOffset, precomputedWithViewOffset } = scrollTarget;
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
    if (state.timeoutUserScrollActive) {
        clearTimeout(state.timeoutUserScrollActive);
        state.timeoutUserScrollActive = undefined;
    }
    state.userScrollActive = false;

    let offset = precomputedWithViewOffset
        ? scrollTargetOffset
        : calculateOffsetWithOffsetPosition(ctx, scrollTargetOffset, scrollTarget);

    offset = clampScrollOffset(ctx, offset, scrollTarget);

    if (isInitialScroll || !!ctx.state.deferredPositions) {
        debugInitialEnd("scroll-to", {
            animated,
            forceScroll,
            isInitialScroll,
            noScrollingTo,
            offset,
            precomputedWithViewOffset,
            requestedOffset: scrollTargetOffset,
            scroll: state.scroll,
            targetOffset: ctx.state.scrollingTo?.targetOffset,
            viewOffset: scrollTarget.viewOffset,
            viewPosition: scrollTarget.viewPosition,
        });
    }

    // Disable scroll adjust while scrolling so that it doesn't do extra work affecting the target offset
    state.scrollHistory.length = 0;

    // noScrollingTo is used for the workaround in mvcp to fake it with scroll
    if (!noScrollingTo) {
        state.scrollingTo = {
            ...scrollTarget,
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
            targetOffset: offset,
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
