import { checkFinishedScrollFallback } from "@/core/checkFinishedScroll";
import { logInitialScrollTrace } from "@/core/logInitialScrollTrace";
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
    const isAnimated = !!animated;
    const { refScroller } = state;
    const scroller = refScroller.current;

    if (!scroller) {
        return;
    }

    logInitialScrollTrace(ctx, "doScrollTo:native", {
        animated: isAnimated,
        horizontal: !!horizontal,
        x: horizontal ? offset : 0,
        y: horizontal ? 0 : offset,
    });

    scroller.scrollTo({
        animated: isAnimated,
        x: horizontal ? offset : 0,
        y: horizontal ? 0 : offset,
    });

    // If it's animated we can rely on onMomentumScrollEnd to call finishScrollTo
    // so if it's not aniamted we set it up here
    if (!isAnimated) {
        state.scroll = offset;

        logInitialScrollTrace(ctx, "doScrollTo:native:fallback-armed", {
            offset,
        });
        checkFinishedScrollFallback(ctx);
    }
}
