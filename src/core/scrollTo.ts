import { Platform } from "react-native";

import { calculateOffsetWithOffsetPosition } from "@/core/calculateOffsetWithOffsetPosition";
import { finishScrollTo } from "@/core/finishScrollTo";
import type { InternalState } from "@/types";

export function scrollTo(
    state: InternalState,
    params: {
        animated?: boolean;
        index?: number;
        offset: number;
        viewOffset?: number;
        viewPosition?: number;
        noScrollingTo?: boolean;
        isInitialScroll?: boolean;
    } = {} as any,
) {
    const { animated, noScrollingTo, isInitialScroll } = params;
    const {
        refScroller,
        props: { horizontal },
    } = state;

    const offset = calculateOffsetWithOffsetPosition(state, params.offset, params);

    // Disable scroll adjust while scrolling so that it doesn't do extra work affecting the target offset
    state.scrollHistory.length = 0;

    // noScrollingTo is used for the workaround in mvcp to fake it with scroll
    if (!noScrollingTo) {
        state.scrollingTo = params;
    }
    state.scrollPending = offset;

    if (!params.isInitialScroll || Platform.OS === "android") {
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
        setTimeout(() => finishScrollTo(state), 100);
        if (isInitialScroll) {
            setTimeout(() => {
                state.initialScroll = undefined;
            }, 500);
        }
    }
}
