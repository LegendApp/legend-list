import { checkFinishedScrollFallback } from "@/core/checkFinishedScroll";
import type { StateContext } from "@/state/state";

export interface DoScrollToParams {
    animated?: boolean;
    horizontal?: boolean;
    isInitialScroll?: boolean;
    offset: number;
}

export function doScrollTo(ctx: StateContext, params: DoScrollToParams) {
    const state = ctx.state;
    const { animated, horizontal, offset } = params;
    const { refScroller } = state;

    refScroller.current?.scrollTo({
        animated: !!animated,
        x: horizontal ? offset : 0,
        y: horizontal ? 0 : offset,
    });

    // If it's animated we can rely on onMomentumScrollEnd to call finishScrollTo
    // so if it's not aniamted we set it up here
    if (!animated) {
        state.scroll = offset;

        checkFinishedScrollFallback(ctx);
    }
}
