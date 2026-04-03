import type { BootstrapInitialScrollSession, InternalState } from "@/types.base";

export function getBootstrapInitialScrollSession(
    state: InternalState,
): BootstrapInitialScrollSession | undefined {
    return state.bootstrapInitialScroll;
}

export function hasBootstrapInitialScrollSession(state: InternalState) {
    return !!getBootstrapInitialScrollSession(state);
}

export function getBootstrapInitialScrollOffset(state: InternalState) {
    return getBootstrapInitialScrollSession(state)?.scroll;
}

export function getBootstrapInitialScrollTargetIndexSeed(state: InternalState) {
    return getBootstrapInitialScrollSession(state)?.targetIndexSeed;
}
