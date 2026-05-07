import { peek$, type StateContext } from "./state";

function getContentInsetEndAdjustmentEnd(adjustment?: number) {
    return Math.max(0, adjustment ?? 0);
}

export function getContentInsetEnd(ctx: StateContext, contentInsetEndAdjustmentOverride?: number) {
    const state = ctx.state;
    const { props } = state;

    const horizontal = props.horizontal;
    const contentInset = props.contentInset;
    const baseInset = contentInset ?? state.nativeContentInset;
    const baseEndInset = (horizontal ? baseInset?.right : baseInset?.bottom) || 0;
    const contentInsetEndAdjustment = getContentInsetEndAdjustmentEnd(
        contentInsetEndAdjustmentOverride ?? props.contentInsetEndAdjustment,
    );
    const anchoredEndSpaceSize = peek$(ctx, "anchoredEndSpaceSize");
    const anchoredEndInset =
        props.anchoredEndSpace?.includeInEndInset && anchoredEndSpaceSize ? anchoredEndSpaceSize : 0;

    const overrideInset = state.contentInsetOverride ?? undefined;
    const adjustedBaseEndInset = baseEndInset + contentInsetEndAdjustment;
    if (overrideInset) {
        const mergedInset = { bottom: 0, left: 0, right: 0, top: 0, ...baseInset, ...overrideInset };
        return Math.max(
            ((horizontal ? mergedInset.right : mergedInset.bottom) || 0) + contentInsetEndAdjustment,
            anchoredEndInset,
        );
    }

    return Math.max(adjustedBaseEndInset, anchoredEndInset);
}
