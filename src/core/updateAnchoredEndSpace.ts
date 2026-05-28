import { updateScroll } from "@/core/updateScroll";
import { peek$, type StateContext, set$ } from "@/state/state";
import { getId } from "@/utils/getId";

export function maybeUpdateAnchoredEndSpace(ctx: StateContext) {
    const state = ctx.state;
    const anchoredEndSpace = state.props.anchoredEndSpace;
    const previousSize = peek$(ctx, "anchoredEndSpaceSize");
    const previousAnchorIndex = state.anchoredEndSpaceAnchorIndex;
    const nextAnchorIndex = anchoredEndSpace?.anchorIndex;

    let nextSize = 0;

    if (anchoredEndSpace) {
        const { anchorIndex, anchorMaxSize, anchorOffset = 0 } = anchoredEndSpace;
        const { data } = state.props;

        if (anchorIndex >= 0 && anchorIndex < data.length && state.scrollLength > 0) {
            let contentBelowAnchor = 0;
            const footerSize = ctx.values.get("footerSize") || 0;
            const stylePaddingBottom = state.props.stylePaddingBottom || 0;
            let hasUnknownTailSize = false;

            for (let index = anchorIndex; index < data.length; index++) {
                const itemKey = getId(state, index);
                const size = itemKey ? state.sizesKnown.get(itemKey) : undefined;
                const effectiveSize =
                    index === anchorIndex && anchorMaxSize !== undefined
                        ? Math.min(size || 0, Math.max(0, anchorMaxSize))
                        : size;

                if (size === undefined) {
                    hasUnknownTailSize = true;
                }

                if (effectiveSize !== null && effectiveSize !== undefined && effectiveSize > 0) {
                    contentBelowAnchor += effectiveSize;
                }
            }

            contentBelowAnchor += footerSize + stylePaddingBottom;
            nextSize = hasUnknownTailSize
                ? previousSize || 0
                : Math.max(0, state.scrollLength - contentBelowAnchor - anchorOffset);
        }
    }

    if (previousSize !== nextSize || previousAnchorIndex !== nextAnchorIndex) {
        state.anchoredEndSpaceAnchorIndex = nextAnchorIndex;

        if (previousSize !== nextSize) {
            set$(ctx, "anchoredEndSpaceSize", nextSize);
            anchoredEndSpace?.onSizeChanged?.(nextSize);
        }

        if (previousSize !== nextSize && anchoredEndSpace?.includeInEndInset) {
            updateScroll(ctx, state.scroll, true);
        }

        anchoredEndSpace?.onCommit?.(nextSize);
    }

    return nextSize;
}
