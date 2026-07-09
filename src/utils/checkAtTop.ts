import { EDGE_POSITION_EPSILON } from "@/constants";
import { getDataLength } from "@/core/IndexedData";
import { type StateContext, set$ } from "@/state/state";
import { checkThreshold } from "@/utils/checkThreshold";
import {
    canDispatchReachedEdge,
    markReachedEdge,
    type ReachedEdge,
    resetSharedEdgeGateIfOutsideHysteresis,
} from "@/utils/edgeReachedGate";
import { hasActiveInitialScroll } from "@/utils/hasActiveInitialScroll";

export function checkAtTop(ctx: StateContext, allowedEdge?: ReachedEdge, allowGateCreatedInCurrentCheck?: boolean) {
    const state = ctx?.state;
    if (!state) {
        return;
    }
    const {
        isStartReached,
        props: { onStartReachedThreshold },
        scroll,
        scrollLength,
        startReachedSnapshot,
        totalSize,
    } = state;

    const dataLength = getDataLength(state);
    const threshold = onStartReachedThreshold! * scrollLength;
    resetSharedEdgeGateIfOutsideHysteresis(ctx);

    // If data changes and pushes us back outside the start window, immediately
    // clear the start latch so a fast return to the top can trigger again.
    if (
        isStartReached &&
        threshold > 0 &&
        scroll > threshold &&
        startReachedSnapshot &&
        (startReachedSnapshot.contentSize !== totalSize || startReachedSnapshot.dataLength !== dataLength)
    ) {
        state.isStartReached = false;
        state.startReachedSnapshot = undefined;
    }

    set$(ctx, "isAtStart", scroll <= EDGE_POSITION_EPSILON);
    set$(ctx, "isNearStart", scroll <= threshold);

    const shouldSkipThresholdChecks = hasActiveInitialScroll(state) || !!state.scrollingTo;

    if (!shouldSkipThresholdChecks) {
        state.isStartReached = checkThreshold(
            scroll,
            false,
            threshold,
            state.isStartReached,
            startReachedSnapshot,
            {
                contentSize: totalSize,
                dataLength,
                scrollPosition: scroll,
            },
            (distance) => {
                if (canDispatchReachedEdge(ctx, "start", allowedEdge, allowGateCreatedInCurrentCheck)) {
                    markReachedEdge(ctx);
                    state.props.onStartReached?.({ distanceFromStart: distance });
                }
            },
            (snapshot) => {
                state.startReachedSnapshot = snapshot;
            },
        );
    }
}
