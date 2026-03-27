import type { InternalState } from "@/types.base";

type StartupLayoutCheckpointState = Pick<InternalState, "queuedInitialLayout">;
type StartupLayoutState = Pick<InternalState, "didContainersLayout">;
type StartupScrollState = Pick<InternalState, "didFinishInitialScroll">;
type StartupRenderState = Pick<InternalState, "didContainersLayout" | "didFinishInitialScroll">;

export function hasStartupLayoutCheckpoint(state: StartupLayoutCheckpointState) {
    return !!state.queuedInitialLayout;
}

export function markStartupLayoutCheckpoint(state: StartupLayoutCheckpointState) {
    state.queuedInitialLayout = true;
}

export function markStartupLayoutComplete(state: StartupLayoutState) {
    state.didContainersLayout = true;
}

export function hasFinishedStartupScroll(state: StartupScrollState) {
    return !!state.didFinishInitialScroll;
}

export function markFinishedStartupScroll(state: StartupScrollState) {
    state.didFinishInitialScroll = true;
}

export function resetFinishedStartupScroll(state: StartupScrollState) {
    if (state.didFinishInitialScroll) {
        state.didFinishInitialScroll = false;
    }
}

export function isStartupReadyToRender(state: StartupRenderState) {
    return !!state.didContainersLayout && hasFinishedStartupScroll(state);
}
