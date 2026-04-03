import { scrollTo } from "@/core/scrollTo";
import type { StateContext } from "@/state/state";
import type { ScrollIndexWithOffsetAndContentOffset } from "@/types.base";

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

    if (offset === undefined) {
        return;
    }

    scrollTo(ctx, {
        animated: false,
        forceScroll,
        index: initialScrollUsesOffset ? undefined : target.index,
        isInitialScroll: true,
        offset,
        precomputedWithViewOffset: resolvedOffset !== undefined,
        waitForInitialScrollCompletionFrame: waitForCompletionFrame,
    });
}
