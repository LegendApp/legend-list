import type {
    BootstrapInitialScrollSession,
    InitialScrollSession,
    InitialScrollSessionCompletion,
    InitialScrollSessionPhase,
    InternalState,
} from "@/types.base";

function getDefaultInitialScrollSessionPhase(state: InternalState): InitialScrollSessionPhase {
    return state.queuedInitialLayout ? "pending" : "waitingForLayout";
}

function hasInitialScrollSessionCompletion(completion: InitialScrollSessionCompletion | undefined) {
    return !!(completion?.didDispatchNativeScroll || completion?.didRetrySilentInitialScroll || completion?.watchdog);
}

type SyncInitialScrollSessionOptions = {
    bootstrap?: BootstrapInitialScrollSession;
    kind?: InitialScrollSession["kind"];
    phase?: InitialScrollSessionPhase;
    previousDataLength?: number;
};

export function getInitialScrollSession(state: InternalState) {
    return state.initialScrollSession;
}

export function getInitialScrollSessionKind(state: InternalState): InitialScrollSession["kind"] | undefined {
    return state.initialScrollSession?.kind;
}

export function isOffsetInitialScrollSession(state: InternalState) {
    return getInitialScrollSessionKind(state) === "offset";
}

export function getInitialScrollSessionPreviousDataLength(state: InternalState) {
    return state.initialScrollSession?.previousDataLength ?? 0;
}

export function setInitialScrollSessionPreviousDataLength(state: InternalState, previousDataLength: number) {
    if (state.initialScrollSession) {
        state.initialScrollSession.previousDataLength = previousDataLength;
    }
}

export function getBootstrapInitialScrollSession(state: InternalState) {
    return state.initialScrollSession?.kind === "bootstrap" ? state.initialScrollSession.bootstrap : undefined;
}

export function syncInitialScrollSessionFromLegacyState(
    state: InternalState,
    options: SyncInitialScrollSessionOptions = {},
) {
    const existingSession = state.initialScrollSession;
    const kind = options.kind ?? existingSession?.kind;
    const completion = existingSession?.completion;
    const target = state.initialScroll;
    const hasBootstrapOverride = Object.hasOwn(options, "bootstrap");
    const bootstrap =
        kind === "bootstrap"
            ? hasBootstrapOverride
                ? options.bootstrap
                : existingSession?.kind === "bootstrap"
                  ? existingSession.bootstrap
                  : undefined
            : undefined;

    if (!kind) {
        state.initialScrollSession = undefined;
        return undefined;
    }

    if (!target && !bootstrap && !hasInitialScrollSessionCompletion(completion)) {
        state.initialScrollSession = undefined;
        return undefined;
    }

    const phase = options.phase ?? existingSession?.phase ?? getDefaultInitialScrollSessionPhase(state);
    const previousDataLength = options.previousDataLength ?? existingSession?.previousDataLength ?? 0;

    state.initialScrollSession =
        kind === "offset"
            ? {
                  completion,
                  kind,
                  phase,
                  previousDataLength,
                  target,
              }
            : {
                  bootstrap,
                  completion,
                  kind,
                  phase,
                  previousDataLength,
                  target,
              };

    return state.initialScrollSession;
}

export function setInitialScrollSessionPhase(state: InternalState, phase: InitialScrollSessionPhase) {
    return syncInitialScrollSessionFromLegacyState(state, { phase });
}

function ensureInitialScrollSession(
    state: InternalState,
    options?: {
        kind?: InitialScrollSession["kind"];
        phase?: InitialScrollSessionPhase;
    },
) {
    let session =
        options?.kind || options?.phase
            ? syncInitialScrollSessionFromLegacyState(state, {
                  kind: options?.kind ?? "bootstrap",
                  phase: options?.phase,
              })
            : (state.initialScrollSession ?? syncInitialScrollSessionFromLegacyState(state, { kind: "bootstrap" }));
    if (!session) {
        session = {
            completion: {},
            kind: options?.kind ?? "bootstrap",
            phase: options?.phase ?? getDefaultInitialScrollSessionPhase(state),
            previousDataLength: 0,
            target: state.initialScroll,
        };
        state.initialScrollSession = session;
    }
    if (!session) {
        return undefined;
    }

    session.completion ??= {};
    return session.completion;
}

export function setBootstrapInitialScrollSession(
    state: InternalState,
    bootstrap: BootstrapInitialScrollSession | undefined,
    options?: {
        phase?: InitialScrollSessionPhase;
    },
) {
    return syncInitialScrollSessionFromLegacyState(state, {
        bootstrap,
        kind: bootstrap ? "bootstrap" : state.initialScrollSession?.kind,
        phase: options?.phase,
    });
}

export function getInitialScrollSessionCompletion(state: InternalState): InitialScrollSessionCompletion | undefined {
    return state.initialScrollSession?.completion;
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
        kind?: InitialScrollSession["kind"];
        phase?: InitialScrollSessionPhase;
    },
) {
    const completion = ensureInitialScrollSession(state, options);
    if (!completion) {
        return;
    }

    completion.didDispatchNativeScroll = undefined;
    completion.didRetrySilentInitialScroll = undefined;
}

export function markInitialScrollSessionNativeDispatch(
    state: InternalState,
    options?: {
        kind?: InitialScrollSession["kind"];
        phase?: InitialScrollSessionPhase;
    },
) {
    const completion = ensureInitialScrollSession(state, options);
    if (!completion) {
        return;
    }

    completion.didDispatchNativeScroll = true;
}

export function markInitialScrollSessionSilentRetry(
    state: InternalState,
    options?: {
        kind?: InitialScrollSession["kind"];
        phase?: InitialScrollSessionPhase;
    },
) {
    const completion = ensureInitialScrollSession(state, options);
    if (!completion) {
        return;
    }

    completion.didRetrySilentInitialScroll = true;
}

export function setInitialScrollSessionWatchdog(
    state: InternalState,
    watchdog: InitialScrollSessionCompletion["watchdog"],
    options?: {
        kind?: InitialScrollSession["kind"];
        phase?: InitialScrollSessionPhase;
    },
) {
    const completion = ensureInitialScrollSession(state, options);
    if (!completion) {
        return;
    }

    completion.watchdog = watchdog
        ? {
              startScroll: watchdog.startScroll,
              targetOffset: watchdog.targetOffset,
          }
        : undefined;
}
