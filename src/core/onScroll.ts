import { checkFinishedScroll } from "@/core/checkFinishedScroll";
import { clampScrollOffset } from "@/core/clampScrollOffset";
import { logInitialScrollTrace } from "@/core/logInitialScrollTrace";
import { scrollTo } from "@/core/scrollTo";
import { updateScroll } from "@/core/updateScroll";
import type { NativeScrollEvent, NativeSyntheticEvent } from "@/platform/platform-types";
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

    let insetChanged = false;
    let nextInset:
        | {
              bottom: number;
              left: number;
              right: number;
              top: number;
          }
        | undefined;
    const previousInset = state.nativeContentInset
        ? {
              bottom: state.nativeContentInset.bottom,
              left: state.nativeContentInset.left,
              right: state.nativeContentInset.right,
              top: state.nativeContentInset.top,
          }
        : undefined;
    if (event.nativeEvent?.contentInset) {
        const { contentInset } = event.nativeEvent;
        nextInset = {
            bottom: contentInset.bottom,
            left: contentInset.left,
            right: contentInset.right,
            top: contentInset.top,
        };
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
            logInitialScrollTrace(ctx, "onScroll:clamp", {
                maxOffset,
                newScroll,
            });
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

    logInitialScrollTrace(ctx, "onScroll", {
        insetChanged,
        layoutMeasurement: event.nativeEvent.layoutMeasurement,
        newScroll,
        nextInset,
        previousInset,
        rawContentOffset: event.nativeEvent.contentOffset,
        rawContentSize: event.nativeEvent.contentSize,
    });

    if (state.scrollingTo) {
        checkFinishedScroll(ctx);
    }

    // Cast to any since platform-types is a subset of react-native's event type
    onScrollProp?.(event as any);
}
