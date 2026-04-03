import { scrollTo } from "@/core/scrollTo";
import { clampScrollIndex, scrollToIndex } from "@/core/scrollToIndex";
import type { StateContext } from "@/state/state";
import type { InternalInitialScrollTarget } from "@/types.base";
import { getId } from "@/utils/getId";
import { getItemSize } from "@/utils/getItemSize";

export function performInitialScroll(
    ctx: StateContext,
    params: {
        forceScroll: boolean;
        initialScrollUsesOffset: boolean;
        resolvedOffset?: number;
        target: InternalInitialScrollTarget;
        waitForCompletionFrame?: boolean;
    },
) {
    const { forceScroll, initialScrollUsesOffset, resolvedOffset, target, waitForCompletionFrame } = params;
    if (!initialScrollUsesOffset && resolvedOffset === undefined) {
        if (target.index === undefined) {
            return;
        }

        scrollToIndex(ctx, {
            ...target,
            animated: false,
            forceScroll,
            isInitialScroll: true,
        });
        return;
    }

    const offset = resolvedOffset ?? target.contentOffset;
    const requestedIndex = initialScrollUsesOffset ? undefined : target.index;

    if (offset === undefined) {
        return;
    }

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
        offset,
        preserveInitialScrollTarget: !!target.preserveForFooterLayout,
        precomputedWithViewOffset: resolvedOffset !== undefined,
        viewOffset: target.viewOffset,
        viewPosition: target.viewPosition,
        waitForInitialScrollCompletionFrame: waitForCompletionFrame,
    });
}
