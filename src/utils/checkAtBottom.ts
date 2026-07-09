import { EDGE_POSITION_EPSILON } from "@/constants";
import { getDataLength, getLegacyData } from "@/core/IndexedData";
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

    const dataLength = getDataLength(state);
    const contentSize = getContentSize(ctx);
    const distanceFromEnd = contentSize - scroll - scrollLength;
    // Empty results can leave padding or other content at the end; estimates and alignment runway do not count.
    const allowEmptyDataChange =
        dataLength === 0 &&
        !!state.endReachedSnapshot?.dataLength &&
        contentSize - (peek$(ctx, "alignItemsAtEndPadding") || 0) > (state.pendingTotalSize ?? state.totalSize);
    resetSharedEdgeGateIfOutsideHysteresis(ctx);
    if (dataLength === 0 && scrollLength > 0 && contentSize <= scrollLength && !allowEmptyDataChange) {
        set$(ctx, "isAtEnd", true);
        set$(ctx, "isNearEnd", true);
        set$(ctx, "isWithinMaintainScrollAtEndThreshold", true);
        return;
    }
    if (contentSize > 0 && queuedInitialLayout) {
        const isContentLess = contentSize < scrollLength;
        const isAtEnd = isContentLess || distanceFromEnd <= EDGE_POSITION_EPSILON;
        // Committed measurements can grow the extent before the queued follow scroll runs.
        const deferEndExit =
            !isAtEnd &&
            state.measuringContainersInLayout &&
            (maintainingScrollAtEnd === "pending-instant" || maintainingScrollAtEnd === "pending-animated") &&
            !state.endFollowInterrupted &&
            peek$(ctx, "isAtEnd");
        if (!deferEndExit) set$(ctx, "isAtEnd", isAtEnd);
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
                { contentSize, data: getLegacyData(state), dataLength, scroll },
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
