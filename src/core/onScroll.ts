import { checkFinishedScroll } from "@/core/checkFinishedScroll";
import { clampScrollOffset } from "@/core/clampScrollOffset";
import { scrollTo } from "@/core/scrollTo";
import { updateScroll } from "@/core/updateScroll";
import { Platform } from "@/platform/Platform";
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

    if (state.scrollingTo) {
        const maxOffset = clampScrollOffset(ctx, newScroll, state.scrollingTo);
        const targetOffset = state.scrollingTo.targetOffset ?? state.scrollingTo.offset;
        const previousPendingScroll = state.scrollPending;
        const targetEpsilon = 1;
        const didCrossPastTarget =
            (previousPendingScroll <= targetOffset + targetEpsilon && newScroll > targetOffset + targetEpsilon) ||
            (previousPendingScroll >= targetOffset - targetEpsilon && newScroll < targetOffset - targetEpsilon);
        const didOverscrollContentEnd = Math.abs(newScroll - maxOffset) > targetEpsilon;

        if (didCrossPastTarget || didOverscrollContentEnd) {
            newScroll = didCrossPastTarget ? clampScrollOffset(ctx, targetOffset, state.scrollingTo) : maxOffset;

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

    const shouldDeferFinishCheckForAndroidInitial =
        !!state.scrollingTo?.isInitialScroll &&
        !state.pendingCorrectiveInitialClamp &&
        !state.scrollingTo.animated &&
        Platform.OS === "android" &&
        Math.abs(newScroll - (state.scrollingTo.targetOffset ?? state.scrollingTo.offset)) <= 1;

    if (state.scrollingTo && !shouldDeferFinishCheckForAndroidInitial) {
        checkFinishedScroll(ctx);
    }

    // Cast to any since platform-types is a subset of react-native's event type
    onScrollProp?.(event as any);
}
