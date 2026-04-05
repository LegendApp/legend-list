import { checkFinishedScrollFallback } from "@/core/checkFinishedScroll";
import type { StateContext } from "@/state/state";
import type { DoScrollToParams } from "@/typesInternal";

function markInitialScrollNativeDispatch(state: StateContext["state"]) {
    if (state.initialScrollSession) {
        state.initialScrollSession.completion ??= {};
        state.initialScrollSession.completion.didDispatchNativeScroll = true;
    }
}

export function doScrollTo(ctx: StateContext, params: DoScrollToParams) {
    const state = ctx.state;
    const { animated, horizontal, isInitialScroll, offset } = params;
    const isAnimated = !!animated;
    const { refScroller } = state;
    const scroller = refScroller.current;

    if (!scroller) {
        return;
    }

    scroller.scrollTo({
        animated: isAnimated,
        x: horizontal ? offset : 0,
        y: horizontal ? 0 : offset,
    });
    if (isInitialScroll) {
        markInitialScrollNativeDispatch(state);
    }

    // If it's animated we can rely on onMomentumScrollEnd to call finishScrollTo
    // so if it's not aniamted we set it up here
    if (!isAnimated) {
        state.scroll = offset;

        checkFinishedScrollFallback(ctx);
    }
}
