import { finishScrollTo } from "@/core/finishScrollTo";
import { Platform } from "@/platform/Platform";
import { peek$, type StateContext } from "@/state/state";
import { checkAtBottom } from "@/utils/checkAtBottom";
import { checkAtTop } from "@/utils/checkAtTop";

export function updateScroll(ctx: StateContext, newScroll: number, forceUpdate?: boolean) {
    const state = ctx.state;
    const scrollingTo = peek$(ctx, "scrollingTo");

    state.hasScrolled = true;
    state.lastBatchingAction = Date.now();
    const currentTime = Date.now();

    const adjust = state.scrollAdjustHandler.getAdjust();
    const lastHistoryAdjust = state.lastScrollAdjustForHistory;
    const adjustChanged = lastHistoryAdjust !== undefined && Math.abs(adjust - lastHistoryAdjust) > 0.1;

    if (adjustChanged) {
        state.scrollHistory.length = 0;
    }

    state.lastScrollAdjustForHistory = adjust;

    // Don't add to the history if it's initial scroll event otherwise invalid velocity will be calculated
    // Don't add to the history if we are scrolling to an offset
    if (scrollingTo === undefined && !(state.scrollHistory.length === 0 && newScroll === state.scroll)) {
        if (!adjustChanged) {
            // Skip history samples while scrollAdjust is changing since those jumps are synthetic
            state.scrollHistory.push({ scroll: newScroll, time: currentTime });
        }
    }

    // Keep only last 5 entries
    if (state.scrollHistory.length > 5) {
        state.scrollHistory.shift();
    }

    // Update current scroll state
    state.scrollPrev = state.scroll;
    state.scrollPrevTime = state.scrollTime;
    state.scroll = newScroll;
    state.scrollTime = currentTime;

    // Ignore scroll events that are too close to the previous scroll position
    const ignoreScrollFromMVCP = state.ignoreScrollFromMVCP;
    if (ignoreScrollFromMVCP && !scrollingTo) {
        const { lt, gt } = ignoreScrollFromMVCP;
        if ((lt && newScroll < lt) || (gt && newScroll > gt)) {
            state.ignoreScrollFromMVCPIgnored = true;
            return;
        }
    }

    const lastCalculated = state.scrollLastCalculate;

    const shouldUpdate =
        forceUpdate ||
        state.dataChangeNeedsScrollUpdate ||
        state.scrollLastCalculate === undefined ||
        lastCalculated === undefined ||
        Math.abs(state.scroll - lastCalculated) > 2;

    if (shouldUpdate) {
        state.scrollLastCalculate = state.scroll;
        state.ignoreScrollFromMVCPIgnored = false;

        // Use velocity to predict scroll position
        state.triggerCalculateItemsInView?.({ doMVCP: scrollingTo !== undefined });
        checkAtBottom(ctx);
        checkAtTop(state);

        state.dataChangeNeedsScrollUpdate = false;
    }

    if (Platform.OS === "web" && state.initialScroll) {
        if (state.initialScrollTimeoutWeb) {
            clearTimeout(state.initialScrollTimeoutWeb);
        }
        state.initialScrollTimeoutWeb = setTimeout(() => {
            delete state.initialScrollTimeoutWeb;
            finishScrollTo(ctx);
        }, 200);
    }
}
