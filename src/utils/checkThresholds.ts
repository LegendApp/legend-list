import { EDGE_POSITION_EPSILON } from "@/constants";
import { rearmEndFollowIfSettled } from "@/core/finishMaintainScrollAtEnd";
import { getContentSize } from "@/state/getContentSize";
import { peek$, type StateContext } from "@/state/state";
import { checkAtBottom } from "@/utils/checkAtBottom";
import { checkAtTop } from "@/utils/checkAtTop";
import { getDistanceFromStart, type ReachedEdge } from "@/utils/edgeReachedGate";

// Away from both edges with nothing reached, armed or following, the full check would change nothing.
// An interrupted end follow only rearms within the end threshold, so it does not need the full check here.
function isSettledAwayFromEdges(ctx: StateContext) {
    const { state } = ctx;
    const { props, scrollLength } = state;
    if (
        !state.queuedInitialLayout ||
        props.data.length === 0 ||
        state.edgeReachedGate ||
        state.isEndReached ||
        state.isStartReached ||
        state.endReachedSnapshot ||
        state.startReachedSnapshot ||
        state.maintainingScrollAtEnd ||
        state.pendingMaintainScrollAtEnd ||
        peek$(ctx, "isFollowingEnd") ||
        peek$(ctx, "isAtEnd") ||
        peek$(ctx, "isNearEnd") ||
        peek$(ctx, "isWithinMaintainScrollAtEndThreshold") ||
        peek$(ctx, "isAtStart") ||
        peek$(ctx, "isNearStart")
    ) {
        return false;
    }
    const contentSize = getContentSize(ctx);
    const endThreshold = Math.max(props.onEndReachedThreshold!, props.maintainScrollAtEndThreshold ?? 0);
    return (
        contentSize >= scrollLength &&
        getDistanceFromStart(ctx) > Math.max(EDGE_POSITION_EPSILON, props.onStartReachedThreshold! * scrollLength) &&
        contentSize - state.scroll - scrollLength > Math.max(EDGE_POSITION_EPSILON, endThreshold * scrollLength)
    );
}

export function checkThresholds(ctx: StateContext, allowedEdge?: ReachedEdge) {
    if (isSettledAwayFromEdges(ctx)) return;
    const allowGateCreatedInCurrentCheck = !ctx.state.edgeReachedGate;
    checkAtBottom(ctx, allowedEdge, allowGateCreatedInCurrentCheck);
    checkAtTop(ctx, allowedEdge, allowGateCreatedInCurrentCheck);
    rearmEndFollowIfSettled(ctx);
}
