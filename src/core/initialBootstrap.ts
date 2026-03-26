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
        bootstrapVisualOffset: 0,
        desiredOffset: target.contentOffset,
        pendingRebase: false,
        stableFrames: 0,
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

export function getInitialBootstrapProjectionOffset(state: Pick<InternalState, "initialBootstrap">) {
    const bootstrap = state.initialBootstrap;
    if (!bootstrap) {
        return 0;
    }

    return bootstrap.active || bootstrap.pendingRebase ? bootstrap.bootstrapVisualOffset : 0;
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
    if (bootstrap.targetKey) {
        bootstrap.targetIndexHint = state.indexByKey.get(bootstrap.targetKey) ?? bootstrap.targetIndexHint;
    }
}

export function getInitialBootstrapEffectiveScroll(state: Pick<InternalState, "initialBootstrap" | "scroll">) {
    return state.scroll + getInitialBootstrapProjectionOffset(state);
}

export function canUseInitialBootstrapProjection(state: Pick<InternalState, "initialBootstrap" | "props">) {
    return !!state.initialBootstrap && !state.props.horizontal && state.props.numColumns === 1;
}

export function ownsInitialScrollWithBootstrap(
    state: Pick<InternalState, "initialBootstrap" | "initialScrollUsesOffset" | "props">,
) {
    return !state.initialScrollUsesOffset && canUseInitialBootstrapProjection(state);
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

    const previousDesiredOffset = bootstrap.desiredOffset;
    if (
        options?.adjustVisualOffset &&
        desiredOffset !== undefined &&
        previousDesiredOffset !== undefined &&
        Math.abs(desiredOffset - previousDesiredOffset) > 0.5
    ) {
        bootstrap.bootstrapVisualOffset += desiredOffset - previousDesiredOffset;
    }

    bootstrap.desiredOffset = desiredOffset;
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
    bootstrap.pendingRebase = false;
    syncInitialBootstrapDesiredOffset(state, desiredOffset ?? resolveInitialBootstrapDesiredOffset(ctx));
    bootstrap.bootstrapVisualOffset = (bootstrap.desiredOffset ?? 0) - state.scroll;
    return true;
}

export function ensureInitialBootstrapActive(ctx: StateContext, desiredOffset?: number) {
    const { state } = ctx;
    if (!ownsInitialScrollWithBootstrap(state) || !state.initialBootstrap) {
        return false;
    }

    if (!state.initialBootstrap.active) {
        return activateInitialBootstrap(ctx, desiredOffset);
    }

    syncInitialBootstrapTarget(state);
    state.initialBootstrap.pendingRebase = false;

    const resolvedDesiredOffset = desiredOffset ?? resolveInitialBootstrapDesiredOffset(ctx);
    const previousDesiredOffset = state.initialBootstrap.desiredOffset;
    syncInitialBootstrapDesiredOffset(state, resolvedDesiredOffset, { adjustVisualOffset: true });
    if (
        resolvedDesiredOffset !== undefined &&
        previousDesiredOffset !== undefined &&
        Math.abs(resolvedDesiredOffset - previousDesiredOffset) > 0.5
    ) {
        state.initialBootstrap.stableFrames = 0;
    }

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
    if (!state.initialBootstrap) {
        return;
    }

    if (Math.abs(bootstrapVisualOffset) <= 0.1) {
        state.initialBootstrap.bootstrapVisualOffset = 0;
        state.initialBootstrap.pendingRebase = false;
        return;
    }
    state.initialBootstrap.pendingRebase = true;
}

export function finishInitialBootstrap(ctx: StateContext) {
    clearQueuedInitialBootstrapRecalculate(ctx.state);
    rebaseInitialBootstrapProjection(ctx.state);
    deactivateInitialBootstrap(ctx.state);
    ctx.state.initialScroll = undefined;
    ctx.state.initialScrollUsesOffset = false;
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
