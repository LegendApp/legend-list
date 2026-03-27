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
        commitStableFrames: 0,
        commitTargetOffset: undefined,
        didObservePlatformScroll: false,
        expectsObservedPlatformSettle: false,
        observedPlatformScrollOffset: undefined,
        observedPlatformScrollStableFrames: 0,
        phase: "inactive",
        projectionOffset: 0,
        previousObservedPlatformScrollOffset: undefined,
        stableFrames: 0,
        target: {
            desiredOffset: target.contentOffset,
            indexHint: target.index,
            key: undefined,
            viewOffset: target.viewOffset ?? 0,
            viewPosition: target.viewPosition ?? 0,
        },
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
    return !!state.initialBootstrap && state.initialBootstrap.phase !== "inactive";
}

export function getInitialBootstrapProjectionOffset(state: Pick<InternalState, "initialBootstrap">) {
    const bootstrap = state.initialBootstrap;
    if (!bootstrap) {
        return 0;
    }

    return bootstrap.phase === "inactive" ? 0 : bootstrap.projectionOffset;
}

export function getInitialBootstrapTargetIndex(state: Pick<InternalState, "indexByKey" | "initialBootstrap">) {
    const bootstrap = state.initialBootstrap;
    if (!bootstrap) {
        return undefined;
    }

    if (bootstrap.target.key) {
        return state.indexByKey.get(bootstrap.target.key);
    }

    return bootstrap.target.indexHint;
}

function getInitialBootstrapTargetKey(state: Pick<InternalState, "indexByKey" | "initialBootstrap" | "props">) {
    const bootstrap = state.initialBootstrap;
    if (!bootstrap) {
        return undefined;
    }

    if (bootstrap.target.key) {
        return bootstrap.target.key;
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

    bootstrap.target.key ??= getInitialBootstrapTargetKey(state);
    if (bootstrap.target.key) {
        bootstrap.target.indexHint = state.indexByKey.get(bootstrap.target.key) ?? bootstrap.target.indexHint;
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

    const previousDesiredOffset = bootstrap.target.desiredOffset;
    if (
        options?.adjustVisualOffset &&
        desiredOffset !== undefined &&
        previousDesiredOffset !== undefined &&
        Math.abs(desiredOffset - previousDesiredOffset) > 0.5
    ) {
        bootstrap.projectionOffset += desiredOffset - previousDesiredOffset;
        bootstrap.commitTargetOffset = undefined;
        bootstrap.commitStableFrames = 0;
    }

    bootstrap.target.desiredOffset = desiredOffset;
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
        viewOffset: bootstrap.target.viewOffset,
        viewPosition: bootstrap.target.viewPosition,
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
        viewOffset: bootstrap.target.viewOffset,
        viewPosition: bootstrap.target.viewPosition,
    });
}

export function activateInitialBootstrap(ctx: StateContext, desiredOffset?: number) {
    const { state } = ctx;
    const bootstrap = state.initialBootstrap;
    if (!bootstrap) {
        return false;
    }

    syncInitialBootstrapTarget(state);
    bootstrap.phase = "projecting";
    bootstrap.didObservePlatformScroll = false;
    bootstrap.observedPlatformScrollOffset = undefined;
    bootstrap.observedPlatformScrollStableFrames = 0;
    bootstrap.previousObservedPlatformScrollOffset = undefined;
    bootstrap.commitStableFrames = 0;
    bootstrap.commitTargetOffset = undefined;
    bootstrap.expectsObservedPlatformSettle = false;
    bootstrap.stableFrames = 0;
    syncInitialBootstrapDesiredOffset(state, desiredOffset ?? resolveInitialBootstrapDesiredOffset(ctx));
    bootstrap.projectionOffset = (bootstrap.target.desiredOffset ?? 0) - state.scroll;
    return true;
}

