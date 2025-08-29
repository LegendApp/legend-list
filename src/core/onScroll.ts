import { calculateItemsInView } from "@/core/calculateItemsInView";
import { Platform } from "@/platform/Platform";
import type { NativeScrollEvent, NativeSyntheticEvent } from "@/platform/platform-types";
import type { StateContext } from "@/state/state";
import type { InternalState } from "@/types";
import { checkAtBottom } from "@/utils/checkAtBottom";
import { checkAtTop } from "@/utils/checkAtTop";

export function onScroll(ctx: StateContext, state: InternalState, event: NativeSyntheticEvent<NativeScrollEvent>) {
    const {
        scrollProcessingEnabled,
        props: { onScroll: onScrollProp },
    } = state;
    if (scrollProcessingEnabled === false) {
        return;
    }

    if (event.nativeEvent?.contentSize?.height === 0 && event.nativeEvent.contentSize?.width === 0) {
        return;
    }

    const newScroll = event.nativeEvent.contentOffset[state.props.horizontal ? "x" : "y"];

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

    if (Platform.OS === "web") {
        if (!state.onScrollRafScheduled) {
            state.onScrollRafScheduled = true;
            requestAnimationFrame(() => {
                state.onScrollRafScheduled = false;
                updateScroll(ctx, state, newScroll);
            });
        }
    } else {
        updateScroll(ctx, state, newScroll);
    }

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

    if (Math.abs(state.scroll - state.scrollPrev) > 2) {
        // Use velocity to predict scroll position
        calculateItemsInView(ctx, state);
        checkAtBottom(ctx, state);
        checkAtTop(state);
    }
}
