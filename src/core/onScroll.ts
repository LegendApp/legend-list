import { checkFinishedScroll } from "@/core/checkFinishedScroll";
import { clampScrollOffset } from "@/core/clampScrollOffset";
import { scrollTo } from "@/core/scrollTo";
import { updateScroll } from "@/core/updateScroll";
import type { NativeScrollEvent, NativeSyntheticEvent } from "@/platform/platform-types";
import type { StateContext } from "@/state/state";

const INITIAL_SCROLL_PROGRESS_EPSILON = 1;

function didObserveInitialScrollProgress(
    newScroll: number,
    watchdog: NonNullable<StateContext["state"]["initialNativeScrollWatchdog"]>,
) {
    const previousDistance = Math.abs(watchdog.startScroll - watchdog.targetOffset);
    const nextDistance = Math.abs(newScroll - watchdog.targetOffset);
    return (
        nextDistance <= INITIAL_SCROLL_PROGRESS_EPSILON ||
        nextDistance + INITIAL_SCROLL_PROGRESS_EPSILON < previousDistance
    );
}

export function onScroll(ctx: StateContext, event: NativeSyntheticEvent<NativeScrollEvent>) {
    const state = ctx.state;
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

    let insetChanged = false;
    if (event.nativeEvent?.contentInset) {
        const { contentInset } = event.nativeEvent;
        const prevInset = state.nativeContentInset;
        if (
            !prevInset ||
            prevInset.top !== contentInset.top ||
            prevInset.bottom !== contentInset.bottom ||
            prevInset.left !== contentInset.left ||
            prevInset.right !== contentInset.right
        ) {
            state.nativeContentInset = contentInset;
            insetChanged = true;
        }
    }

    let newScroll = event.nativeEvent.contentOffset[state.props.horizontal ? "x" : "y"];

    if (state.scrollingTo && state.scrollingTo.offset >= newScroll) {
        const maxOffset = clampScrollOffset(ctx, newScroll, state.scrollingTo);
        if (newScroll !== maxOffset && Math.abs(newScroll - maxOffset) > 1) {
            // If the scroll is past the end for some reason, clamp it to the end
            newScroll = maxOffset;
            scrollTo(ctx, {
                forceScroll: true,
                isInitialScroll: true,
                noScrollingTo: true,
                offset: newScroll,
            });

            return;
        }
    }

    state.scrollPending = newScroll;

    const initialNativeScrollWatchdog = state.initialNativeScrollWatchdog;
    // Some native initial-scroll callbacks report the old offset before movement begins.
    // Keep the watchdog alive unless this event actually gets closer to the requested target.
    const didInitialScrollProgress =
        !!initialNativeScrollWatchdog && didObserveInitialScrollProgress(newScroll, initialNativeScrollWatchdog);
    if (didInitialScrollProgress) {
        state.initialNativeScrollWatchdog = undefined;
    }

    updateScroll(ctx, newScroll, insetChanged);

    if (initialNativeScrollWatchdog && !didInitialScrollProgress) {
        state.hasScrolled = false;
        state.initialNativeScrollWatchdog = initialNativeScrollWatchdog;
    }

    if (state.scrollingTo) {
        checkFinishedScroll(ctx);
    }

    // Cast to any since platform-types is a subset of react-native's event type
    onScrollProp?.(event as any);
}
