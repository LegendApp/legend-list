import type {
    InitialScrollSession,
    InitialScrollSessionCompletion,
    InitialScrollSessionPhase,
    InternalState,
} from "@/types.base";

function getLegacySessionKind(state: InternalState): InitialScrollSession["kind"] | undefined {
    if (state.initialScrollUsesOffset) {
        return "offset";
    }

    if (state.initialScroll || state.bootstrapInitialScroll || state.initialScrollSession?.kind === "bootstrap") {
        return "bootstrap";
    }

    if (
        state.scrollingTo?.isInitialScroll ||
        state.didDispatchNativeScroll ||
        state.didRetrySilentInitialScroll ||
        state.initialNativeScrollWatchdog
    ) {
        return state.initialScrollUsesOffset ? "offset" : "bootstrap";
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

function syncLegacyCompletionStateFromSession(state: InternalState) {
    const completion = state.initialScrollSession?.completion;
    state.didDispatchNativeScroll = completion?.didDispatchNativeScroll;
    state.didRetrySilentInitialScroll = completion?.didRetrySilentInitialScroll;
    state.initialNativeScrollWatchdog = completion?.watchdog
        ? {
              startScroll: completion.watchdog.startScroll,
              targetOffset: completion.watchdog.targetOffset,
          }
        : undefined;
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

    syncLegacyCompletionStateFromSession(state);

    return state.initialScrollSession;
}

export function setInitialScrollSessionPhase(state: InternalState, phase: InitialScrollSessionPhase) {
    return syncInitialScrollSessionFromLegacyState(state, { phase });
}

function ensureInitialScrollSessionCompletion(
    state: InternalState,
    options?: {
        phase?: InitialScrollSessionPhase;
    },
) {
    const session = options?.phase
        ? setInitialScrollSessionPhase(state, options.phase)
        : (state.initialScrollSession ?? syncInitialScrollSessionFromLegacyState(state));
    if (!session) {
        return undefined;
    }

    session.completion ??= {};
    syncLegacyCompletionStateFromSession(state);
    return session.completion;
}

export function getInitialScrollSessionCompletion(state: InternalState): InitialScrollSessionCompletion | undefined {
    return state.initialScrollSession?.completion ?? getLegacyCompletionState(state);
}

export function getInitialScrollSessionDidDispatchNativeScroll(state: InternalState) {
    return !!getInitialScrollSessionCompletion(state)?.didDispatchNativeScroll;
}

export function getInitialScrollSessionDidRetrySilentInitialScroll(state: InternalState) {
    return !!getInitialScrollSessionCompletion(state)?.didRetrySilentInitialScroll;
}

export function getInitialScrollSessionWatchdog(state: InternalState) {
    return getInitialScrollSessionCompletion(state)?.watchdog;
}

export function resetInitialScrollSessionCompletionState(
    state: InternalState,
    options?: {
        phase?: InitialScrollSessionPhase;
    },
) {
    const completion = ensureInitialScrollSessionCompletion(state, options);
    if (!completion) {
        return;
    }

    completion.didDispatchNativeScroll = undefined;
    completion.didRetrySilentInitialScroll = undefined;
    syncLegacyCompletionStateFromSession(state);
}

export function markInitialScrollSessionNativeDispatch(
    state: InternalState,
    options?: {
        phase?: InitialScrollSessionPhase;
    },
) {
    const completion = ensureInitialScrollSessionCompletion(state, options);
    if (!completion) {
        return;
    }

    completion.didDispatchNativeScroll = true;
    syncLegacyCompletionStateFromSession(state);
}

export function markInitialScrollSessionSilentRetry(
    state: InternalState,
    options?: {
        phase?: InitialScrollSessionPhase;
    },
) {
    const completion = ensureInitialScrollSessionCompletion(state, options);
    if (!completion) {
        return;
    }

    completion.didRetrySilentInitialScroll = true;
    syncLegacyCompletionStateFromSession(state);
}

export function setInitialScrollSessionWatchdog(
    state: InternalState,
    watchdog: InitialScrollSessionCompletion["watchdog"],
    options?: {
        phase?: InitialScrollSessionPhase;
    },
) {
    const completion = ensureInitialScrollSessionCompletion(state, options);
    if (!completion) {
        return;
    }

    completion.watchdog = watchdog
        ? {
              startScroll: watchdog.startScroll,
              targetOffset: watchdog.targetOffset,
          }
        : undefined;
    syncLegacyCompletionStateFromSession(state);
}
