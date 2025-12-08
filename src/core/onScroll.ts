import { clampScrollOffset } from "@/core/clampScrollOffset";
import { scrollTo } from "@/core/scrollTo";
import { updateScroll } from "@/core/updateScroll";
import type { NativeScrollEvent, NativeSyntheticEvent } from "@/platform/platform-types";
import type { StateContext } from "@/state/state";

export function onScroll(ctx: StateContext, event: NativeSyntheticEvent<NativeScrollEvent>) {
    const state = ctx.state!;
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
        const maxOffset = clampScrollOffset(ctx, newScroll);
        if (newScroll !== maxOffset) {
            // If the scroll is past the end for some reason, clamp it to the end
            newScroll = maxOffset;
            scrollTo(ctx, {
                noScrollingTo: true,
                offset: newScroll,
            });
        }
    }

    updateScroll(ctx, newScroll);

    onScrollProp?.(event as NativeSyntheticEvent<NativeScrollEvent>);
}
