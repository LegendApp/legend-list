import { updateScroll } from "@/core/updateScroll";
import { type StateContext, set$ } from "@/state/state";
import { getId } from "@/utils/getId";

export function maybeUpdateAnchoredEndSpace(ctx: StateContext) {
    const state = ctx.state;
    const anchoredEndSpace = state.props.anchoredEndSpace;
    const previousSize = state.anchoredEndSpaceSize;

    let nextSize = 0;

    if (anchoredEndSpace) {
        const { anchorIndex } = anchoredEndSpace;
        const { data } = state.props;

        if (anchorIndex >= 0 && anchorIndex < data.length && state.scrollLength > 0) {
            let contentBelowAnchor = 0;
            const footerSize = ctx.values.get("footerSize") || 0;
            const stylePaddingBottom = state.props.stylePaddingBottom || 0;

            for (let index = anchorIndex; index < data.length; index++) {
                const itemKey = getId(state, index);
                const size = itemKey ? state.sizesKnown.get(itemKey) : undefined;

                if (size !== null && size !== undefined && size > 0) {
                    contentBelowAnchor += size;
                }
            }

            contentBelowAnchor += footerSize + stylePaddingBottom;
            nextSize = Math.max(0, state.scrollLength - contentBelowAnchor);
        }
    }

    if (previousSize === nextSize) {
        return nextSize;
    }

    state.anchoredEndSpaceSize = nextSize;
    set$(ctx, "anchoredEndSpaceSize", nextSize);
    anchoredEndSpace?.onSizeChanged?.(nextSize);

    if (anchoredEndSpace?.includeInEndInset) {
        updateScroll(ctx, state.scroll, true);
    }

    return nextSize;
}
