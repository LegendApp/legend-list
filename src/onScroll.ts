import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import { calculateItemsInView } from "./calculateItemsInView";
import { checkAtBottom } from "./checkAtBottom";
import { checkAtTop } from "./checkAtTop";
import type { StateContext } from "./state";
import type { InternalState } from "./types";

export function onScroll(
    ctx: StateContext,
    state: InternalState,
    event: {
        nativeEvent: NativeScrollEvent;
    },
) {
    if (event.nativeEvent?.contentSize?.height === 0 && event.nativeEvent.contentSize?.width === 0) {
        return;
    }

    const newScroll = event.nativeEvent.contentOffset[state.props.horizontal ? "x" : "y"];

    // console.log("newScroll", Math.round(newScroll));

    // Ignore scroll events that are too close to the previous scroll position
    // after adjusting for MVCP
    const ignoreScrollFromMVCP = state.ignoreScrollFromMVCP;
    if (ignoreScrollFromMVCP && !state.scrollingTo) {
        const { lt, gt } = ignoreScrollFromMVCP;
        if ((lt && newScroll < lt) || (gt && newScroll > gt)) {
            // console.log("skip", newScroll, lt, gt);
            return;
        }
    }

    state.scrollPending = newScroll;

    updateScroll(ctx, state, newScroll);

    state.props.onScroll?.(event as NativeSyntheticEvent<NativeScrollEvent>);
}

function updateScroll(ctx: StateContext, state: InternalState, newScroll: number) {
    const scrollingTo = state.scrollingTo;

    state.hasScrolled = true;
    state.lastBatchingAction = Date.now();
    const currentTime = performance.now();

    // Don't add to the history if it's initial scroll event otherwise invalid velocity will be calculated
    // Don't add to the history if we are scrolling to an offset
    if (scrollingTo === undefined && !(state.scrollHistory.length === 0 && newScroll === state.scroll)) {
        // Update scroll history
        state.scrollHistory.push({ scroll: newScroll, time: currentTime });
    }

    // Keep only last 5 entries
    if (state.scrollHistory.length > 5) {
        state.scrollHistory.shift();
    }

    // Update current scroll state
    state.scrollPrev = state.scroll;
    state.scrollPrevTime = state.scrollTime;
    state.scroll = newScroll;
    state.scrollTime = currentTime;
    // Use velocity to predict scroll position
    calculateItemsInView(ctx, state);
    checkAtBottom(ctx, state);
    checkAtTop(state);
}
