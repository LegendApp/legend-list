import { getContentInsetTop } from "@/core/clampScrollOffset";
import { getContentSize } from "@/state/getContentSize";
import type { StateContext } from "@/state/state";
import { didThresholdDataChange, isOutsideThresholdHysteresis } from "@/utils/checkThreshold";

export type ReachedEdge = "end" | "start";

export function getDistanceFromStart(ctx: StateContext) {
    return ctx.state.scroll + getContentInsetTop(ctx);
}

export function resetSharedEdgeGateIfOutsideHysteresis(ctx: StateContext) {
    const state = ctx.state;
    if (!state.edgeReachedGate) {
        return;
    }

    const contentSize = getContentSize(ctx);
    const endDistance = contentSize - state.scroll - state.scrollLength;
    const isContentLess = contentSize < state.scrollLength;
    const startThreshold = state.props.onStartReachedThreshold! * state.scrollLength;
    const endThreshold = state.props.onEndReachedThreshold! * state.scrollLength;
    const isOutsideStart = isOutsideThresholdHysteresis(getDistanceFromStart(ctx), false, startThreshold);
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
    const state = ctx.state;
    // An already-delivered edge can report new content without reopening the
    // shared gate for an opposite edge reached by residual scroll or MVCP.
    return (
        !state.edgeReachedGate ||
        allowedEdge === edge ||
        !!allowGateCreatedInCurrentCheck ||
        didThresholdDataChange(
            edge === "start" ? state.startReachedSnapshot : state.endReachedSnapshot,
            getThresholdSnapshot(ctx),
        )
    );
}

export function markReachedEdge(ctx: StateContext, edge: ReachedEdge) {
    const state = ctx.state;
    state.edgeReachedGate = "closed";
    // Publish admission before user callbacks can synchronously recheck thresholds.
    state[edge === "start" ? "startReachedSnapshot" : "endReachedSnapshot"] = getThresholdSnapshot(ctx);
}

function getThresholdSnapshot(ctx: StateContext) {
    const { data } = ctx.state.props;
    return { contentSize: getContentSize(ctx), data, dataLength: data.length };
}

export function prepareReachedEdgeForNextUserScroll(ctx: StateContext) {
    if (ctx.state.edgeReachedGate) {
        ctx.state.edgeReachedGate = "prepared";
    }
}

export function beginReachedEdgeUserScroll(ctx: StateContext, scrollDelta: number): ReachedEdge | undefined {
    const state = ctx.state;
    if (state.edgeReachedGate !== "prepared") {
        return undefined;
    }

    // Keep the gesture eligible until a callback dispatch closes the gate via
    // markReachedEdge. The first event may still be outside the target window.
    return scrollDelta < 0 ? "start" : "end";
}
