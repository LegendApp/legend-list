import type { StateContext } from "@/state/state";

export function cancelScrollCompletionFrame(state: StateContext["state"]) {
    const animationFrame = state.animFrameCheckFinishedScroll;
    if (animationFrame !== undefined) {
        cancelAnimationFrame(animationFrame);
        state.animFrameCheckFinishedScroll = undefined;
    }
}

export function cancelScrollCompletionChecks(state: StateContext["state"]) {
    cancelScrollCompletionFrame(state);

    const fallbackTimeout = state.timeoutCheckFinishedScrollFallback;
    if (fallbackTimeout !== undefined) {
        clearTimeout(fallbackTimeout);
        state.timeoutCheckFinishedScrollFallback = undefined;
    }
}
