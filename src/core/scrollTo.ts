import { calculateOffsetWithOffsetPosition } from "@/core/calculateOffsetWithOffsetPosition";
import { finishScrollTo } from "@/core/finishScrollTo";
import { Platform } from "@/platform/Platform";
import { type StateContext, set$ } from "@/state/state";
import type { InternalState, ScrollTarget } from "@/types";

export function scrollTo(ctx: StateContext, state: InternalState, params: ScrollTarget & { noScrollingTo?: boolean }) {
    const { noScrollingTo, ...scrollTarget } = params;
    const { animated, isInitialScroll, offset: scrollTargetOffset } = scrollTarget;
    const {
        refScroller,
        props: { horizontal },
    } = state;

    const offset = calculateOffsetWithOffsetPosition(ctx, state, scrollTargetOffset, scrollTarget);

    // Disable scroll adjust while scrolling so that it doesn't do extra work affecting the target offset
    state.scrollHistory.length = 0;

    // noScrollingTo is used for the workaround in mvcp to fake it with scroll
    if (!noScrollingTo) {
        set$(ctx, "scrollingTo", scrollTarget);
    }
    state.scrollPending = offset;

    if (!isInitialScroll || Platform.OS === "android") {
        // Do the scroll
        refScroller.current?.scrollTo({
            animated: !!animated,
            x: horizontal ? offset : 0,
            y: horizontal ? 0 : offset,
        });
    }

    if (!animated) {
        state.scroll = offset;
        // TODO: Should this not be a timeout, and instead wait for all item layouts to settle?
        // It's used for mvcp for when items change size above scroll.
        setTimeout(() => finishScrollTo(ctx, state), 100);
        if (isInitialScroll) {
            setTimeout(() => {
                state.initialScroll = undefined;
            }, 500);
        }
    }
}
