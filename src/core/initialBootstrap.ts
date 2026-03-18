import { calculateOffsetForIndex } from "@/core/calculateOffsetForIndex";
import { calculateOffsetWithOffsetPosition } from "@/core/calculateOffsetWithOffsetPosition";
import type { StateContext } from "@/state/state";
import type {
    InitialBootstrapState,
    InternalState,
    ScrollIndexWithOffsetAndContentOffset,
} from "@/types.base";
import { getId } from "@/utils/getId";

export function createInitialBootstrapState(
    target: ScrollIndexWithOffsetAndContentOffset | undefined,
    usesOffset: boolean,
): InitialBootstrapState | undefined {
    if (!target || usesOffset || target.index === undefined) {
        return undefined;
    }

    return {
        active: false,
        desiredOffset: target.contentOffset,
        stableFrames: 0,
        targetIndexHint: target.index,
        targetKey: undefined,
        viewOffset: target.viewOffset ?? 0,
        viewPosition: target.viewPosition ?? 0,
    };
}

export function isInitialBootstrapActive(
    state: Pick<InternalState, "initialBootstrap">,
): state is Pick<InternalState, "initialBootstrap"> & { initialBootstrap: InitialBootstrapState } {
    return !!state.initialBootstrap?.active;
}

export function getInitialBootstrapTargetIndex(
    state: Pick<InternalState, "indexByKey" | "initialBootstrap">,
) {
    const bootstrap = state.initialBootstrap;
    if (!bootstrap) {
        return undefined;
    }

    if (bootstrap.targetKey) {
        return state.indexByKey.get(bootstrap.targetKey);
    }

    return bootstrap.targetIndexHint;
}

export function getInitialBootstrapTargetKey(
    state: Pick<InternalState, "indexByKey" | "initialBootstrap" | "props">,
) {
    const bootstrap = state.initialBootstrap;
    if (!bootstrap) {
        return undefined;
    }

    if (bootstrap.targetKey) {
        return bootstrap.targetKey;
    }

    const index = getInitialBootstrapTargetIndex(state);
    if (index === undefined || index < 0 || index >= state.props.data.length) {
        return undefined;
    }

    return getId(state as InternalState, index);
}

export function syncInitialBootstrapTarget(state: InternalState) {
    const bootstrap = state.initialBootstrap;
    if (!bootstrap) {
        return;
    }

    bootstrap.targetKey ??= getInitialBootstrapTargetKey(state);
    if (bootstrap.targetKey) {
        bootstrap.targetIndexHint = state.indexByKey.get(bootstrap.targetKey) ?? bootstrap.targetIndexHint;
    }
}

export function getInitialBootstrapEffectiveScroll(
    state: Pick<InternalState, "deferredPositionDelta" | "initialBootstrap" | "scroll">,
) {
    return state.scroll + (state.initialBootstrap?.active ? state.deferredPositionDelta : 0);
}

export function resolveInitialBootstrapDesiredOffset(ctx: StateContext) {
    const { state } = ctx;
    const bootstrap = state.initialBootstrap;
    const index = getInitialBootstrapTargetIndex(state);
    if (!bootstrap || index === undefined) {
        return undefined;
    }

    const baseOffset = calculateOffsetForIndex(ctx, index);
    return calculateOffsetWithOffsetPosition(ctx, baseOffset, {
        index,
        viewOffset: bootstrap.viewOffset,
        viewPosition: bootstrap.viewPosition,
    });
}

export function activateInitialBootstrap(ctx: StateContext, desiredOffset?: number) {
    const { state } = ctx;
    const bootstrap = state.initialBootstrap;
    if (!bootstrap) {
        return false;
    }

    syncInitialBootstrapTarget(state);
    bootstrap.active = true;
    bootstrap.stableFrames = 0;
    bootstrap.desiredOffset = desiredOffset ?? resolveInitialBootstrapDesiredOffset(ctx);
    return true;
}
