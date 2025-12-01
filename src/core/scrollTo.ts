import { calculateOffsetWithOffsetPosition } from "@/core/calculateOffsetWithOffsetPosition";
import { doScrollTo } from "@/core/doScrollTo";
import { Platform } from "@/platform/Platform";
import { getContentSize, type StateContext, set$ } from "@/state/state";
import type { InternalState, ScrollTarget } from "@/types";

export function scrollTo(ctx: StateContext, state: InternalState, params: ScrollTarget & { noScrollingTo?: boolean }) {
    const { noScrollingTo, ...scrollTarget } = params;
    const { animated, isInitialScroll, offset: scrollTargetOffset, precomputedWithViewOffset } = scrollTarget;
    const {
        props: { horizontal },
    } = state;

    let offset = precomputedWithViewOffset
        ? scrollTargetOffset
        : calculateOffsetWithOffsetPosition(ctx, state, scrollTargetOffset, scrollTarget);

    if (Number.isFinite(state.scrollLength) && Number.isFinite(state.totalSize)) {
        const maxOffset = Math.max(0, getContentSize(ctx) - state.scrollLength);
        offset = Math.min(offset, maxOffset);
    }

    // Disable scroll adjust while scrolling so that it doesn't do extra work affecting the target offset
    state.scrollHistory.length = 0;

    // noScrollingTo is used for the workaround in mvcp to fake it with scroll
    if (!noScrollingTo) {
        set$(ctx, "scrollingTo", scrollTarget);
    }
    state.scrollPending = offset;

    if (!isInitialScroll || Platform.OS === "android") {
        doScrollTo(ctx, state, { animated, horizontal, isInitialScroll, offset });
    } else {
        state.scroll = offset;
    }
}
