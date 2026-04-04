import { scrollTo } from "@/core/scrollTo";
import { clampScrollIndex, getScrollIndexItemSize } from "@/core/scrollToIndex";
import type { StateContext } from "@/state/state";

type InternalInitialScrollTarget = NonNullable<StateContext["state"]["initialScroll"]>;

export function performInitialScroll(
    ctx: StateContext,
    params: {
        forceScroll: boolean;
        initialScrollUsesOffset: boolean;
        resolvedOffset: number;
        target: InternalInitialScrollTarget;
        waitForCompletionFrame?: boolean;
    },
) {
    const { forceScroll, initialScrollUsesOffset, resolvedOffset, target, waitForCompletionFrame } = params;
    const requestedIndex = initialScrollUsesOffset ? undefined : target.index;
    const index =
        requestedIndex !== undefined ? clampScrollIndex(requestedIndex, ctx.state.props.data.length) : undefined;
    const itemSize = getScrollIndexItemSize(ctx, index);

    scrollTo(ctx, {
        animated: false,
        forceScroll,
        index: index !== undefined && index >= 0 ? index : undefined,
        isInitialScroll: true,
        itemSize,
        offset: resolvedOffset,
        precomputedWithViewOffset: true,
        viewOffset: target.viewOffset,
        viewPosition: target.viewPosition,
        waitForInitialScrollCompletionFrame: waitForCompletionFrame,
    });
}
