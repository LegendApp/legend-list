import { flushDeferredPositions, isDeferredInitialScrollSession } from "@/core/deferredPositions";
import { doMaintainScrollAtEnd } from "@/core/doMaintainScrollAtEnd";
import { resolvePendingNativeMVCPAdjust } from "@/core/mvcp";
import { flushSync } from "@/platform/flushSync";
import { Platform } from "@/platform/Platform";
import type { StateContext } from "@/state/state";
import { checkThresholds } from "@/utils/checkThresholds";
import { isInMVCPActiveMode } from "@/utils/isInMVCPActiveMode";

const USER_SCROLL_ACTIVE_IDLE_MS = 80;

export function updateScroll(ctx: StateContext, newScroll: number, forceUpdate?: boolean) {
    const state = ctx.state;
    const { ignoreScrollFromMVCP, lastScrollAdjustForHistory, scrollAdjustHandler, scrollHistory, scrollingTo } = state;
    const prevScroll = state.scroll;

    state.hasScrolled = true;
    state.lastBatchingAction = Date.now();
    const currentTime = Date.now();

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

    if (!scrollingTo) {
        state.userScrollActive = true;
        if (state.timeoutUserScrollActive) {
            clearTimeout(state.timeoutUserScrollActive);
        }
        state.timeoutUserScrollActive = setTimeout(() => {
            state.userScrollActive = false;
            state.timeoutUserScrollActive = undefined;
            if (
                !isDeferredInitialScrollSession(state.deferredPositions) &&
                !state.prependMeasurementWindow?.pendingKeys.size
            ) {
                flushDeferredPositions(ctx, "scrollUnsafe");
            }
        }, USER_SCROLL_ACTIVE_IDLE_MS);
    }

    // Update current scroll state
    state.scrollPrev = prevScroll;
    state.scrollPrevTime = state.scrollTime;
    state.scroll = newScroll;
    state.scrollTime = currentTime;

    const scrollDelta = Math.abs(newScroll - prevScroll);
    const didResolvePendingNativeMVCPAdjust = resolvePendingNativeMVCPAdjust(ctx, newScroll);
    const scrollLength = state.scrollLength;
    const lastCalculated = state.scrollLastCalculate;
    // During MVCP stabilization we cannot rely on the normal scroll delta threshold.
    const useAggressiveItemRecalculation = isInMVCPActiveMode(state);

    const shouldUpdate =
        useAggressiveItemRecalculation ||
        didResolvePendingNativeMVCPAdjust ||
        forceUpdate ||
        lastCalculated === undefined ||
        Math.abs(state.scroll - lastCalculated) > 2;

    if (shouldUpdate) {
        state.scrollLastCalculate = state.scroll;
        state.ignoreScrollFromMVCPIgnored = false;
        state.lastScrollDelta = scrollDelta;

        // Use velocity to predict scroll position
        const runCalculateItems = () => {
            state.triggerCalculateItemsInView?.({ doMVCP: scrollingTo !== undefined });
            checkThresholds(ctx);
        };

        if (Platform.OS === "web" && scrollLength > 0 && scrollingTo === undefined && scrollDelta > scrollLength) {
            flushSync(runCalculateItems);
        } else {
            runCalculateItems();
        }

        const shouldMaintainScrollAtEndAfterPendingSettle =
            !!state.pendingMaintainScrollAtEnd || !!state.props.maintainScrollAtEnd?.onDataChange;

        // If end anchoring was deferred while native MVCP was still clamping, replay it immediately
        // after that pending native adjust resolves so the list still ends up pinned to the tail.
        if (didResolvePendingNativeMVCPAdjust && shouldMaintainScrollAtEndAfterPendingSettle) {
            state.pendingMaintainScrollAtEnd = false;
            doMaintainScrollAtEnd(ctx);
        }

        state.dataChangeNeedsScrollUpdate = false;
        state.lastScrollDelta = 0;
    }
}
