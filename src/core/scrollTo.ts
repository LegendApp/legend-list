import { calculateOffsetForIndex } from "@/core/calculateOffsetForIndex";
import { calculateOffsetWithOffsetPosition } from "@/core/calculateOffsetWithOffsetPosition";
import { cancelScrollCompletionChecks } from "@/core/cancelImperativeScroll";
import { cancelScroll } from "@/core/cancelScroll";
import { clampScrollOffset } from "@/core/clampScrollOffset";
import { doScrollTo } from "@/core/doScrollTo";
import { finishScrollTo } from "@/core/finishScrollTo";
import { materializeFixedLayoutStoreRangeAtOffsets } from "@/core/fixedLayoutMaterialization";
import { getMaintainedWebEndOffset } from "@/core/getCurrentTargetOffset";
import { getItemSpaceOffset } from "@/core/getStartOffsetAdjustment";
import { getDataLength } from "@/core/IndexedData";
import { initialScrollCompletion, initialScrollWatchdog } from "@/core/initialScrollSession";
import { getActiveLayoutStore, syncLayoutStoreState } from "@/core/layoutStoreLifecycle";
import { cancelNativeScrollToStart } from "@/core/nativeScrollToStart";
import { updateScroll } from "@/core/updateScroll";
import { Platform } from "@/platform/Platform";
import type { StateContext } from "@/state/state";
import { getItemSizeAtIndex } from "@/utils/getItemSize";

type InternalScrollTarget = NonNullable<StateContext["state"]["scrollingTo"]>;

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
            targetOffset,
        });
        return;
    }

    if (shouldClearInitialNativeScrollWatchdog) {
        initialScrollWatchdog.clear(state);
    }
}

export function findVisibleItemIndex(ctx: StateContext, viewportStart: number, viewportEnd: number) {
    const store = getActiveLayoutStore(ctx);
    const range = store?.findIndexRangeAtOffsets(viewportStart, viewportEnd);
    if (!range || !store) return undefined;
    for (let index = range.start; index <= range.end; index++) {
        const top = store.getOffset(index);
        if (top >= viewportEnd) break;
        const bottom = top + store.getSize(index) - ctx.scrollAxisGap;
        if (bottom > viewportStart && bottom > top) return index;
    }
    return undefined;
}

function pinScrollTargetRenderRange(ctx: StateContext, targetOffset: number) {
    const itemOffset = getItemSpaceOffset(ctx, targetOffset);
    const viewportStart = Math.max(0, itemOffset);
    const viewportEnd = Math.max(viewportStart, itemOffset + ctx.state.scrollLength);
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
    const shouldPreserveRawInitialOffsetRequest = !!isInitialScroll && state.initialScroll?.kind === "offset";
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
        state.scrollingTo = {
            ...scrollTarget,
            targetOffset,
        };
        if (!isInitialScroll) {
            // The replacement owns its offset samples, including the optimistic update for an instant scroll.
            state.pendingNativeMVCPAdjust = undefined;
            pinScrollTargetRenderRange(ctx, targetOffset);
        }
    }
    // Animated requests have not moved yet. Layout can check completion before
    // the first scroll event, so keep the target only on scrollingTo until then.
    // Initial and instant scrolls still need the optimistic offset for settling.
    if (!animated || isInitialScroll) {
        state.scrollPending = targetOffset;
    }

    // A non-zero initial target completes only after observing that target or exhausting native retries.
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

export function reconcileActiveScrollTarget(ctx: StateContext) {
    const { state } = ctx;
    const target = state.scrollingTo;
    if (!target || target.isInitialScroll) return;
    const count = getDataLength(state);
    const index = target.isScrollToEnd
        ? count - 1
        : target.key === undefined
          ? target.index
          : state.indexByKey.get(target.key);
    if ((index === undefined && target.key !== undefined) || (index !== undefined && (index < 0 || index >= count))) {
        if (ctx.scrollRequestTracker?.isWaitingToRun()) finishScrollTo(ctx);
        else cancelScroll(ctx);
    } else if (index !== undefined && index !== target.index) {
        target.index = index;
        state.scheduledWork.microtask(() => {
            if (state.scrollingTo !== target) return;
            scrollTo(ctx, {
                ...target,
                itemSize: getItemSizeAtIndex(ctx, index),
                offset: calculateOffsetForIndex(ctx, index),
                precomputedWithViewOffset: false,
            });
        }, "scrollTargetRetarget");
        return true;
    }
}
