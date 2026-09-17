import type { InternalState } from "@/types.internal";

type InitialScrollSession = NonNullable<InternalState["initialScroll"]>;
type InitialScrollSessionCompletion = NonNullable<InitialScrollSession["completion"]>;
type InitialScrollWatchdog = InitialScrollSessionCompletion["watchdog"];
const INITIAL_SCROLL_MIN_TARGET_OFFSET = 1;

function ensureInitialScrollSessionCompletion(state: InternalState) {
    if (!state.initialScroll) return undefined;
    state.initialScroll.completion ??= {};
    return state.initialScroll.completion;
}

export const initialScrollCompletion = {
    didDispatchNativeScroll(state: InternalState) {
        return !!state.initialScroll?.completion?.didDispatchNativeScroll;
    },
    didRetrySilentInitialScroll(state: InternalState) {
        return !!state.initialScroll?.completion?.didRetrySilentInitialScroll;
    },
    markInitialScrollNativeDispatch(state: InternalState) {
        const completion = ensureInitialScrollSessionCompletion(state);
        if (completion) completion.didDispatchNativeScroll = true;
    },
    markSilentInitialScrollRetry(state: InternalState) {
        const completion = ensureInitialScrollSessionCompletion(state);
        if (completion) completion.didRetrySilentInitialScroll = true;
    },
    resetFlags(state: InternalState) {
        const completion = state.initialScroll?.completion;
        if (!completion) return;
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
        return state.initialScroll?.completion?.watchdog;
    },
    hasNonZeroTargetOffset(targetOffset: number | undefined) {
        return targetOffset !== undefined && targetOffset > INITIAL_SCROLL_MIN_TARGET_OFFSET;
    },
    isAtZeroTargetOffset(targetOffset: number) {
        return targetOffset <= INITIAL_SCROLL_MIN_TARGET_OFFSET;
    },
    set(state: InternalState, watchdog: InitialScrollWatchdog) {
        if (!watchdog && !state.initialScroll?.completion?.watchdog) {
            return;
        }

        const completion = ensureInitialScrollSessionCompletion(state);
        if (!completion) return;
        completion.watchdog = watchdog;
    },
};
