import { calculateOffsetWithOffsetPosition } from "@/core/calculateOffsetWithOffsetPosition";
import { clampScrollOffset } from "@/core/clampScrollOffset";
import { doScrollTo } from "@/core/doScrollTo";
import { materializeFixedLayoutStoreRangeAtOffsets } from "@/core/fixedLayoutMaterialization";
import { initialScrollCompletion, initialScrollWatchdog } from "@/core/initialScrollSession";
import { syncLayoutStoreState } from "@/core/layoutStoreLifecycle";
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

function pinScrollTargetRenderRange(ctx: StateContext, targetOffset: number) {
    const viewportStart = Math.max(0, targetOffset);
    const viewportEnd = Math.max(viewportStart, targetOffset + ctx.state.scrollLength);
    const materialized = materializeFixedLayoutStoreRangeAtOffsets(ctx, viewportStart, viewportEnd);
    if (materialized.didChange) {
        syncLayoutStoreState(ctx);
    }
    if (materialized.range) {
        ctx.state.scrollTargetPinnedRange = materialized.range;
        ctx.state.scrollForNextCalculateItemsInView = undefined;
    } else {
        ctx.state.scrollTargetPinnedRange = undefined;
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
        if (!isInitialScroll) {
            pinScrollTargetRenderRange(ctx, targetOffset);
        }
    }
    state.scrollPending = targetOffset;

    // Keep the initial native-scroll watchdog anchored to the original starting point across retries.
    // That lets fallback nudges detect real progress instead of treating each retry as a brand new attempt.
    syncInitialScrollNativeWatchdog(state, { isInitialScroll, requestedOffset: offset, targetOffset });

    if (!isInitialScroll && !noScrollingTo && Math.abs(state.scroll - targetOffset) > 1) {
        if (animated) {
            // Keep the current viewport selected, but force a pass so the pinned target
            // range mounts before native begins the animated scroll.
            if (state.scrollTargetPinnedRange) {
                state.triggerCalculateItemsInView?.();
            }
        } else {
            updateScroll(ctx, targetOffset, true, { markHasScrolled: false });
        }
    }

    if (forceScroll || !isInitialScroll || Platform.OS === "android") {
        doScrollTo(ctx, { animated, horizontal, isInitialScroll, offset });
    } else {
        state.scroll = offset;
    }
}
