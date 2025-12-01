import { finishScrollTo } from "@/core/finishScrollTo";
import { Platform } from "@/platform/Platform";
import { listen$, peek$, type StateContext } from "@/state/state";
import type { InternalState } from "@/types";

export interface DoScrollToParams {
    animated?: boolean;
    horizontal?: boolean;
    isInitialScroll?: boolean;
    offset: number;
}

export function doScrollTo(ctx: StateContext, state: InternalState, params: DoScrollToParams) {
    const { animated, horizontal, isInitialScroll, offset } = params;
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

        // TODO: Should this not be a timeout, and instead wait for all item layouts to settle?
        // It's used for mvcp for when items change size above scroll.
        const slowTimeout = isInitialScroll || !peek$(ctx, "containersDidLayout");

        setTimeout(
            () => {
                let numChecks = 0;
                const checkHasScrolled = () => {
                    numChecks++;
                    if (state.hasScrolled || numChecks > 5) {
                        finishScrollTo(ctx, state);
                    } else {
                        setTimeout(checkHasScrolled, 100);
                    }
                };
                checkHasScrolled();
            },
            slowTimeout ? 500 : 100,
        );
    }
}
