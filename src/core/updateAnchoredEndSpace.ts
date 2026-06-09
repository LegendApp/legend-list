import { updateScroll } from "@/core/updateScroll";
import { peek$, type StateContext, set$ } from "@/state/state";
import { getId } from "@/utils/getId";
import { getKnownOrFixedItemSize } from "@/utils/getItemSize";

export function maybeUpdateAnchoredEndSpace(ctx: StateContext) {
    const state = ctx.state;
    const anchoredEndSpace = state.props.anchoredEndSpace;
    const previousSize = peek$(ctx, "anchoredEndSpaceSize");
    const previousReadyAnchorIndex = state.anchoredEndSpaceReadyAnchorIndex;
    const previousReadyAnchorKey = state.anchoredEndSpaceReadyAnchorKey;
    const nextAnchorIndex = anchoredEndSpace?.anchorIndex;
    let nextAnchorKey: string | undefined;
    let isReady = true;

    let nextSize = 0;

    if (anchoredEndSpace) {
        const { anchorIndex, anchorMaxSize, anchorOffset = 0 } = anchoredEndSpace;
        const { data } = state.props;

        if (anchorIndex >= 0 && anchorIndex < data.length && state.scrollLength > 0) {
            nextAnchorKey = getId(state, anchorIndex);
            let contentBelowAnchor = 0;
            const footerSize = ctx.values.get("footerSize") || 0;
            const stylePaddingBottom = state.props.stylePaddingBottom || 0;
            let hasUnknownTailSize = false;

            for (let index = anchorIndex; index < data.length; index++) {
                const size = getKnownOrFixedItemSize(ctx, index);
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
            // Ready means we've processed this valid anchor and all tail items that affect
            // anchored end-space math have authoritative sizes.
            isReady = !hasUnknownTailSize;
            nextSize = hasUnknownTailSize
                ? previousSize || 0
                : Math.max(0, state.scrollLength - contentBelowAnchor - anchorOffset);
        } else if (anchorIndex >= 0) {
            isReady = false;
        }
    }

    const didSizeChange = previousSize !== nextSize;
    const didReadyAnchorChange =
        previousReadyAnchorIndex !== nextAnchorIndex || previousReadyAnchorKey !== nextAnchorKey;

    if (isReady && (didSizeChange || didReadyAnchorChange)) {
        state.anchoredEndSpaceReadyAnchorIndex = nextAnchorIndex;
        state.anchoredEndSpaceReadyAnchorKey = nextAnchorKey;

        if (didSizeChange) {
            set$(ctx, "anchoredEndSpaceSize", nextSize);
            anchoredEndSpace?.onSizeChanged?.(nextSize);
        }

        if (didSizeChange && anchoredEndSpace?.includeInEndInset) {
            updateScroll(ctx, state.scroll, true);
        }

        anchoredEndSpace?.onReady?.({ anchorIndex: nextAnchorIndex, anchorKey: nextAnchorKey, size: nextSize });
    }

    return nextSize;
}
