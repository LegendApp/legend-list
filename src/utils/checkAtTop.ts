import type { InternalState } from "@/types";
import { checkThreshold } from "@/utils/checkThreshold";

export function checkAtTop(state: InternalState) {
    if (!state) {
        return;
    }
    const {
        scrollLength,
        scroll,
        props: { onStartReachedThreshold },
    } = state;
    const distanceFromTop = scroll;
    state.isAtStart = distanceFromTop <= 0;

    state.isStartReached = checkThreshold(
        distanceFromTop,
        false,
        onStartReachedThreshold! * scrollLength,
        state.isStartReached,
        state.startReachedBlockedByTimer,
        (distance) => state.props.onStartReached?.({ distanceFromStart: distance }),
        (block) => {
            state.startReachedBlockedByTimer = block;
        },
    );
}
