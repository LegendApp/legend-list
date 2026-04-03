import { scrollTo } from "@/core/scrollTo";
import { clampScrollIndex } from "@/core/scrollToIndex";
import type { StateContext } from "@/state/state";
import type { InternalInitialScrollTarget } from "@/types.base";
import { getId } from "@/utils/getId";
import { getItemSize } from "@/utils/getItemSize";

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
    const itemSize =
        index !== undefined && index >= 0
            ? getItemSize(ctx, getId(ctx.state, index), index, ctx.state.props.data[index])
            : undefined;

    scrollTo(ctx, {
        animated: false,
        forceScroll,
        index: index !== undefined && index >= 0 ? index : undefined,
        isInitialScroll: true,
        itemSize,
        offset: resolvedOffset,
        preserveInitialScrollTarget: !!target.preserveForFooterLayout,
        precomputedWithViewOffset: true,
        viewOffset: target.viewOffset,
        viewPosition: target.viewPosition,
        waitForInitialScrollCompletionFrame: waitForCompletionFrame,
    });
}
