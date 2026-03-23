import { scrollTo } from "@/core/scrollTo";
import { scrollToIndex } from "@/core/scrollToIndex";
import type { StateContext } from "@/state/state";
import type { ScrollIndexWithOffsetAndContentOffset } from "@/types.base";
import { debugInitialScroll } from "@/utils/debugInitialScroll";

export function performInitialScroll(
    ctx: StateContext,
    params: {
        forceScroll: boolean;
        initialScrollUsesOffset: boolean;
        resolvedOffset?: number;
        target: ScrollIndexWithOffsetAndContentOffset;
    },
) {
    const { forceScroll, initialScrollUsesOffset, resolvedOffset, target } = params;
    debugInitialScroll("performInitialScroll", {
        forceScroll,
        initialScrollUsesOffset,
        resolvedOffset,
        targetIndex: target.index,
        targetOffset: target.contentOffset,
        targetViewOffset: target.viewOffset,
        targetViewPosition: target.viewPosition,
    });

    if (initialScrollUsesOffset || resolvedOffset !== undefined) {
        scrollTo(ctx, {
            animated: false,
            forceScroll,
            index: initialScrollUsesOffset ? undefined : target.index,
            isInitialScroll: true,
            offset: resolvedOffset ?? target.contentOffset ?? 0,
            precomputedWithViewOffset: resolvedOffset !== undefined,
        });
        return;
    }

    if (target.index === undefined) {
        debugInitialScroll("performInitialScroll-skip", {
            reason: "missing-target-index",
        });
        return;
    }

    scrollToIndex(ctx, {
        ...target,
        animated: false,
        forceScroll,
        isInitialScroll: true,
    });
}
