import { getContentInsetTop } from "@/core/clampScrollOffset";
import { getContentSize } from "@/state/getContentSize";
import type { StateContext } from "@/state/state";
import type { ThresholdSnapshot } from "@/types.internal";
import { didThresholdDataChange, isOutsideThresholdHysteresis } from "@/utils/checkThreshold";

export type ReachedEdge = "end" | "start";

export function getDistanceFromStart(ctx: StateContext) {
    return ctx.state.scroll + getContentInsetTop(ctx);
}

export function resetSharedEdgeGateIfOutsideHysteresis(ctx: StateContext) {
    const state = ctx.state;
    // Layout changes alone do not mean the reader left a delivered edge.
    if (!state.edgeReachedGate || state.edgeReachedGateScroll === state.scroll) {
        return;
    }
    state.edgeReachedGateScroll = state.scroll;

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

function markReachedEdge(ctx: StateContext, edge: ReachedEdge) {
    const state = ctx.state;
    state.edgeReachedGate = "closed";
    state.edgeReachedGateScroll = state.scroll;
    // Publish admission before user callbacks can synchronously recheck thresholds.
    const snapshotKey = edge === "start" ? "startReachedSnapshot" : "endReachedSnapshot";
    const snapshot = getThresholdSnapshot(ctx);
    snapshot.didRearmForData = didThresholdDataChange(state[snapshotKey], snapshot);
    state[snapshotKey] = snapshot;
}

// Suppress data-driven rearming while invoking the callback and until its promise settles.
// Explicit user gestures retain their existing retry behavior.
export function dispatchReachedEdge(ctx: StateContext, edge: ReachedEdge, dispatch: () => unknown) {
    markReachedEdge(ctx, edge);
    const snapshot = ctx.state[edge === "start" ? "startReachedSnapshot" : "endReachedSnapshot"]!;
    snapshot.isRequestPending = true;
    let result: PromiseLike<unknown> | undefined;
    try {
        result = dispatch() as PromiseLike<unknown> | undefined;
    } catch (error) {
        snapshot.isRequestPending = false;
        throw error;
    }
    if (typeof result?.then === "function") {
        const settle = () => {
            snapshot.isRequestPending = false;
            // Recheck once the request's rows commit, so a page that stays inside the threshold keeps paging.
            if (!ctx.state.isUnmounted) {
                ctx.state.scheduledWork.frame(() => ctx.state.reprocessCurrentScroll?.(), "reachedEdgeSettle");
            }
        };
        result.then(settle, settle);
    } else {
        snapshot.isRequestPending = false;
    }
}

function getThresholdSnapshot(ctx: StateContext): ThresholdSnapshot {
    const { data } = ctx.state.props;
    return { contentSize: getContentSize(ctx), data, dataLength: data.length, scroll: ctx.state.scroll };
}

export function prepareReachedEdgeForNextUserScroll(ctx: StateContext) {
    if (ctx.state.edgeReachedGate) {
        ctx.state.edgeReachedGate = "prepared";
    }
}

export function beginReachedEdgeUserScroll(ctx: StateContext, scrollDelta: number): ReachedEdge | undefined {
    const state = ctx.state;
    const allowedEdge = scrollDelta < 0 ? "start" : "end";
    if (
        state.edgeReachedGate !== "prepared" &&
        state.edgeReachedGate !== (allowedEdge === "start" ? "consumed-end" : "consumed-start")
    ) {
        return undefined;
    }

    const snapshotKey = allowedEdge === "start" ? "startReachedSnapshot" : "endReachedSnapshot";
    const snapshot = state[snapshotKey];
    if (snapshot?.didRearmForData && snapshot.data === state.props.data) {
        // New content was already delivered without waiting for this gesture.
        // Consume that delivery once, then let a later gesture retry unchanged data.
        snapshot.didRearmForData = false;
        state.edgeReachedGate = state.edgeReachedGate === "prepared" ? `consumed-${allowedEdge}` : "closed";
        return undefined;
    }
    state[allowedEdge === "start" ? "isStartReached" : "isEndReached"] = false;
    state[snapshotKey] = undefined;
    // Keep the gesture eligible until a callback dispatch closes the gate via
    // markReachedEdge. The first event may still be outside the target window.
    return allowedEdge;
}
