import { SCROLL_END_FALLBACK_MS } from "@/constants";
import { getContentInsetEnd } from "@/state/getContentInsetEnd";
import { getContentSize } from "@/state/getContentSize";
import type { StateContext } from "@/state/state";
import { isOutsideThresholdHysteresis } from "@/utils/checkThreshold";

export type ReachedEdge = "end" | "start";

function resetEdgeLatch(ctx: StateContext, edge: ReachedEdge) {
    const state = ctx.state;
    if (edge === "start") {
        state.isStartReached = false;
        state.startReachedSnapshot = undefined;
    } else {
        state.isEndReached = false;
        state.endReachedSnapshot = undefined;
    }
}

export function resetSharedEdgeGateIfOutsideHysteresis(ctx: StateContext) {
    const state = ctx.state;
    if (!state.edgeReachedGate) {
        return;
    }

    const contentSize = getContentSize(ctx);
    const endDistance = contentSize - state.scroll - state.scrollLength - getContentInsetEnd(ctx);
    const isContentLess = contentSize < state.scrollLength;
    const startThreshold = state.props.onStartReachedThreshold! * state.scrollLength;
    const endThreshold = state.props.onEndReachedThreshold! * state.scrollLength;
    const isOutsideStart = isOutsideThresholdHysteresis(state.scroll, false, startThreshold);
    const isOutsideEnd = isOutsideThresholdHysteresis(endDistance, isContentLess, endThreshold);

    if (isOutsideStart && isOutsideEnd) {
        state.edgeReachedGate = undefined;
    }
}

export function canDispatchReachedEdge(
    ctx: StateContext,
    edge: ReachedEdge,
    allowedEdge?: ReachedEdge,
    allowGateCreatedInCurrentCheck?: boolean,
) {
    return !ctx.state.edgeReachedGate || allowedEdge === edge || !!allowGateCreatedInCurrentCheck;
}

export function markReachedEdge(ctx: StateContext) {
    ctx.state.edgeReachedGate = "closed";
}

export function prepareReachedEdgeForNextUserScroll(ctx: StateContext) {
    if (ctx.state.edgeReachedGate) {
        ctx.state.edgeReachedGate = "prepared";
    }
}

export function prepareReachedEdgeWhenScrollIdle(ctx: StateContext) {
    const state = ctx.state;
    if (state.edgeReachedGate !== "closed") {
        return;
    }

    state.scheduledWork.timeout(
        () => {
            if (!state.isDragging) {
                prepareReachedEdgeForNextUserScroll(ctx);
            }
        },
        SCROLL_END_FALLBACK_MS,
        "reachedEdgeScrollIdle",
    );
}

export function beginReachedEdgeUserScroll(ctx: StateContext, scrollDelta: number): ReachedEdge | undefined {
    const state = ctx.state;
    if (state.edgeReachedGate !== "prepared") {
        return undefined;
    }

    const allowedEdge = scrollDelta < 0 ? "start" : "end";
    // Keep the gesture eligible until a callback dispatch closes the gate via
    // markReachedEdge. The first event may still be outside the target window.
    resetEdgeLatch(ctx, allowedEdge);
    return allowedEdge;
}
