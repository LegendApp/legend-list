import { scrollTo } from "@/core/scrollTo";
import type { StateContext } from "@/state/state";
import type { ScrollIndexWithOffsetAndContentOffset } from "@/types.base";
import { getId } from "@/utils/getId";
import { getItemSize } from "@/utils/getItemSize";

export function performInitialScroll(
    ctx: StateContext,
    params: {
        forceScroll: boolean;
        initialScrollUsesOffset: boolean;
        resolvedOffset?: number;
        target: ScrollIndexWithOffsetAndContentOffset;
        waitForCompletionFrame?: boolean;
    },
) {
    const { forceScroll, initialScrollUsesOffset, resolvedOffset, target, waitForCompletionFrame } = params;
    const offset = resolvedOffset ?? target.contentOffset;
    const index = initialScrollUsesOffset ? undefined : target.index;

    if (offset === undefined) {
        return;
    }

    const itemSize =
        index !== undefined ? getItemSize(ctx, getId(ctx.state, index), index, ctx.state.props.data[index]) : undefined;

    scrollTo(ctx, {
        animated: false,
        forceScroll,
        index,
        isInitialScroll: true,
        itemSize,
        offset,
        precomputedWithViewOffset: resolvedOffset !== undefined,
        viewOffset: target.viewOffset,
        viewPosition: target.viewPosition,
        waitForInitialScrollCompletionFrame: waitForCompletionFrame,
    });
}
