import type { InternalState } from "@/types.base";

type InitialScrollSession = NonNullable<InternalState["initialScrollSession"]>;
type InitialScrollSessionCompletion = NonNullable<InitialScrollSession["completion"]>;
type InitialScrollSessionKind = InitialScrollSession["kind"];
type BootstrapInitialScrollSession = NonNullable<Extract<InitialScrollSession, { kind: "bootstrap" }>["bootstrap"]>;
type InitialScrollWatchdog = InitialScrollSessionCompletion["watchdog"];
export const INITIAL_SCROLL_MIN_TARGET_OFFSET = 1;

function hasInitialScrollSessionCompletion(completion: InitialScrollSessionCompletion | undefined) {
    return !!(completion?.didDispatchNativeScroll || completion?.didRetrySilentInitialScroll || completion?.watchdog);
}

type SyncInitialScrollSessionOptions = {
    bootstrap?: BootstrapInitialScrollSession;
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

function ensureInitialScrollSessionCompletion(state: InternalState, kind: InitialScrollSessionKind = "bootstrap") {
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
        ensureInitialScrollSessionCompletion(state, "bootstrap").didDispatchNativeScroll = true;
    },
    markSilentInitialScrollRetry(state: InternalState) {
        ensureInitialScrollSessionCompletion(state, "bootstrap").didRetrySilentInitialScroll = true;
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
    get(state: InternalState) {
        return state.initialScrollSession?.completion?.watchdog;
    },
    set(state: InternalState, watchdog: InitialScrollWatchdog) {
        if (!watchdog && !state.initialScrollSession?.completion?.watchdog) {
            return;
        }

        const completion = ensureInitialScrollSessionCompletion(state, "bootstrap");
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

    state.initialScrollSession = createInitialScrollSession({
        bootstrap,
        completion,
        kind,
        previousDataLength,
    });

    return state.initialScrollSession;
}
