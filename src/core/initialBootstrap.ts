import { calculateOffsetForIndex } from "@/core/calculateOffsetForIndex";
import { calculateOffsetWithOffsetPosition } from "@/core/calculateOffsetWithOffsetPosition";
import { clampScrollOffset } from "@/core/clampScrollOffset";
import { logInitialScrollTrace } from "@/core/logInitialScrollTrace";
import { peek$, type StateContext } from "@/state/state";
import type {
    InitialBootstrapState,
    InternalState,
    ScrollIndexWithOffsetAndContentOffset,
} from "@/types.base";
import { getId } from "@/utils/getId";
import { setInitialRenderState } from "@/utils/setInitialRenderState";

const INITIAL_BOOTSTRAP_RECALCULATE_TIMEOUT_MS = 48;

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
    bootstrap.desiredOffset = desiredOffset ?? resolveInitialBootstrapDesiredOffset(ctx);
    logInitialScrollTrace(ctx, "initialBootstrap:activate", {
        readyToRender: peek$(ctx, "readyToRender"),
    });
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

    const runQueuedRecalculate = (source: "raf" | "timeout") => {
        state.queuedInitialBootstrapRecalculate = undefined;
        if (state.queuedInitialBootstrapRecalculateTimeout !== undefined) {
            clearTimeout(state.queuedInitialBootstrapRecalculateTimeout);
            state.queuedInitialBootstrapRecalculateTimeout = undefined;
        }

        if (!state.initialBootstrap?.active || state.didFinishInitialScroll) {
            return;
        }

        logInitialScrollTrace(ctx, "initialBootstrap:recalculate-tick", {
            source,
        });
        state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
    };

    state.queuedInitialBootstrapRecalculate = requestAnimationFrame(() => {
        runQueuedRecalculate("raf");
    });
    state.queuedInitialBootstrapRecalculateTimeout = setTimeout(() => {
        runQueuedRecalculate("timeout");
    }, INITIAL_BOOTSTRAP_RECALCULATE_TIMEOUT_MS);

    logInitialScrollTrace(ctx, "initialBootstrap:recalculate-scheduled", {
        timeoutMs: INITIAL_BOOTSTRAP_RECALCULATE_TIMEOUT_MS,
    });
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
    state.deferredPositionDelta = 0;
    state.pendingDeferredSizeShift = 0;
}

export function finishInitialBootstrap(ctx: StateContext) {
    clearQueuedInitialBootstrapRecalculate(ctx.state);
    deactivateInitialBootstrap(ctx.state);
    logInitialScrollTrace(ctx, "initialBootstrap:finish", {
        readyToRender: peek$(ctx, "readyToRender"),
    });
    setInitialRenderState(ctx, { didInitialScroll: true });
}

export function cancelInitialBootstrap(ctx: StateContext) {
    const { state } = ctx;
    if (!state.initialBootstrap) {
        return;
    }

    clearQueuedInitialBootstrapRecalculate(state);
    deactivateInitialBootstrap(state);
    clearInitialBootstrapDeferredState(state);
    logInitialScrollTrace(ctx, "initialBootstrap:cancel", {
        readyToRender: peek$(ctx, "readyToRender"),
    });
    finishInitialBootstrap(ctx);
}
