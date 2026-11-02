import { EDGE_POSITION_EPSILON } from "@/constants";
import { updateAdaptiveRender } from "@/core/adaptiveRender";
import { interruptMaintainScrollAtEnd } from "@/core/finishMaintainScrollAtEnd";
import { resolvePendingNativeMVCPAdjust } from "@/core/mvcp";
import { flushSync } from "@/platform/flushSync";
import { Platform } from "@/platform/Platform";
import { getContentSize } from "@/state/getContentSize";
import { peek$, type StateContext, set$ } from "@/state/state";
import { checkThresholds } from "@/utils/checkThresholds";
import { beginReachedEdgeUserScroll } from "@/utils/edgeReachedGate";
import type { DrawDistanceMode } from "@/utils/getEffectiveDrawDistance";
import { scheduleFullDrawDistancePrewarm } from "@/utils/getEffectiveDrawDistance";
import { getScrollVelocity } from "@/utils/getScrollVelocity";
import { hasActiveInitialScroll } from "@/utils/hasActiveInitialScroll";
import { isInMVCPActiveMode } from "@/utils/isInMVCPActiveMode";

export function updateScroll(
    ctx: StateContext,
    newScroll: number,
    forceUpdate?: boolean,
    options?: { fromNativeScrollEvent?: boolean; markHasScrolled?: boolean; nativeGeometryChanged?: boolean },
) {
    const state = ctx.state;
    const { ignoreScrollFromMVCP, lastScrollAdjustForHistory, scrollAdjustHandler, scrollHistory, scrollingTo } = state;
    const prevScroll = state.scroll;

    if (options?.markHasScrolled !== false) {
        state.hasScrolled = true;
    }
    const currentTime = Date.now();
    state.lastBatchingAction = currentTime;

    const adjust = scrollAdjustHandler.getAdjust();
    const adjustChanged =
        lastScrollAdjustForHistory !== undefined && Math.abs(adjust - lastScrollAdjustForHistory) > 0.1;

    if (adjustChanged) {
        scrollHistory.length = 0;
    }

    state.lastScrollAdjustForHistory = adjust;

    // Don't add to the history if it's initial scroll event otherwise invalid velocity will be calculated
    // Don't add to the history if we are scrolling to an offset
    if (scrollingTo === undefined && !(scrollHistory.length === 0 && newScroll === state.scroll)) {
        if (!adjustChanged) {
            // Skip history samples while scrollAdjust is changing since those jumps are synthetic
            scrollHistory.push({ scroll: newScroll, time: currentTime });
        }
    }

    // Keep only last 5 entries
    if (scrollHistory.length > 5) {
        scrollHistory.shift();
    }

    // Ignore scroll events that are closer to the previous scroll position than the target position after MVCP
    // This prevents a race condition where MVCP adjusts the scroll position for the new items
    // and then a scroll event comes in that was relevant from before the MVCP adjustment.
    if (ignoreScrollFromMVCP && !scrollingTo) {
        const { lt, gt } = ignoreScrollFromMVCP;
        if ((lt && newScroll < lt) || (gt && newScroll > gt)) {
            state.ignoreScrollFromMVCPIgnored = true;

            return;
        }
    }

    // Update current scroll state
    state.scrollPrev = prevScroll;
    state.scrollPrevTime = state.scrollTime;
    state.scroll = newScroll;
    state.scrollTime = currentTime;

    // Only backward web scroll events need to distinguish a clamp from user scrolling.
    const previousComparableScroll =
        Platform.OS === "web" && options?.fromNativeScrollEvent && newScroll < prevScroll
            ? Math.min(prevScroll, state.refScroller.current?.getMaxScrollOffset?.() ?? prevScroll)
            : prevScroll;
    const scrollDelta = Math.abs(newScroll - prevScroll);
    const isUserScrollEvent =
        !!options?.fromNativeScrollEvent &&
        scrollDelta > 0.1 &&
        (Platform.OS !== "web" ||
            (!hasActiveInitialScroll(state) && Math.abs(newScroll - previousComparableScroll) > 0.1)) &&
        !adjustChanged &&
        scrollingTo === undefined &&
        !state.pendingNativeMVCPAdjust;
    if (isUserScrollEvent) {
        // The first sample after a pause has zero velocity, but a fresh direction.
        state.scrollBufferDirection = newScroll > prevScroll ? 1 : -1;
    }
    const didCancelMaintainScrollAtEnd =
        isUserScrollEvent &&
        !!(state.maintainingScrollAtEnd || state.pendingMaintainScrollAtEnd || peek$(ctx, "isFollowingEnd")) &&
        (Platform.OS === "web"
            ? newScroll < previousComparableScroll - 1
            : !options?.nativeGeometryChanged &&
              !state.maintainingScrollAtEnd &&
              !state.pendingMaintainScrollAtEnd &&
              !state.isDragging &&
              state.userScrollContentSize === undefined &&
              getContentSize(ctx) - newScroll - state.scrollLength >
                  Math.max(
                      EDGE_POSITION_EPSILON,
                      (state.props.maintainScrollAtEndThreshold ?? 0) * state.scrollLength,
                  ));
    if (didCancelMaintainScrollAtEnd) {
        if (Platform.OS === "web") {
            ctx.interruptUserScroll!();
        } else {
            // Native-ref and custom scroller commands have no list owner.
            interruptMaintainScrollAtEnd(ctx);
        }
    }
    if (isUserScrollEvent) {
        state.visibleContentAnchor = undefined;
        if (
            !state.isDragging &&
            !state.isMomentumScrolling &&
            state.userScrollContentSize === undefined &&
            newScroll > prevScroll &&
            getContentSize(ctx) - newScroll - state.scrollLength <= 1
        ) {
            state.endFollowInterrupted = false;
            if (state.props.maintainScrollAtEnd) set$(ctx, "isFollowingEnd", true);
        }
    }
    const allowedEdge = isUserScrollEvent ? beginReachedEdgeUserScroll(ctx, newScroll - prevScroll) : undefined;
    const didResolvePendingNativeMVCPAdjust = resolvePendingNativeMVCPAdjust(ctx, newScroll);
    const scrollLength = state.scrollLength;
    const isLargeUserScrollJump =
        scrollLength > 0 && scrollingTo === undefined && scrollDelta > scrollLength && !state.pendingNativeMVCPAdjust;
    const scrollVelocity = getScrollVelocity(state);
    updateAdaptiveRender(ctx, scrollVelocity, { forceLight: isLargeUserScrollJump });
    const lastCalculated = state.scrollLastCalculate;
    // During MVCP stabilization we cannot rely on the normal scroll delta threshold.
    const useAggressiveItemRecalculation = isInMVCPActiveMode(state);

    const shouldUpdate =
        useAggressiveItemRecalculation ||
        didResolvePendingNativeMVCPAdjust ||
        didCancelMaintainScrollAtEnd ||
        allowedEdge !== undefined ||
        forceUpdate ||
        lastCalculated === undefined ||
        Math.abs(state.scroll - lastCalculated) > 2;

    if (shouldUpdate) {
        state.scrollLastCalculate = state.scroll;
        state.ignoreScrollFromMVCPIgnored = false;
        state.lastScrollDelta = scrollDelta;

        // Use velocity to predict scroll position
        const runCalculateItems = () => {
            const calculateItemsParams: {
                doMVCP: boolean;
                drawDistanceMode?: DrawDistanceMode;
                scrollVelocity: number;
            } = {
                doMVCP: scrollingTo !== undefined,
                scrollVelocity,
            };
            if (isLargeUserScrollJump) {
                calculateItemsParams.drawDistanceMode = "visible-first";
            }
            state.triggerCalculateItemsInView?.(calculateItemsParams);
            checkThresholds(ctx, allowedEdge);
        };

        if (isLargeUserScrollJump) {
            state.mvcpAnchorLock = undefined;
            state.pendingNativeMVCPAdjust = undefined;
            state.userScrollAnchorReset = { keys: new Set() };
            state.scheduledWork.cancel("mvcpRecalculate");
            flushSync(runCalculateItems);
            scheduleFullDrawDistancePrewarm(ctx);
        } else {
            runCalculateItems();
        }

        const shouldMaintainScrollAtEndAfterPendingSettle =
            !!state.pendingMaintainScrollAtEnd || !!state.props.maintainScrollAtEnd?.onDataChange;

        // If end anchoring was deferred while native MVCP was still clamping, replay it immediately
        // after that pending native adjust resolves so the list still ends up pinned to the tail.
        if (didResolvePendingNativeMVCPAdjust && shouldMaintainScrollAtEndAfterPendingSettle) {
            state.pendingMaintainScrollAtEnd = false;
            ctx.doMaintainScrollAtEnd!();
        }

        state.dataChangeNeedsScrollUpdate = false;
        state.lastScrollDelta = 0;
    }
}
