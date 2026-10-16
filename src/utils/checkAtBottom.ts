import { EDGE_POSITION_EPSILON } from "@/constants";
import { getDistanceFromEnd } from "@/core/emitMetrics";
import { getContentSize } from "@/state/getContentSize";
import { peek$, type StateContext, set$ } from "@/state/state";
import { checkThreshold } from "@/utils/checkThreshold";
import {
    canDispatchReachedEdge,
    markReachedEdge,
    type ReachedEdge,
    resetSharedEdgeGateIfOutsideHysteresis,
} from "@/utils/edgeReachedGate";
import { hasActiveInitialScroll } from "@/utils/hasActiveInitialScroll";

export function checkAtBottom(
    ctx: StateContext,
    allowedEdge?: ReachedEdge,
    allowGateCreatedInCurrentCheck?: boolean,
    options?: { maintainScrollAtEndGrowthCredit?: number },
) {
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
    set$(ctx, "distanceFromEnd", getDistanceFromEnd(ctx));
    resetSharedEdgeGateIfOutsideHysteresis(ctx);
    if (state.props.data.length === 0 && scrollLength > 0 && contentSize <= scrollLength) {
        set$(ctx, "isAtEnd", true);
        set$(ctx, "isNearEnd", true);
        set$(ctx, "isWithinMaintainScrollAtEndThreshold", true);
        return;
    }
    if (contentSize > 0 && queuedInitialLayout) {
        const distanceFromEnd = contentSize - scroll - scrollLength;
        const isContentLess = contentSize < scrollLength;
        set$(ctx, "isAtEnd", isContentLess || distanceFromEnd <= EDGE_POSITION_EPSILON);
        set$(ctx, "isNearEnd", isContentLess || distanceFromEnd <= onEndReachedThreshold! * scrollLength);
        set$(
            ctx,
            "isWithinMaintainScrollAtEndThreshold",
            isContentLess ||
                // A zero threshold still includes fractional offsets considered
                // at the end; otherwise following can stop after rounding/layout.
                distanceFromEnd - (options?.maintainScrollAtEndGrowthCredit ?? 0) <=
                    Math.max(EDGE_POSITION_EPSILON, maintainScrollAtEndThreshold! * scrollLength) ||
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
                {
                    contentSize,
                    dataLength: state.props.data?.length,
                    scrollPosition: scroll,
                },
                (distance) => {
                    let dispatched = false;
                    if (
                        state.props.onEndReached &&
                        canDispatchReachedEdge(ctx, "end", allowedEdge, allowGateCreatedInCurrentCheck)
                    ) {
                        markReachedEdge(ctx);
                        state.props.onEndReached({ distanceFromEnd: distance });
                        dispatched = true;
                    }
                    return dispatched;
                },
                (snapshot) => {
                    state.endReachedSnapshot = snapshot;
                },
            );
        }
    }
}
