import { calculateOffsetWithOffsetPosition } from "@/core/calculateOffsetWithOffsetPosition";
import { clampScrollOffset } from "@/core/clampScrollOffset";
import { doScrollTo } from "@/core/doScrollTo";
import { initialScrollCompletion, initialScrollWatchdog } from "@/core/initialScrollSession";
import { updateScroll } from "@/core/updateScroll";
import { Platform } from "@/platform/Platform";
import type { StateContext } from "@/state/state";

type InternalScrollTarget = NonNullable<StateContext["state"]["scrollingTo"]>;

function getAverageSizeSnapshot(state: StateContext["state"]): InternalScrollTarget["averageSizeSnapshot"] | undefined {
    if (Object.keys(state.averageSizes).length === 0) {
        return undefined;
    }
    const snapshot: NonNullable<InternalScrollTarget["averageSizeSnapshot"]> = {};
    for (const itemType in state.averageSizes) {
        const averages = state.averageSizes[itemType]!;
        snapshot[itemType] = averages.avg;
    }
    return snapshot;
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
    const existingWatchdog = initialScrollWatchdog.get(state);
    const shouldWatchInitialNativeScroll =
        !state.didFinishInitialScroll &&
        (isInitialScroll || !!existingWatchdog) &&
        initialScrollWatchdog.hasNonZeroTargetOffset(targetOffset);
    const shouldClearInitialNativeScrollWatchdog =
        !state.didFinishInitialScroll &&
        !!existingWatchdog &&
        initialScrollWatchdog.isAtZeroTargetOffset(requestedOffset);

    if (shouldWatchInitialNativeScroll) {
        state.hasScrolled = false;
        initialScrollWatchdog.set(state, {
            startScroll: existingWatchdog?.startScroll ?? state.scroll,
            targetOffset,
        });
        return;
    }

    if (shouldClearInitialNativeScrollWatchdog) {
        initialScrollWatchdog.clear(state);
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
            initialScrollCompletion.resetFlags(state);
        }
        const averageSizeSnapshot = getAverageSizeSnapshot(state);
        state.scrollingTo = {
            ...scrollTarget,
            ...(averageSizeSnapshot ? { averageSizeSnapshot } : {}),
            targetOffset,
            waitForInitialScrollCompletionFrame,
        };
    }
    state.scrollPending = targetOffset;

    // Keep the initial native-scroll watchdog anchored to the original starting point across retries.
    // That lets fallback nudges detect real progress instead of treating each retry as a brand new attempt.
    syncInitialScrollNativeWatchdog(state, { isInitialScroll, requestedOffset: offset, targetOffset });

    if (!animated && !isInitialScroll && !noScrollingTo && Math.abs(state.scroll - targetOffset) > 1) {
        updateScroll(ctx, targetOffset, false, { markHasScrolled: false });
    }

    if (forceScroll || !isInitialScroll || Platform.OS === "android") {
        doScrollTo(ctx, { animated, horizontal, isInitialScroll, offset });
    } else {
        state.scroll = offset;
    }
}
