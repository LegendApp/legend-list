import { EDGE_POSITION_EPSILON } from "@/constants";
import { type StateContext, set$ } from "@/state/state";
import { checkThreshold } from "@/utils/checkThreshold";
import {
    canDispatchReachedEdge,
    dispatchReachedEdge,
    getDistanceFromStart,
    getThresholdSnapshot,
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
        props: { onStartReachedThreshold },
        scrollLength,
    } = state;

    const threshold = onStartReachedThreshold! * scrollLength;
    const distanceFromStart = getDistanceFromStart(ctx);
    resetSharedEdgeGateIfOutsideHysteresis(ctx);

    set$(ctx, "isAtStart", distanceFromStart <= EDGE_POSITION_EPSILON);
    set$(ctx, "isNearStart", distanceFromStart <= threshold);

    const shouldSkipThresholdChecks =
        !state.queuedInitialLayout || hasActiveInitialScroll(state) || !!state.scrollingTo;

    if (!shouldSkipThresholdChecks) {
        state.isStartReached = checkThreshold(
            distanceFromStart,
            false,
            threshold,
            state.isStartReached,
            state.startReachedSnapshot,
            getThresholdSnapshot(ctx),
            (distance) => {
                if (
                    state.props.onStartReached &&
                    canDispatchReachedEdge(ctx, "start", allowedEdge, allowGateCreatedInCurrentCheck)
                ) {
                    dispatchReachedEdge(ctx, "start", () =>
                        state.props.onStartReached!({ distanceFromStart: distance }),
                    );
                    return true;
                }
                return false;
            },
            (snapshot) => {
                state.startReachedSnapshot = snapshot;
            },
        );
    }
}
