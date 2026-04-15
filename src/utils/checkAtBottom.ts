import { EDGE_POSITION_EPSILON } from "@/constants";
import { getContentInsetEnd } from "@/state/getContentInsetEnd";
import { getContentSize } from "@/state/getContentSize";
import { type StateContext, set$ } from "@/state/state";
import { checkThreshold } from "@/utils/checkThreshold";
import { hasActiveInitialScroll } from "@/utils/hasActiveInitialScroll";

export function checkAtBottom(ctx: StateContext) {
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
    if (contentSize > 0 && queuedInitialLayout) {
        const insetEnd = getContentInsetEnd(state);
        const distanceFromEnd = contentSize - scroll - scrollLength - insetEnd;
        const isContentLess = contentSize < scrollLength;
        set$(ctx, "isAtEnd", isContentLess || distanceFromEnd <= EDGE_POSITION_EPSILON);
        set$(ctx, "isNearEnd", isContentLess || distanceFromEnd <= onEndReachedThreshold! * scrollLength);
        set$(
            ctx,
            "isWithinMaintainScrollAtEndThreshold",
            isContentLess || distanceFromEnd <= maintainScrollAtEndThreshold! * scrollLength,
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
                (distance) => state.props.onEndReached?.({ distanceFromEnd: distance }),
                (snapshot) => {
                    state.endReachedSnapshot = snapshot;
                },
                true,
            );
        }
    }
}
