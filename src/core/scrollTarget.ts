import type { InternalState, ScrollTarget } from "@/types.base";

type ScrollTargetOffsetState = Pick<ScrollTarget, "logicalTargetOffset" | "offset" | "targetOffset">;

export function getScrollTargetOffset(scrollTarget: ScrollTargetOffsetState) {
    return scrollTarget.targetOffset ?? scrollTarget.offset;
}

export function getLogicalScrollTargetOffset(scrollTarget: ScrollTargetOffsetState) {
    return scrollTarget.logicalTargetOffset ?? getScrollTargetOffset(scrollTarget);
}

export function getActiveInitialScrollTargetOffset(state: Pick<InternalState, "scrollingTo">) {
    return state.scrollingTo?.isInitialScroll ? getLogicalScrollTargetOffset(state.scrollingTo) : undefined;
}