export function ensureInitialBootstrapActive(ctx: StateContext, desiredOffset?: number) {
    const { state } = ctx;
    if (!ownsInitialScrollWithBootstrap(state) || !state.initialBootstrap) {
        return false;
    }

    if (!isInitialBootstrapActive(state)) {
        return activateInitialBootstrap(ctx, desiredOffset);
    }

    syncInitialBootstrapTarget(state);

    const resolvedDesiredOffset = desiredOffset ?? resolveInitialBootstrapDesiredOffset(ctx);
    const previousDesiredOffset = state.initialBootstrap.target.desiredOffset;
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

export function syncInitialBootstrapObservedPlatformScroll(
    state: Pick<InternalState, "initialBootstrap">,
    observedOffset: number,
) {
    const bootstrap = state.initialBootstrap;
    if (!bootstrap) {
        return false;
    }

    const previousObservedOffset = bootstrap.observedPlatformScrollOffset;
    const didObservedOffsetChange =
        previousObservedOffset === undefined || Math.abs(observedOffset - previousObservedOffset) > 0.5;

    bootstrap.didObservePlatformScroll = true;
    bootstrap.expectsObservedPlatformSettle = true;
    bootstrap.observedPlatformScrollOffset = observedOffset;

    if (didObservedOffsetChange) {
        bootstrap.commitStableFrames = 0;
        bootstrap.observedPlatformScrollStableFrames = 0;
        bootstrap.previousObservedPlatformScrollOffset = undefined;
        bootstrap.stableFrames = 0;
    }

    if (bootstrap.target.desiredOffset !== undefined) {
        bootstrap.projectionOffset = bootstrap.target.desiredOffset - observedOffset;
    }

    return didObservedOffsetChange;
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

        if (!isInitialBootstrapActive(state) || state.didFinishInitialScroll) {
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

    state.initialBootstrap.phase = "inactive";
}

function clearInitialBootstrapDeferredState(state: InternalState) {
    if (state.initialBootstrap) {
        state.initialBootstrap.projectionOffset = 0;
        state.initialBootstrap.commitStableFrames = 0;
        state.initialBootstrap.commitTargetOffset = undefined;
    }
    state.deferredPositionDelta = 0;
    state.pendingDeferredSizeShift = 0;
}

function clearInitialBootstrapCommitState(state: InternalState) {
    if (!state.initialBootstrap) {
        return;
    }
    state.initialBootstrap.commitStableFrames = 0;
    state.initialBootstrap.commitTargetOffset = undefined;
}

export function dispatchInitialBootstrapCommitScroll(ctx: StateContext, offset: number) {
    const { state } = ctx;
    const bootstrap = state.initialBootstrap;
    const scroller = state.refScroller.current;
    if (!bootstrap || !scroller) {
        return false;
    }

    bootstrap.phase = "committing";
    bootstrap.commitTargetOffset = offset;
    bootstrap.commitStableFrames = 0;
    bootstrap.didObservePlatformScroll = false;
    bootstrap.observedPlatformScrollOffset = undefined;
    bootstrap.observedPlatformScrollStableFrames = 0;
    bootstrap.previousObservedPlatformScrollOffset = undefined;
    bootstrap.projectionOffset = (bootstrap.target.desiredOffset ?? offset) - offset;

    state.scrollHistory.length = 0;
    state.didDispatchNativeScroll = true;
    state.scrollPending = offset;
    state.scroll = offset;

    scroller.scrollTo({
        animated: false,
        x: state.props.horizontal ? offset : 0,
        y: state.props.horizontal ? 0 : offset,
    });

    queueInitialBootstrapRecalculate(ctx);
    return true;
}

export function finishInitialBootstrap(ctx: StateContext) {
    clearQueuedInitialBootstrapRecalculate(ctx.state);
    clearInitialBootstrapCommitState(ctx.state);
    if (ctx.state.initialBootstrap) {
        ctx.state.initialBootstrap.projectionOffset = 0;
    }
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
