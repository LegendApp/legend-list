import { checkFinishedScroll } from "@/core/checkFinishedScroll";
import { clampScrollOffset } from "@/core/clampScrollOffset";
import { initialScrollWatchdog } from "@/core/initialScrollSession";
import { scrollTo } from "@/core/scrollTo";
import { updateScroll } from "@/core/updateScroll";
import type { NativeScrollEvent, NativeSyntheticEvent } from "@/platform/platform-types";
import type { StateContext } from "@/state/state";

function trackInitialScrollNativeProgress(state: StateContext["state"], newScroll: number) {
    const initialNativeScrollWatchdog = initialScrollWatchdog.get(state);
    const didInitialScrollProgress =
        !!initialNativeScrollWatchdog &&
        initialScrollWatchdog.didObserveProgress(newScroll, initialNativeScrollWatchdog);

    if (didInitialScrollProgress) {
        initialScrollWatchdog.clear(state);
        return;
    }

    if (initialNativeScrollWatchdog) {
        state.hasScrolled = false;
        initialScrollWatchdog.set(state, {
            startScroll: initialNativeScrollWatchdog.startScroll,
            targetOffset: initialNativeScrollWatchdog.targetOffset,
        });
    }
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

    updateScroll(ctx, newScroll, insetChanged);
    trackInitialScrollNativeProgress(state, newScroll);

    if (state.scrollingTo) {
        checkFinishedScroll(ctx);
    }

    // Cast to any since platform-types is a subset of react-native's event type
    onScrollProp?.(event as any);
}
