import { checkFinishedScroll, checkFinishedScrollFallback } from "@/core/checkFinishedScroll";
import { type DoScrollToParams, getNativeScrollPoint } from "@/core/doScrollParams";
import { initialScrollCompletion } from "@/core/initialScrollSession";
import type { StateContext } from "@/state/state";

export function doScrollTo(ctx: StateContext, params: DoScrollToParams) {
    const state = ctx.state;
    const { animated, horizontal, isInitialScroll, offset } = params;
    const isAnimated = !!animated;
    const { refScroller } = state;
    const scroller = refScroller.current;

    if (!scroller) {
        return;
    }

    if (!params.isAdjustment) {
        // Explicit requests own their momentum; MVCP re-assertions keep the gesture's ownership.
        state.userScrollContentSize = undefined;
    }

    scroller.scrollTo({ animated: isAnimated, ...getNativeScrollPoint(ctx, offset, horizontal) });
    if (isInitialScroll) {
        initialScrollCompletion.markInitialScrollNativeDispatch(state);
    }

    if (isAnimated && Math.abs(state.scroll - offset) <= 1) {
        checkFinishedScroll(ctx);
    }

    if (!isAnimated) {
        state.scroll = offset;
    }
    // Native can accept an animated request without emitting any completion events.
    checkFinishedScrollFallback(ctx);
}
