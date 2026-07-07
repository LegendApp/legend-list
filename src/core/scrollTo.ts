import { calculateOffsetWithOffsetPosition } from "@/core/calculateOffsetWithOffsetPosition";
import { cancelScrollCompletionChecks } from "@/core/cancelImperativeScroll";
import { clampScrollOffset } from "@/core/clampScrollOffset";
import { doScrollTo } from "@/core/doScrollTo";
import { getMaintainedWebEndOffset } from "@/core/getCurrentTargetOffset";
import { getItemSpaceOffset } from "@/core/getStartOffsetAdjustment";
import { initialScrollCompletion, initialScrollWatchdog } from "@/core/initialScrollSession";
import { createLayoutAccess, type LayoutAccess } from "@/core/layoutAccessors";
import { cancelNativeScrollToStart } from "@/core/nativeScrollToStart";
import { getActivePrefixLayoutStore } from "@/core/prefixLayoutStoreLifecycle";
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

function getLayoutEnd(layout: LayoutAccess, index: number | undefined) {
    const offset = layout.getOffset(index);
    const size = layout.getSize(index);
    return offset !== undefined && size !== undefined ? offset + size : undefined;
}

export function findVisibleItemIndex(
    ctx: StateContext,
    viewportStart: number,
    viewportEnd: number,
    layout = createLayoutAccess(ctx, getActivePrefixLayoutStore(ctx)),
) {
    const state = ctx.state;
    const dataLength = state.props.data.length;
    let low = 0;
    let high = dataLength - 1;
    let match: number | undefined;

    while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const top = layout.getOffset(mid);
        if (top !== undefined && top <= viewportStart) {
            match = mid;
            low = mid + 1;
        } else {
            high = mid - 1;
        }
    }

    let index = match ?? 0;
    // The last cell at this row's top may end above the viewport while a taller sibling remains visible.
    while (index > 0 && layout.getOffset(index - 1) === layout.getOffset(index)) index--;
    for (; index < state.props.data.length; index++) {
        const top = layout.getOffset(index);
        if (top === undefined || top >= viewportEnd) break;
        const bottom = getLayoutEnd(layout, index)! - ctx.scrollAxisGap;
        if (bottom > viewportStart && bottom > top) return index;
    }
    return undefined;
}

function getTargetViewportRenderRange(
    ctx: StateContext,
    layout: LayoutAccess,
    targetOffset: number,
    targetIndex: number | undefined,
) {
    const state = ctx.state;
    const dataLength = state.props.data.length;
    if (dataLength === 0) {
        return undefined;
    }

    // Use the same item-space conversion as calculateItemsInView.
    const itemOffset = getItemSpaceOffset(ctx, targetOffset);
    const viewportStart = Math.max(0, itemOffset);
    const viewportEnd = Math.max(viewportStart, itemOffset + state.scrollLength);
    let start =
        targetIndex !== undefined
            ? Math.max(0, Math.min(dataLength - 1, targetIndex))
            : findVisibleItemIndex(ctx, viewportStart, viewportEnd, layout);
    if (start === undefined) {
        return undefined;
    }
    if (targetIndex !== undefined && layout.getOffset(start) === undefined) {
        return { end: start, start };
    }
    while (start > 0) {
        const top = layout.getOffset(start);
        if (top === undefined || top <= viewportStart || layout.getOffset(start - 1) === undefined) {
            break;
        }
        start--;
    }
    while (start > 0) {
        const previousBottom = getLayoutEnd(layout, start - 1);
        if (previousBottom === undefined || previousBottom <= viewportStart) {
            break;
        }
        start--;
    }

    let end = start;
    while (end + 1 < dataLength) {
        const nextTop = layout.getOffset(end + 1);
        if (nextTop === undefined || nextTop > viewportEnd) {
            break;
        }
        end++;
    }

    return { end, start };
}

export function scrollTo(
    ctx: StateContext,
    params: InternalScrollTarget & { noScrollingTo?: boolean; forceScroll?: boolean },
) {
    const state = ctx.state;
    cancelNativeScrollToStart(ctx);
    const { noScrollingTo, forceScroll, ...scrollTarget } = params;
    const { animated, isInitialScroll, offset: scrollTargetOffset, precomputedWithViewOffset } = scrollTarget;
    const {
        props: { horizontal },
    } = state;

    // A new target owns completion, so callbacks from the previous target must stop first.
    cancelScrollCompletionChecks(state);

    const requestedOffset = precomputedWithViewOffset
        ? scrollTargetOffset
        : calculateOffsetWithOffsetPosition(ctx, scrollTargetOffset, scrollTarget);
    const shouldPreserveRawInitialOffsetRequest = !!isInitialScroll && state.initialScrollSession?.kind === "offset";
    const targetOffset =
        getMaintainedWebEndOffset(ctx, scrollTarget) ?? clampScrollOffset(ctx, requestedOffset, scrollTarget);
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
        };
        if (!isInitialScroll) {
            // The replacement owns its offset samples, including the optimistic update for an instant scroll.
            state.pendingNativeMVCPAdjust = undefined;
            state.scrollTargetPinnedRange = getTargetViewportRenderRange(ctx, createLayoutAccess(ctx, getActivePrefixLayoutStore(ctx)), targetOffset, scrollTarget.index);
            if (state.scrollTargetPinnedRange) {
                state.scrollForNextCalculateItemsInView = undefined;
            }
        }
    }
    // Animated requests have not moved yet. Layout can check completion before
    // the first scroll event, so keep the target only on scrollingTo until then.
    // Initial and instant scrolls still need the optimistic offset for settling.
    if (!animated || isInitialScroll) {
        state.scrollPending = targetOffset;
    }

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
        state.scroll = targetOffset;
    }
}
