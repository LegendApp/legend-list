import { scrollToIndex } from "@/core/scrollToIndex";
import { peek$, type StateContext } from "@/state/state";
import type { ScrollToEndOptions } from "@/types.base";
import { getStylePaddingEnd } from "@/utils/rtl";

export function scrollToEnd(ctx: StateContext, options?: ScrollToEndOptions) {
    const state = ctx.state;
    const data = state.props.data;
    const index = data.length - 1;
    if (index === -1) {
        return false;
    }

    const paddingBottom = getStylePaddingEnd(state.props);
    const footerSize = peek$(ctx, "footerSize") || 0;
    scrollToIndex(ctx, {
        ...options,
        index,
        viewOffset: -paddingBottom - footerSize + (options?.viewOffset || 0),
        viewPosition: 1,
    });
    if (state.scrollingTo) {
        state.scrollingTo.isScrollToEnd = true;
    }
    return true;
}
