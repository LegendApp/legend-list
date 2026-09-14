import { updateContentMetricsState } from "@/core/updateContentMetricsState";
import { updateScroll } from "@/core/updateScroll";
import { peek$, type StateContext, set$ } from "@/state/state";
import { getId } from "@/utils/getId";
import { getKnownOrFixedItemSize } from "@/utils/getItemSize";
import { getStylePaddingEnd } from "@/utils/rtl";

export function maybeUpdateAnchoredEndSpace(ctx: StateContext) {
    const state = ctx.state;
    const anchoredEndSpace = state.props.anchoredEndSpace;
    const previousSize = peek$(ctx, "anchoredEndSpaceSize");
    const previousReadyAnchorIndex = state.anchoredEndSpaceReadyAnchorIndex;
    const previousReadyAnchorKey = state.anchoredEndSpaceReadyAnchorKey;
    const nextAnchorIndex = anchoredEndSpace?.anchorIndex;
    let nextAnchorKey: string | undefined;
    let isReady = true;
    let canUpdateSize = true;

    let nextSize = 0;

    if (anchoredEndSpace) {
        const { anchorIndex, anchorMaxSize, anchorOffset = 0 } = anchoredEndSpace;
        const { data } = state.props;

        if (anchorIndex >= 0 && anchorIndex < data.length && state.scrollLength > 0) {
            nextAnchorKey = getId(state, anchorIndex);
            let contentBelowAnchor = 0;
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

            contentBelowAnchor = Math.max(0, contentBelowAnchor - ctx.scrollAxisGap);
            contentBelowAnchor += (ctx.values.get("footerSize") || 0) + getStylePaddingEnd(state.props);
            // Ready means we've processed this valid anchor and all tail items that affect
            // anchored end-space math have authoritative sizes.
            isReady = !hasUnknownTailSize;
            const knownSizeBound = Math.max(0, state.scrollLength - contentBelowAnchor - anchorOffset);
            // Unknown rows can only consume more of the viewport, so known rows provide an upper bound.
            // Shrink stale space to that bound, but do not grow it until every tail size is authoritative.
            nextSize = hasUnknownTailSize ? Math.min(previousSize || 0, knownSizeBound) : knownSizeBound;
        } else if (anchorIndex >= 0) {
            isReady = false;
            canUpdateSize = false;
        }
    }

    const didSizeChange = previousSize !== nextSize && (previousSize !== undefined || anchoredEndSpace !== undefined);
    const didEffectiveSizeChange = (previousSize || 0) !== nextSize;
    const canApplySizeChange = canUpdateSize && (isReady || previousSize !== undefined);
    const didReadyAnchorChange =
        previousReadyAnchorIndex !== nextAnchorIndex || previousReadyAnchorKey !== nextAnchorKey;
    // Provisional space can already equal the final size. Track readiness independently
    // so the last measurement still notifies the caller, without repeating on settled passes.
    const didBecomeReady = isReady && state.anchoredEndSpacePendingReady;
    state.anchoredEndSpacePendingReady = !isReady;

    if (canApplySizeChange && didSizeChange) {
        set$(ctx, "anchoredEndSpaceSize", nextSize);
        anchoredEndSpace?.onSizeChanged?.(nextSize);
    }

    if (canApplySizeChange && didEffectiveSizeChange) {
        updateContentMetricsState(ctx);
        updateScroll(ctx, state.scroll, true, { markHasScrolled: false });
    }

    if (isReady && (didSizeChange || didReadyAnchorChange || didBecomeReady)) {
        state.anchoredEndSpaceReadyAnchorIndex = nextAnchorIndex;
        state.anchoredEndSpaceReadyAnchorKey = nextAnchorKey;

        anchoredEndSpace?.onReady?.({ anchorIndex: nextAnchorIndex, anchorKey: nextAnchorKey, size: nextSize });
    }

    return nextSize;
}
