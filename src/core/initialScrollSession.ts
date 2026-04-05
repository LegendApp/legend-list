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
