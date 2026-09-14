import type { StateContext } from "@/state/state";

type InternalState = StateContext["state"];

export function cancelScrollCompletionChecks({ scheduledWork }: InternalState) {
    scheduledWork.cancel("checkFinishedScrollFrame");
    scheduledWork.cancel("checkFinishedScrollRetryFrame");
    scheduledWork.cancel("checkFinishedScrollFallback");
    scheduledWork.cancel("platformScrollCompletion");
}

export function settlePendingImperativeScroll(state: InternalState) {
    const resolvePendingScroll = state.pendingScrollResolve ?? state.pendingScrollToEnd?.resolve;
    state.pendingScrollResolve = undefined;
    state.pendingScrollToEnd = undefined;
    resolvePendingScroll?.();
}

export function cancelImperativeScroll(state: InternalState) {
    cancelScrollCompletionChecks(state);
    state.scheduledWork.cancel("imperativeScrollReady");

    // Match request supersession by resolving cancellation. Calling finishScrollTo here would
    // recalculate layout and commit adjustments against a list that is already unmounting.
    state.scrollingTo = undefined;
    state.scrollTargetPinnedRange = undefined;
    settlePendingImperativeScroll(state);
}
