import { Platform } from "@/platform/Platform";
import { getContentSize } from "@/state/getContentSize";
import type { StateContext } from "@/state/state";
import type { ScrollTarget } from "@/types.internal";

const ANDROID_SHRINK_CLAMP_EPSILON = 0.1;

export function getContentInsetTop(ctx: StateContext) {
    const state = ctx.state;
    if (Platform.OS !== "ios" || state.props.horizontal) {
        return 0;
    }
    const baseInset = state.props.contentInset ?? state.nativeContentInset;
    return Math.max(0, state.contentInsetOverride?.top ?? baseInset?.top ?? 0);
}

export function getScrollRangeEnd(ctx: StateContext, contentSize = getContentSize(ctx)) {
    return Math.max(0 - getContentInsetTop(ctx), contentSize - ctx.state.scrollLength);
}

/**
 * Android clamps the scroll offset when content shrinks, before native MVCP applies an anchor move. Syncs the JS
 * scroll state to that clamp and returns the part of the adjustment the clamp did not already apply.
 */
export function getAdjustAfterAndroidShrinkClamp(ctx: StateContext, positionDiff: number) {
    const state = ctx.state;
    if (Platform.OS !== "android") {
        return positionDiff;
    }

    const maxScroll = getScrollRangeEnd(ctx);
    if (state.scroll <= maxScroll + ANDROID_SHRINK_CLAMP_EPSILON) {
        return positionDiff;
    }

    const targetScroll = Math.max(0, Math.min(state.scroll + positionDiff, maxScroll));
    state.scroll = maxScroll;
    state.scrollPending = maxScroll;
    return targetScroll - maxScroll;
}

export function clampScrollOffset(ctx: StateContext, offset: number, scrollTarget?: Partial<ScrollTarget>) {
    const state = ctx.state;
    const minOffset = 0 - getContentInsetTop(ctx);
    const contentSize = getContentSize(ctx, !scrollTarget || !!scrollTarget.clampToContentContainerMinSize);
    let clampedOffset = offset;
    if (
        Number.isFinite(contentSize) &&
        Number.isFinite(state.scrollLength) &&
        (Platform.OS !== "android" || state.lastLayout)
    ) {
        const baseMaxOffset = getScrollRangeEnd(ctx, contentSize);
        // Web initial placement must finish at the reachable content extent.
        const viewOffset =
            Platform.OS === "web" && scrollTarget?.isInitialScroll ? undefined : scrollTarget?.viewOffset;
        const extraEndOffset = typeof viewOffset === "number" && viewOffset < 0 ? -viewOffset : 0;
        // Absolute offsets retain native zero even when short inset content rests below it.
        const isRawOffset =
            scrollTarget?.offset !== undefined &&
            (scrollTarget.index === undefined ||
                (scrollTarget.isInitialScroll && state.initialScrollSession?.kind === "offset"));
        const maxOffset = Math.max(isRawOffset ? 0 : minOffset, baseMaxOffset + extraEndOffset);
        clampedOffset = Math.min(offset, maxOffset);
    }
    return Math.max(minOffset, clampedOffset);
}
