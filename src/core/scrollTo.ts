import { calculateOffsetWithOffsetPosition } from "@/core/calculateOffsetWithOffsetPosition";
import { finishScrollTo } from "@/core/finishScrollTo";
import { Platform } from "@/platform/Platform";
import { getContentSize, listen$, peek$, type StateContext, set$ } from "@/state/state";
import type { InternalState, ScrollTarget } from "@/types";

export function scrollTo(ctx: StateContext, state: InternalState, params: ScrollTarget & { noScrollingTo?: boolean }) {
    const { noScrollingTo, ...scrollTarget } = params;
    const { animated, isInitialScroll, offset: scrollTargetOffset, precomputedWithViewOffset } = scrollTarget;
    const {
        refScroller,
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
        // Do the scroll
        refScroller.current?.scrollTo({
            animated: !!animated,
            x: horizontal ? offset : 0,
            y: horizontal ? 0 : offset,
        });
    }

    if (!animated) {
        state.scroll = offset;
        if (Platform.OS === "web") {
            const unlisten = listen$(ctx, "containersDidLayout", (value) => {
                if (value && peek$(ctx, "scrollingTo")) {
                    finishScrollTo(ctx, state);
                    unlisten();
                }
            });
        } else {
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
}
