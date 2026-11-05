import { EDGE_POSITION_EPSILON } from "@/constants";
import { getContentSize } from "@/state/getContentSize";
import { peek$, type StateContext, set$ } from "@/state/state";
import { checkThreshold } from "@/utils/checkThreshold";
import {
    canDispatchReachedEdge,
    dispatchReachedEdge,
    type ReachedEdge,
    resetSharedEdgeGateIfOutsideHysteresis,
} from "@/utils/edgeReachedGate";
import { hasActiveInitialScroll } from "@/utils/hasActiveInitialScroll";

export function checkAtBottom(ctx: StateContext, allowedEdge?: ReachedEdge, allowGateCreatedInCurrentCheck?: boolean) {
    const state = ctx.state;
    if (!state) {
        return;
    }
    const {
        queuedInitialLayout,
        scrollLength,
        scroll,
        maintainingScrollAtEnd,
        props: { maintainScrollAtEndThreshold, onEndReachedThreshold },
    } = state;

    const contentSize = getContentSize(ctx);
    const distanceFromEnd = contentSize - scroll - scrollLength;
    // Empty results can leave padding or other content at the end, but stale row estimates do not count.
    const allowEmptyDataChange =
        state.props.data.length === 0 &&
        !!state.endReachedSnapshot?.dataLength &&
        contentSize > (state.pendingTotalSize ?? state.totalSize);
    resetSharedEdgeGateIfOutsideHysteresis(ctx);
    if (state.props.data.length === 0 && scrollLength > 0 && contentSize <= scrollLength && !allowEmptyDataChange) {
        set$(ctx, "isAtEnd", true);
        set$(ctx, "isNearEnd", true);
        set$(ctx, "isWithinMaintainScrollAtEndThreshold", true);
        return;
    }
    if (contentSize > 0 && queuedInitialLayout) {
        const isContentLess = contentSize < scrollLength;
        set$(ctx, "isAtEnd", isContentLess || distanceFromEnd <= EDGE_POSITION_EPSILON);
        set$(ctx, "isNearEnd", isContentLess || distanceFromEnd <= onEndReachedThreshold! * scrollLength);
        set$(
            ctx,
            "isWithinMaintainScrollAtEndThreshold",
            isContentLess ||
                // A zero threshold still includes fractional offsets considered
                // at the end; otherwise following can stop after rounding/layout.
                distanceFromEnd <= Math.max(EDGE_POSITION_EPSILON, maintainScrollAtEndThreshold! * scrollLength) ||
                state.pendingMaintainScrollAtEnd ||
                !!maintainingScrollAtEnd ||
                !!peek$(ctx, "isFollowingEnd"),
        );

        const shouldSkipThresholdChecks = hasActiveInitialScroll(state) || maintainingScrollAtEnd;
        if (!shouldSkipThresholdChecks) {
            state.isEndReached = checkThreshold(
                distanceFromEnd,
                isContentLess,
                onEndReachedThreshold! * scrollLength,
                state.isEndReached,
                state.endReachedSnapshot,
                { contentSize, data: state.props.data, dataLength: state.props.data.length, scroll },
                (distance) => {
                    if (
                        state.props.onEndReached &&
                        canDispatchReachedEdge(ctx, "end", allowedEdge, allowGateCreatedInCurrentCheck)
                    ) {
                        dispatchReachedEdge(ctx, "end", () => state.props.onEndReached!({ distanceFromEnd: distance }));
                        return true;
                    }
                    return false;
                },
                (snapshot) => {
                    state.endReachedSnapshot = snapshot;
                },
                allowEmptyDataChange,
            );
        }
    }
}
