import { checkFinishedScrollFallback } from "@/core/checkFinishedScroll";
import type { DoScrollToParams } from "@/core/doScrollParams";
import { initialScrollCompletion } from "@/core/initialScrollSession";
import { getContentSize } from "@/state/getContentSize";
import type { StateContext } from "@/state/state";
import { toNativeHorizontalOffset } from "@/utils/rtl";

export function doScrollTo(ctx: StateContext, params: DoScrollToParams) {
    const state = ctx.state;
    const { animated, horizontal, isInitialScroll, offset } = params;
    const isAnimated = !!animated;
    const { refScroller } = state;
    const scroller = refScroller.current;

    if (!scroller) {
        return;
    }

    const isHorizontal = !!horizontal;
    const contentSize = isHorizontal ? getContentSize(ctx) : undefined;
    const nativeOffset = toNativeHorizontalOffset(state, offset, contentSize);

    scroller.scrollTo({
        animated: isAnimated,
        x: isHorizontal ? nativeOffset : 0,
        y: isHorizontal ? 0 : offset,
    });
    if (isInitialScroll) {
        initialScrollCompletion.markInitialScrollNativeDispatch(state);
    }

    // If it's animated we can rely on onMomentumScrollEnd to call finishScrollTo
    // so if it's not aniamted we set it up here
    if (!isAnimated) {
        state.scroll = offset;

        checkFinishedScrollFallback(ctx);
    }
}
