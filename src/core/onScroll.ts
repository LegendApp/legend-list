import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";

import { checkFinishedScroll } from "@/core/checkFinishedScroll";
import { clampScrollOffset } from "@/core/clampScrollOffset";
import { scrollTo } from "@/core/scrollTo";
import { updateScroll } from "@/core/updateScroll";
import type { StateContext } from "@/state/state";

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

    let newScroll = event.nativeEvent.contentOffset[state.props.horizontal ? "x" : "y"];

    if (state.scrollingTo) {
        const maxOffset = clampScrollOffset(ctx, newScroll);
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

    updateScroll(ctx, newScroll);

    if (state.scrollingTo) {
        checkFinishedScroll(ctx);
    }

    onScrollProp?.(event as NativeSyntheticEvent<NativeScrollEvent>);
}
