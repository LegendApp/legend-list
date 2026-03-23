import { calculateOffsetForIndex } from "@/core/calculateOffsetForIndex";
import { calculateOffsetWithOffsetPosition } from "@/core/calculateOffsetWithOffsetPosition";
import { clampScrollOffset } from "@/core/clampScrollOffset";
import type { StateContext } from "@/state/state";
import type { InternalState, ScrollIndexWithOffsetAndContentOffset } from "@/types.base";
import type { InitialBootstrapState } from "@/typesInternal";
import { getId } from "@/utils/getId";
import { setInitialRenderState } from "@/utils/setInitialRenderState";

const INITIAL_BOOTSTRAP_RECALCULATE_TIMEOUT_MS = 48;

function createInitialBootstrapState(
    target: ScrollIndexWithOffsetAndContentOffset | undefined,
    usesOffset: boolean,
): InitialBootstrapState | undefined {
    if (!target || usesOffset || target.index === undefined) {
        return undefined;
    }

    return {
        active: false,
        desiredOffset: target.contentOffset,
        desiredAnchorOffset: target.contentOffset,
        bootstrapVisualOffset: 0,
        observedNativeScroll: false,
        pendingRebase: false,
        stableFrames: 0,
        anchorIndexHint: target.index,
        anchorKey: undefined,
        anchorViewOffset: target.viewOffset ?? 0,
        anchorViewPosition: target.viewPosition ?? 0,
        targetIndexHint: target.index,
        targetKey: undefined,
        viewOffset: target.viewOffset ?? 0,
        viewPosition: target.viewPosition ?? 0,
    };
}

export function setInitialScrollTarget(
    state: InternalState,
    target: ScrollIndexWithOffsetAndContentOffset | undefined,
    options?: {
        resetDidFinish?: boolean;
        resolvedOffset?: number;
        usesOffset?: boolean;
    },
) {
    const usesOffset = !!options?.usesOffset;
    const nextTarget =
        target && options?.resolvedOffset !== undefined ? { ...target, contentOffset: options.resolvedOffset } : target;

    state.initialScrollUsesOffset = !!nextTarget && usesOffset;
    state.initialScroll = nextTarget;
    state.initialBootstrap = createInitialBootstrapState(nextTarget, state.initialScrollUsesOffset);

    if (options?.resetDidFinish && state.didFinishInitialScroll) {
        state.didFinishInitialScroll = false;
    }
}

export function isInitialBootstrapActive(
    state: Pick<InternalState, "initialBootstrap">,
): state is Pick<InternalState, "initialBootstrap"> & { initialBootstrap: InitialBootstrapState } {
    return !!state.initialBootstrap?.active;
}

export function getInitialBootstrapTargetIndex(state: Pick<InternalState, "indexByKey" | "initialBootstrap">) {
    const bootstrap = state.initialBootstrap;
    if (!bootstrap) {
        return undefined;
    }

    if (bootstrap.targetKey) {
        return state.indexByKey.get(bootstrap.targetKey);
    }

    return bootstrap.targetIndexHint;
}

function getInitialBootstrapTargetKey(state: Pick<InternalState, "indexByKey" | "initialBootstrap" | "props">) {
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

function syncInitialBootstrapTarget(state: InternalState) {
    const bootstrap = state.initialBootstrap;
    if (!bootstrap) {
        return;
    }

    bootstrap.targetKey ??= getInitialBootstrapTargetKey(state);
    bootstrap.anchorKey ??= bootstrap.targetKey;
    if (bootstrap.targetKey) {
        bootstrap.targetIndexHint = state.indexByKey.get(bootstrap.targetKey) ?? bootstrap.targetIndexHint;
        bootstrap.anchorIndexHint = bootstrap.targetIndexHint;
    }
}

export function getInitialBootstrapEffectiveScroll(
    state: Pick<InternalState, "initialBootstrap" | "scroll">,
) {
    return state.scroll + (state.initialBootstrap?.active ? state.initialBootstrap.bootstrapVisualOffset : 0);
}

export function syncInitialBootstrapDesiredOffset(
    state: Pick<InternalState, "initialBootstrap">,
    desiredOffset: number | undefined,
    options?: { adjustVisualOffset?: boolean },
) {
    const bootstrap = state.initialBootstrap;
    if (!bootstrap) {
        return;
    }

    const previousDesiredOffset = bootstrap.desiredAnchorOffset ?? bootstrap.desiredOffset;
    if (
        options?.adjustVisualOffset &&
        desiredOffset !== undefined &&
        previousDesiredOffset !== undefined &&
        Math.abs(desiredOffset - previousDesiredOffset) > 0.5
    ) {
        bootstrap.bootstrapVisualOffset += desiredOffset - previousDesiredOffset;
    }

    bootstrap.desiredOffset = desiredOffset;
    bootstrap.desiredAnchorOffset = desiredOffset;
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
        viewOffset: bootstrap.anchorViewOffset ?? bootstrap.viewOffset,
        viewPosition: bootstrap.anchorViewPosition ?? bootstrap.viewPosition,
    });
}

