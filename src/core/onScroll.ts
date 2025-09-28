import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";

import { calculateItemsInView } from "@/core/calculateItemsInView";
import type { StateContext } from "@/state/state";
import type { InternalState } from "@/types";
import { checkAtBottom } from "@/utils/checkAtBottom";
import { checkAtTop } from "@/utils/checkAtTop";

export function onScroll(ctx: StateContext, state: InternalState, event: NativeSyntheticEvent<NativeScrollEvent>) {
    const {
        scrollProcessingEnabled,
        props: { onScroll: onScrollProp },
    } = state;

    const newScroll = event.nativeEvent.contentOffset[state.props.horizontal ? "x" : "y"];
    console.log("onScroll", Math.round(newScroll), scrollProcessingEnabled, state.scrollingTo);
    if (scrollProcessingEnabled === false) {
        return;
    }

    if (event.nativeEvent?.contentSize?.height === 0 && event.nativeEvent.contentSize?.width === 0) {
        return;
    }

    // if (state.scrollingTo && newScroll !== state.scrollingTo.offset) {
    //     state.refScroller.current?.scrollTo({
    //         animated: false,
    //         x: state.props.horizontal ? state.scrollingTo.offset : 0,
    //         y: state.props.horizontal ? 0 : state.scrollingTo.offset,
    //     });
    // }

    // Ignore scroll events that are too close to the previous scroll position
    // after adjusting for MVCP
    const ignoreScrollFromMVCP = state.ignoreScrollFromMVCP;
    if (ignoreScrollFromMVCP && !state.scrollingTo) {
        const { lt, gt } = ignoreScrollFromMVCP;
        if ((lt && newScroll < lt) || (gt && newScroll > gt)) {
            return;
        }
    }

    state.scrollPending = newScroll;

    updateScroll(ctx, state, newScroll);

    onScrollProp?.(event as NativeSyntheticEvent<NativeScrollEvent>);
}

function updateScroll(ctx: StateContext, state: InternalState, newScroll: number) {
    const scrollingTo = state.scrollingTo;

    state.hasScrolled = true;
    state.lastBatchingAction = Date.now();
    const currentTime = Date.now();

    // Don't add to the history if it's initial scroll event otherwise invalid velocity will be calculated
    // Don't add to the history if we are scrolling to an offset
    if (scrollingTo === undefined && !(state.scrollHistory.length === 0 && newScroll === state.scroll)) {
        // Update scroll history
        const adjust = state.scrollAdjustHandler.getAdjust();
        state.scrollHistory.push({ scroll: newScroll - adjust, time: currentTime });
    }

    // Keep only last 5 entries
    if (state.scrollHistory.length > 5) {
        state.scrollHistory.shift();
    }

    console.log(Math.round(performance.now()), "updateScroll", Math.round(newScroll), Math.round(state.scroll));

    // Update current scroll state
    state.scrollPrev = state.scroll;
    state.scrollPrevTime = state.scrollTime;
    state.scroll = newScroll;
    state.scrollTime = currentTime;

    if (state.dataChangeNeedsScrollUpdate || Math.abs(state.scroll - state.scrollPrev) > 2) {
        // Use velocity to predict scroll position
        calculateItemsInView(ctx, state);
        checkAtBottom(ctx, state);
        checkAtTop(state);

        state.dataChangeNeedsScrollUpdate = false;
    }
}
