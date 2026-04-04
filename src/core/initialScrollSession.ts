import type { InitialScrollSession, InitialScrollSessionPhase, InternalState } from "@/types.base";

function getLegacySessionKind(state: InternalState): InitialScrollSession["kind"] | undefined {
    if (state.initialScrollUsesOffset) {
        return "offset";
    }

    if (state.initialScroll || state.bootstrapInitialScroll || state.initialScrollSession?.kind === "bootstrap") {
        return "bootstrap";
    }

    return undefined;
}

function getLegacyCompletionState(state: InternalState): InitialScrollSession["completion"] | undefined {
    if (!state.didDispatchNativeScroll && !state.didRetrySilentInitialScroll && !state.initialNativeScrollWatchdog) {
        return undefined;
    }

    return {
        didDispatchNativeScroll: state.didDispatchNativeScroll,
        didRetrySilentInitialScroll: state.didRetrySilentInitialScroll,
        watchdog: state.initialNativeScrollWatchdog
            ? {
                  startScroll: state.initialNativeScrollWatchdog.startScroll,
                  targetOffset: state.initialNativeScrollWatchdog.targetOffset,
              }
            : undefined,
    };
}

export function getInitialScrollSessionKind(state: InternalState): InitialScrollSession["kind"] | undefined {
    return state.initialScrollSession?.kind ?? getLegacySessionKind(state);
}

export function syncInitialScrollSessionFromLegacyState(
    state: InternalState,
    options?: {
        phase?: InitialScrollSessionPhase;
    },
) {
    const kind = getLegacySessionKind(state);
    const existingSession = state.initialScrollSession;

    if (!kind) {
        state.initialScrollSession = undefined;
        return undefined;
    }

    const phase =
        options?.phase ?? existingSession?.phase ?? (state.queuedInitialLayout ? "pending" : "waitingForLayout");

    state.initialScrollSession =
        kind === "offset"
            ? {
                  completion: getLegacyCompletionState(state),
                  kind,
                  phase,
                  previousDataLength: state.initialScrollPreviousDataLength,
                  target: state.initialScroll,
              }
            : {
                  bootstrap: state.bootstrapInitialScroll,
                  completion: getLegacyCompletionState(state),
                  kind,
                  phase,
                  previousDataLength: state.initialScrollPreviousDataLength,
                  target: state.initialScroll,
              };

    return state.initialScrollSession;
}

export function setInitialScrollSessionPhase(state: InternalState, phase: InitialScrollSessionPhase) {
    return syncInitialScrollSessionFromLegacyState(state, { phase });
}