export function resolveClampedInitialBootstrapDesiredOffset(ctx: StateContext) {
    const { state } = ctx;
    const bootstrap = state.initialBootstrap;
    const index = getInitialBootstrapTargetIndex(state);
    const desiredOffset = resolveInitialBootstrapDesiredOffset(ctx);
    if (!bootstrap || index === undefined || desiredOffset === undefined) {
        return undefined;
    }

    return clampScrollOffset(ctx, desiredOffset, {
        index,
        offset: desiredOffset,
        viewOffset: bootstrap.anchorViewOffset ?? bootstrap.viewOffset,
        viewPosition: bootstrap.anchorViewPosition ?? bootstrap.viewPosition,
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
    bootstrap.observedNativeScroll = false;
    bootstrap.pendingRebase = false;
    syncInitialBootstrapDesiredOffset(state, desiredOffset ?? resolveInitialBootstrapDesiredOffset(ctx));
    bootstrap.bootstrapVisualOffset = (bootstrap.desiredAnchorOffset ?? 0) - state.scroll;
    return true;
}

export function queueInitialBootstrapRecalculate(ctx: StateContext) {
    const { state } = ctx;
    if (
        state.queuedInitialBootstrapRecalculate !== undefined ||
        state.queuedInitialBootstrapRecalculateTimeout !== undefined
    ) {
        return;
    }

    const runQueuedRecalculate = () => {
        state.queuedInitialBootstrapRecalculate = undefined;
        if (state.queuedInitialBootstrapRecalculateTimeout !== undefined) {
            clearTimeout(state.queuedInitialBootstrapRecalculateTimeout);
            state.queuedInitialBootstrapRecalculateTimeout = undefined;
        }

        if (!state.initialBootstrap?.active || state.didFinishInitialScroll) {
            return;
        }

        state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
    };

    state.queuedInitialBootstrapRecalculate = requestAnimationFrame(() => {
        runQueuedRecalculate();
    });
    state.queuedInitialBootstrapRecalculateTimeout = setTimeout(() => {
        runQueuedRecalculate();
    }, INITIAL_BOOTSTRAP_RECALCULATE_TIMEOUT_MS);
}

export function clearQueuedInitialBootstrapRecalculate(state: InternalState) {
    if (state.queuedInitialBootstrapRecalculate !== undefined) {
        if (typeof cancelAnimationFrame === "function") {
            cancelAnimationFrame(state.queuedInitialBootstrapRecalculate);
        } else {
            clearTimeout(state.queuedInitialBootstrapRecalculate);
        }
        state.queuedInitialBootstrapRecalculate = undefined;
    }
    if (state.queuedInitialBootstrapRecalculateTimeout !== undefined) {
        clearTimeout(state.queuedInitialBootstrapRecalculateTimeout);
        state.queuedInitialBootstrapRecalculateTimeout = undefined;
    }
}

function deactivateInitialBootstrap(state: InternalState) {
    if (!state.initialBootstrap) {
        return;
    }

    state.initialBootstrap.active = false;
    state.initialBootstrap.pendingRebase = false;
}

function clearInitialBootstrapDeferredState(state: InternalState) {
    if (state.initialBootstrap) {
        state.initialBootstrap.bootstrapVisualOffset = 0;
    }
    state.deferredPositionDelta = 0;
    state.pendingDeferredSizeShift = 0;
}

function rebaseInitialBootstrapProjection(state: InternalState) {
    const bootstrapVisualOffset = state.initialBootstrap?.bootstrapVisualOffset ?? 0;
    if (Math.abs(bootstrapVisualOffset) <= 0.1) {
        return;
    }

    state.deferredPositionDelta += bootstrapVisualOffset;
    if (state.initialBootstrap) {
        state.initialBootstrap.bootstrapVisualOffset = 0;
        state.initialBootstrap.pendingRebase = false;
    }
}

export function finishInitialBootstrap(ctx: StateContext) {
    clearQueuedInitialBootstrapRecalculate(ctx.state);
    rebaseInitialBootstrapProjection(ctx.state);
    deactivateInitialBootstrap(ctx.state);
    setInitialRenderState(ctx, { didInitialScroll: true });
}

export function cancelInitialBootstrap(ctx: StateContext) {
    const { state } = ctx;
    if (!state.initialBootstrap) {
        return;
    }

    clearInitialBootstrapDeferredState(state);
    finishInitialBootstrap(ctx);
}
