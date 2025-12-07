import { clampScrollOffset } from "@/core/clampScrollOffset";
import { scrollTo } from "@/core/scrollTo";
import { updateScroll } from "@/core/updateScroll";
import type { NativeScrollEvent, NativeSyntheticEvent } from "@/platform/platform-types";
import type { StateContext } from "@/state/state";
import type { InternalState } from "@/types";

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

    let newScroll = event.nativeEvent.contentOffset[state.props.horizontal ? "x" : "y"];
    state.scrollPending = newScroll;

    if (state.initialScroll) {
        const maxOffset = clampScrollOffset(ctx, state, newScroll);
        if (newScroll !== maxOffset) {
            // If the scroll is past the end for some reason, clamp it to the end
            newScroll = maxOffset;
            scrollTo(ctx, state, {
                noScrollingTo: true,
                offset: newScroll,
            });
        }
    }

    updateScroll(ctx, state, newScroll);

    onScrollProp?.(event as NativeSyntheticEvent<NativeScrollEvent>);
}
