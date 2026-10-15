import type { StateContext } from "@/state/state";
import type { LegendListScrollResult } from "@/types.base";

type InternalState = StateContext["state"];

export function cancelScrollCompletionChecks({ scheduledWork }: InternalState) {
    scheduledWork.cancel("checkFinishedScrollFrame");
    scheduledWork.cancel("checkFinishedScrollRetryFrame");
    scheduledWork.cancel("checkFinishedScrollFallback");
    scheduledWork.cancel("platformScrollCompletion");
}

type StoppedReason = Exclude<LegendListScrollResult, void>["reason"];

export function settlePendingImperativeScroll(state: InternalState, reason: StoppedReason = "superseded") {
    const resolvePendingScroll = state.pendingScrollResolve ?? state.pendingScrollToEnd?.resolve;
    state.pendingScrollResolve = undefined;
    state.pendingScrollToEnd = undefined;
    resolvePendingScroll?.({ reason });
}

export function cancelImperativeScroll(state: InternalState, reason: StoppedReason = "superseded") {
    cancelScrollCompletionChecks(state);
    state.scheduledWork.cancel("imperativeScrollReady");

    // Match request supersession by resolving cancellation. Calling finishScrollTo here would
    // recalculate layout and commit adjustments against a list that is already unmounting.
    state.scrollingTo = undefined;
    state.scrollTargetPinnedRange = undefined;
    settlePendingImperativeScroll(state, reason);
}
