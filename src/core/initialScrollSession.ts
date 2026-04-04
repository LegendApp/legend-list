import type { InternalState } from "@/types.base";

type InitialScrollSession = NonNullable<InternalState["initialScrollSession"]>;
type InitialScrollSessionCompletion = NonNullable<InitialScrollSession["completion"]>;
type InitialScrollSessionKind = InitialScrollSession["kind"];
type BootstrapInitialScrollSession = NonNullable<Extract<InitialScrollSession, { kind: "bootstrap" }>["bootstrap"]>;

function hasInitialScrollSessionCompletion(completion: InitialScrollSessionCompletion | undefined) {
    return !!(completion?.didDispatchNativeScroll || completion?.didRetrySilentInitialScroll || completion?.watchdog);
}

type SyncInitialScrollSessionOptions = {
    bootstrap?: BootstrapInitialScrollSession;
    kind?: InitialScrollSessionKind;
    previousDataLength?: number;
};

export function getInitialScrollSessionKind(state: InternalState): InitialScrollSessionKind | undefined {
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

function clearInitialScrollSession(state: InternalState) {
    state.initialScrollSession = undefined;
    return undefined;
}

export function setInitialScrollSession(state: InternalState, options: SyncInitialScrollSessionOptions = {}) {
    const existingSession = state.initialScrollSession;
    const kind = options.kind ?? existingSession?.kind;
    const completion = existingSession?.completion;
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
        return clearInitialScrollSession(state);
    }

    if (!state.initialScroll && !bootstrap && !hasInitialScrollSessionCompletion(completion)) {
        return clearInitialScrollSession(state);
    }

    const previousDataLength = options.previousDataLength ?? existingSession?.previousDataLength ?? 0;

    state.initialScrollSession =
        kind === "offset"
            ? {
                  completion,
                  kind,
                  previousDataLength,
              }
            : {
                  bootstrap,
                  completion,
                  kind,
                  previousDataLength,
              };

    return state.initialScrollSession;
}

function ensureInitialScrollSessionCompletion(
    state: InternalState,
    options?: {
        kind?: InitialScrollSessionKind;
    },
) {
    let session =
        options?.kind
            ? setInitialScrollSession(state, {
                  kind: options.kind,
              })
            : (state.initialScrollSession ?? setInitialScrollSession(state, { kind: "bootstrap" }));
    if (!session) {
        session = {
            completion: {},
            kind: options?.kind ?? "bootstrap",
            previousDataLength: 0,
        };
        state.initialScrollSession = session;
    }

    if (!session) {
        return undefined;
    }

    session.completion ??= {};
    return session.completion;
}

export function setBootstrapInitialScrollSession(state: InternalState, bootstrap: BootstrapInitialScrollSession | undefined) {
    return setInitialScrollSession(state, {
        bootstrap,
        kind: bootstrap ? "bootstrap" : state.initialScrollSession?.kind,
    });
}

function getInitialScrollSessionCompletion(state: InternalState): InitialScrollSessionCompletion | undefined {
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
        kind?: InitialScrollSessionKind;
    },
) {
    const completion = ensureInitialScrollSessionCompletion(state, options);
    if (!completion) {
        return;
    }
    completion.didDispatchNativeScroll = undefined;
    completion.didRetrySilentInitialScroll = undefined;
}

export function markInitialScrollSessionNativeDispatch(
    state: InternalState,
    options?: {
        kind?: InitialScrollSessionKind;
    },
) {
    const completion = ensureInitialScrollSessionCompletion(state, options);
    if (!completion) {
        return;
    }
    completion.didDispatchNativeScroll = true;
}

export function markInitialScrollSessionSilentRetry(
    state: InternalState,
    options?: {
        kind?: InitialScrollSessionKind;
    },
) {
    const completion = ensureInitialScrollSessionCompletion(state, options);
    if (!completion) {
        return;
    }
    completion.didRetrySilentInitialScroll = true;
}

export function setInitialScrollSessionWatchdog(
    state: InternalState,
    watchdog: InitialScrollSessionCompletion["watchdog"],
    options?: {
        kind?: InitialScrollSessionKind;
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
}
