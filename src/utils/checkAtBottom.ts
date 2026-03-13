import { getContentInsetEnd } from "@/state/getContentInsetEnd";
import { getContentSize } from "@/state/getContentSize";
import type { StateContext } from "@/state/state";
import { checkThreshold } from "@/utils/checkThreshold";
import { logScrollControllerDebug } from "@/utils/debugScrollControllers";
import { getEffectiveThresholdScroll } from "@/utils/getEffectiveThresholdScroll";

export function checkAtBottom(ctx: StateContext) {
    const state = ctx.state;
    if (!state || state.initialScroll) {
        return;
    }
    const {
        queuedInitialLayout,
        scrollLength,
        maintainingScrollAtEnd,
        props: { maintainScrollAtEndThreshold, onEndReachedThreshold },
    } = state;
    const scroll = getEffectiveThresholdScroll(ctx);

    if (state.initialScroll) {
        return;
    }

    const contentSize = getContentSize(ctx);
    if (contentSize > 0 && queuedInitialLayout && !maintainingScrollAtEnd) {
        // Check if at end
        const insetEnd = getContentInsetEnd(state);
        const distanceFromEnd = contentSize - scroll - scrollLength - insetEnd;
        const isContentLess = contentSize < scrollLength;
        const wasAtEnd = state.isAtEnd;
        state.isAtEnd = isContentLess || distanceFromEnd < scrollLength * maintainScrollAtEndThreshold!;
        if (state.isAtEnd !== wasAtEnd) {
            logScrollControllerDebug("maintain:end-state", {
                contentSize,
                distanceFromEnd,
                isAtEnd: state.isAtEnd,
                previousIsAtEnd: wasAtEnd,
                scroll,
                scrollLength,
            });
        }

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
