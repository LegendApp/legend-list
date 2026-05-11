import type { InternalState } from "@/types.internal";

type InitialScrollSession = NonNullable<InternalState["initialScrollSession"]>;
type InitialScrollSessionCompletion = NonNullable<InitialScrollSession["completion"]>;
type InitialScrollSessionKind = InitialScrollSession["kind"];
type BootstrapInitialScrollSession = NonNullable<Extract<InitialScrollSession, { kind: "bootstrap" }>["bootstrap"]>;
type InitialScrollWatchdog = InitialScrollSessionCompletion["watchdog"];
const INITIAL_SCROLL_MIN_TARGET_OFFSET = 1;

function hasInitialScrollSessionCompletion(completion: InitialScrollSessionCompletion | undefined) {
    return !!(completion?.didDispatchNativeScroll || completion?.didRetrySilentInitialScroll || completion?.watchdog);
}

type SyncInitialScrollSessionOptions = {
    bootstrap?: BootstrapInitialScrollSession | null;
    kind?: InitialScrollSessionKind;
    previousDataLength?: number;
};

function clearInitialScrollSession(state: InternalState) {
    state.initialScrollSession = undefined;
    return undefined;
}

function createInitialScrollSession(options: {
    bootstrap?: BootstrapInitialScrollSession;
    completion?: InitialScrollSessionCompletion;
    kind: InitialScrollSessionKind;
    previousDataLength: number;
}) {
    const { bootstrap, completion, kind, previousDataLength } = options;
    return kind === "offset"
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
}

function ensureInitialScrollSessionCompletion(
    state: InternalState,
    kind: InitialScrollSessionKind = state.initialScrollSession?.kind ?? "bootstrap",
) {
    if (!state.initialScrollSession) {
        state.initialScrollSession = createInitialScrollSession({
            completion: {},
            kind,
            previousDataLength: 0,
        }) as InitialScrollSession;
    } else if (state.initialScrollSession.kind !== kind) {
        state.initialScrollSession = createInitialScrollSession({
            bootstrap:
                state.initialScrollSession.kind === "bootstrap" ? state.initialScrollSession.bootstrap : undefined,
            completion: state.initialScrollSession.completion,
            kind,
            previousDataLength: state.initialScrollSession.previousDataLength,
        });
    }

    state.initialScrollSession.completion ??= {};
    return state.initialScrollSession.completion;
}

export const initialScrollCompletion = {
    didDispatchNativeScroll(state: InternalState) {
        return !!state.initialScrollSession?.completion?.didDispatchNativeScroll;
    },
    didRetrySilentInitialScroll(state: InternalState) {
        return !!state.initialScrollSession?.completion?.didRetrySilentInitialScroll;
    },
    markInitialScrollNativeDispatch(state: InternalState) {
        ensureInitialScrollSessionCompletion(state).didDispatchNativeScroll = true;
    },
    markSilentInitialScrollRetry(state: InternalState) {
        ensureInitialScrollSessionCompletion(state).didRetrySilentInitialScroll = true;
    },
    resetFlags(state: InternalState) {
        if (!state.initialScrollSession) {
            return;
        }

        const completion = ensureInitialScrollSessionCompletion(state, state.initialScrollSession.kind);
        completion.didDispatchNativeScroll = undefined;
        completion.didRetrySilentInitialScroll = undefined;
    },
};

export const initialScrollWatchdog = {
    clear(state: InternalState) {
        initialScrollWatchdog.set(state, undefined);
    },
    didReachTarget(newScroll: number, watchdog: NonNullable<InitialScrollWatchdog>) {
        const nextDistance = Math.abs(newScroll - watchdog.targetOffset);
        return nextDistance <= INITIAL_SCROLL_MIN_TARGET_OFFSET;
    },
    get(state: InternalState) {
        return state.initialScrollSession?.completion?.watchdog;
    },
    hasNonZeroTargetOffset(targetOffset: number | undefined) {
        return targetOffset !== undefined && targetOffset > INITIAL_SCROLL_MIN_TARGET_OFFSET;
    },
    isAtZeroTargetOffset(targetOffset: number) {
        return targetOffset <= INITIAL_SCROLL_MIN_TARGET_OFFSET;
    },
    set(state: InternalState, watchdog: InitialScrollWatchdog) {
        if (!watchdog && !state.initialScrollSession?.completion?.watchdog) {
            return;
        }

        const completion = ensureInitialScrollSessionCompletion(state);
        completion.watchdog = watchdog
            ? {
                  startScroll: watchdog.startScroll,
                  targetOffset: watchdog.targetOffset,
              }
            : undefined;
    },
};

export function setInitialScrollSession(state: InternalState, options: SyncInitialScrollSessionOptions = {}) {
    const existingSession = state.initialScrollSession;
    const kind = options.kind ?? existingSession?.kind;
    const completion = existingSession?.completion;
    const existingBootstrap = existingSession?.kind === "bootstrap" ? existingSession.bootstrap : undefined;
    const bootstrap =
        kind === "bootstrap"
            ? options.bootstrap === null
                ? undefined
                : (options.bootstrap ?? existingBootstrap)
            : undefined;

    if (!kind) {
        return clearInitialScrollSession(state);
    }

    if (!state.initialScroll && !bootstrap && !hasInitialScrollSessionCompletion(completion)) {
        return clearInitialScrollSession(state);
    }

    const previousDataLength = options.previousDataLength ?? existingSession?.previousDataLength ?? 0;

    state.initialScrollSession = createInitialScrollSession({
        bootstrap,
        completion,
        kind,
        previousDataLength,
    });

    return state.initialScrollSession;
}
