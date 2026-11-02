import { Platform } from "@/platform/Platform";
import { getHorizontalInsetEnd, isHorizontalRTL } from "@/utils/rtl";
import { peek$, type StateContext } from "./state";

function getContentInsetEndAdjustmentEnd(adjustment?: number) {
    return Math.max(0, adjustment ?? 0);
}

export function getContentInsetEnd(ctx: StateContext, contentInsetEndAdjustmentOverride?: number) {
    const state = ctx.state;
    const { props } = state;

    const horizontal = props.horizontal;
    // Only iOS applies the contentInset prop natively; Android and web scroll
    // views ignore it. Counting it there would reserve end distance the native
    // scroll range never has, so those platforms keep the reported inset.
    const contentInset = Platform.OS === "ios" ? props.contentInset : undefined;
    const baseInset = contentInset ?? state.nativeContentInset;
    const contentInsetEndAdjustment = getContentInsetEndAdjustmentEnd(
        contentInsetEndAdjustmentOverride ?? props.contentInsetEndAdjustment,
    );
    const anchoredEndSpaceSize = peek$(ctx, "anchoredEndSpaceSize");
    const anchoredEndInset = props.anchoredEndSpace && anchoredEndSpaceSize ? anchoredEndSpaceSize : 0;

    const overrideInset = state.contentInsetOverride ?? undefined;
    const mergedInset = overrideInset
        ? { bottom: 0, left: 0, right: 0, top: 0, ...baseInset, ...overrideInset }
        : baseInset;
    const endInset =
        ((horizontal ? getHorizontalInsetEnd(state, mergedInset) : mergedInset?.bottom) || 0) +
        contentInsetEndAdjustment;
    // List-owned space is padding in addition to UIKit's inset. Web's spacer and
    // scroll-view-owned insets already include that space. Native RTL retains
    // its overlapping inset convention for scroll-coordinate conversion.
    return Platform.OS !== "web" && props.anchoredEndSpaceOwner === "list" && !isHorizontalRTL(state)
        ? endInset + anchoredEndInset
        : Math.max(endInset, anchoredEndInset);
}
