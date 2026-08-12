import { EDGE_POSITION_EPSILON } from "@/constants";
import { getContentInsetEnd } from "@/state/getContentInsetEnd";
import { getContentSize } from "@/state/getContentSize";
import { type StateContext, set$ } from "@/state/state";
import { checkThreshold } from "@/utils/checkThreshold";
import {
    canDispatchReachedEdge,
    markReachedEdge,
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
    resetSharedEdgeGateIfOutsideHysteresis(ctx);
    if (contentSize > 0 && queuedInitialLayout) {
        const insetEnd = getContentInsetEnd(ctx);
        const distanceFromEnd = contentSize - scroll - scrollLength - insetEnd;
        const isContentLess = contentSize < scrollLength;
        set$(ctx, "isAtEnd", isContentLess || distanceFromEnd <= EDGE_POSITION_EPSILON);
        set$(ctx, "isNearEnd", isContentLess || distanceFromEnd <= onEndReachedThreshold! * scrollLength);
        set$(
            ctx,
            "isWithinMaintainScrollAtEndThreshold",
            isContentLess ||
                distanceFromEnd <= maintainScrollAtEndThreshold! * scrollLength ||
                maintainingScrollAtEnd === "animated" ||
                maintainingScrollAtEnd === "instant",
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
                    if (canDispatchReachedEdge(ctx, "end", allowedEdge, allowGateCreatedInCurrentCheck)) {
                        markReachedEdge(ctx);
                        state.props.onEndReached?.({ distanceFromEnd: distance });
                    }
                },
                (snapshot) => {
                    state.endReachedSnapshot = snapshot;
                },
            );
        }
    }
}
