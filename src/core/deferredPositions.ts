import { calculateOffsetWithOffsetPosition } from "@/core/calculateOffsetWithOffsetPosition";
import { clampScrollOffset } from "@/core/clampScrollOffset";
import {
    getDebugDeferredInteraction,
    logDebugDeferredInteraction,
    updateDebugDeferredInteraction,
} from "@/core/debugDeferredInteraction";
import { notifyPosition$, set$, type StateContext } from "@/state/state";
import type { DeferredPositionsState } from "@/types";
import type { InternalState } from "@/types.base";
import { scrollTo } from "@/core/scrollTo";
import { updateItemPositions } from "@/core/updateItemPositions";
import { getId } from "@/utils/getId";
import { getItemSize } from "@/utils/getItemSize";
import { checkAllSizesKnown } from "@/utils/checkAllSizesKnown";
import { requestAdjust } from "@/utils/requestAdjust";
import { setInitialRenderState } from "@/utils/setInitialRenderState";

export type DeferredPositionsFlushReason =
    | "anchorInvalid"
    | "dataChange"
    | "exactOffsetRead"
    | "explicit"
    | "visibleInteraction"
    | "scrollUnsafe"
    | "settled";

export function beginDeferredPositions(ctx: StateContext, params: DeferredPositionsState) {
    const existing = ctx.state.deferredPositions;
    if (existing?.isFinalizing) {
        finalizeDeferredPositions(ctx);
    }
    const nextState =
        existing && existing.anchorKey === params.anchorKey
            ? {
                  ...existing,
                  ...params,
                  drift: existing.drift,
                  minInvalidatedIndex: Math.min(existing.minInvalidatedIndex, params.minInvalidatedIndex),
              }
            : { ...params };
    ctx.state.deferredPositions = nextState;
    console.log(`${Date.now()} [debug initial-blank] beginDeferredPositions`, nextState);
    return nextState;
}

export function isDeferredPositionsActive(state: InternalState) {
    return !!state.userScrollActive || !!state.scrollingTo || !!state.initialScroll;
}

export function getDeferredAnchorIndex(ctx: StateContext) {
    const anchorKey = ctx.state.deferredPositions?.anchorKey;
    return anchorKey ? ctx.state.indexByKey.get(anchorKey) : undefined;
}

export function applyDeferredResizeDelta(ctx: StateContext, itemKey: string, diff: number) {
    const deferred = ctx.state.deferredPositions;
    if (!deferred || deferred.isFinalizing || diff === 0) {
        return false;
    }

    const changedIndex = ctx.state.indexByKey.get(itemKey);
    const anchorIndex = getDeferredAnchorIndex(ctx);
    if (changedIndex === undefined || anchorIndex === undefined) {
        console.log(`${Date.now()} [debug deferred-anchor] applyDeferredResizeDelta:clear-invalid-anchor`, {
            anchorIndex,
            changedIndex,
            deferredAnchorKey: deferred.anchorKey,
            diff,
            itemKey,
        });
        ctx.state.deferredPositions = undefined;
        return false;
    }

    if (changedIndex >= anchorIndex) {
        console.log(`${Date.now()} [debug deferred-anchor] applyDeferredResizeDelta:skip-at-or-below-anchor`, {
            anchorIndex,
            changedIndex,
            deferredAnchorKey: deferred.anchorKey,
            diff,
            drift: deferred.drift,
            itemKey,
        });
        return false;
    }

    deferred.drift += diff;
    deferred.minInvalidatedIndex = Math.min(deferred.minInvalidatedIndex, changedIndex + 1);
    console.log(`${Date.now()} [debug deferred-anchor] applyDeferredResizeDelta:applied`, {
        anchorIndex,
        changedIndex,
        deferredAnchorKey: deferred.anchorKey,
        diff,
        drift: deferred.drift,
        itemKey,
        minInvalidatedIndex: deferred.minInvalidatedIndex,
    });
    return true;
}

export function getDeferredRenderPosition(
    ctx: StateContext,
    index: number,
    cache?: Map<number, number>,
) {
    const { positions, deferredPositions } = ctx.state;
    if (!deferredPositions) {
        return positions[index];
    }

    const anchorIndex = getDeferredAnchorIndex(ctx);
    if (anchorIndex === undefined) {
        return positions[index];
    }

    if (index === anchorIndex) {
        cache?.set(index, deferredPositions.anchorRenderPosition);
        return deferredPositions.anchorRenderPosition;
    }

    const cached = cache?.get(index);
    if (cached !== undefined) {
        return cached;
    }

    if (index < anchorIndex) {
        let position = deferredPositions.anchorRenderPosition;
        for (let i = anchorIndex - 1; i >= index; i--) {
            const item = ctx.state.props.data[i];
            const id = ctx.state.idCache[i] ?? getId(ctx.state, i);
            if (!item || !id) {
                return positions[index];
            }
            position -= getItemSize(ctx, id, i, item);
            cache?.set(i, position);
        }
        return cache?.get(index) ?? position;
    }

    let position = deferredPositions.anchorRenderPosition;
    for (let i = anchorIndex; i < index; i++) {
        const item = ctx.state.props.data[i];
        const id = ctx.state.idCache[i] ?? getId(ctx.state, i);
        if (!item || !id) {
            return positions[index];
        }
        position += getItemSize(ctx, id, i, item);
        cache?.set(i + 1, position);
    }
    return cache?.get(index) ?? position;
}

function getCompensatedDeferredFlushAmount(ctx: StateContext, drift: number) {
    return Math.max(drift, -ctx.state.scroll);
}

function getDeferredFlushAnchor(ctx: StateContext) {
    const state = ctx.state;
    const candidates = [state.startNoBuffer, state.firstFullyOnScreenIndex];

    for (const anchorIndex of candidates) {
        if (anchorIndex === undefined || anchorIndex === null || anchorIndex < 0) {
            continue;
        }

        const preFlushRenderedPosition = getDeferredRenderPosition(ctx, anchorIndex);
        if (preFlushRenderedPosition === undefined) {
            continue;
        }

        return {
            anchorIndex,
            preFlushRenderedPosition,
        };
    }

    return undefined;
}

function recomputeCanonicalPositionsForDeferredFlush(ctx: StateContext, deferred: DeferredPositionsState) {
    const state = ctx.state;
    state.deferredPositions = undefined;
    state.scrollForNextCalculateItemsInView = undefined;
    updateItemPositions(ctx, undefined, {
        doMVCP: false,
        forceFullUpdate: true,
        scrollBottomBuffered: -1,
        startIndex: Math.max(0, deferred.minInvalidatedIndex),
    });
}

function commitDeferredPositionsRebase(ctx: StateContext, deferred: DeferredPositionsState) {
    recomputeCanonicalPositionsForDeferredFlush(ctx, deferred);
}

function getTraceSnapshot(ctx: StateContext) {
    const trace = getDebugDeferredInteraction(ctx.state);
    if (!trace) {
        return undefined;
    }
    const state = ctx.state;
    const getSnapshotForIndex = (targetIndex: number | undefined | null) => {
        if (targetIndex === undefined || targetIndex === null) {
            return undefined;
        }
        const key = state.idCache[targetIndex] ?? getId(state, targetIndex);
        return {
            basePosition: state.positions[targetIndex],
            deferredPosition: getDeferredRenderPosition(ctx, targetIndex),
            index: targetIndex,
            key,
        };
    };

    return {
        firstFullyOnScreen: getSnapshotForIndex(state.firstFullyOnScreenIndex),
        firstOnScreen: getSnapshotForIndex(state.startNoBuffer),
        item: getSnapshotForIndex(trace.index),
        scroll: state.scroll,
    };
}

export function flushDeferredPositions(ctx: StateContext, reason: DeferredPositionsFlushReason) {
    return flushDeferredPositionsWithCompensation(ctx, reason);
}

export function finalizeDeferredPositions(
    ctx: StateContext,
    { triggerCalculateItemsInView = false }: { triggerCalculateItemsInView?: boolean } = {},
) {
    const state = ctx.state;
    const deferred = state.deferredPositions;
    if (!deferred?.isFinalizing) {
        return false;
    }

    logDebugDeferredInteraction(state, "flushDeferredPositions:finalize-raf-fired", {
        deferred: {
            anchorKey: deferred.anchorKey,
            drift: deferred.drift,
            finalizeFrameId: deferred.finalizeFrameId,
            minInvalidatedIndex: deferred.minInvalidatedIndex,
        },
        snapshot: getTraceSnapshot(ctx),
    });
    deferred.finalizeFrameId = undefined;
    commitDeferredPositionsRebase(ctx, deferred);
    logDebugDeferredInteraction(state, "flushDeferredPositions:finalized-after-handoff", {
        snapshot: getTraceSnapshot(ctx),
    });
    if (triggerCalculateItemsInView) {
        logDebugDeferredInteraction(state, "flushDeferredPositions:trigger-calculate-after-finalize", {
            snapshot: getTraceSnapshot(ctx),
        });
        state.triggerCalculateItemsInView?.({ doMVCP: false });
    }
    return true;
}

export function flushDeferredPositionsWithCompensation(
    ctx: StateContext,
    reason: DeferredPositionsFlushReason,
    compensationOverride?: number,
) {
    const state = ctx.state;
    const existingDeferred = state.deferredPositions;
    if (existingDeferred?.isFinalizing) {
        finalizeDeferredPositions(ctx);
    }
    const deferred = state.deferredPositions;
    if (!deferred) {
        return false;
    }
    const drift = deferred.drift;
    updateDebugDeferredInteraction(state, { phase: `flushDeferredPositions:${reason}` });
    logDebugDeferredInteraction(state, "flushDeferredPositions:before-rebase", {
        compensationOverride,
        deferred: {
            anchorKey: deferred.anchorKey,
            anchorRenderPosition: deferred.anchorRenderPosition,
            desiredScrollOffset: deferred.desiredScrollOffset,
            drift,
            minInvalidatedIndex: deferred.minInvalidatedIndex,
        },
        reason,
        snapshot: getTraceSnapshot(ctx),
    });
    console.log(`${Date.now()} [debug initial-blank] flushDeferredPositions`, {
        desiredScrollOffset: deferred.desiredScrollOffset,
        drift,
        minInvalidatedIndex: deferred.minInvalidatedIndex,
        reason,
    });

    if ((reason === "scrollUnsafe" || reason === "visibleInteraction") && drift !== 0) {
        const flushAnchor = getDeferredFlushAnchor(ctx);
        commitDeferredPositionsRebase(ctx, deferred);
        logDebugDeferredInteraction(state, "flushDeferredPositions:after-rebase-before-adjust", {
            compensationOverride,
            reason,
            snapshot: getTraceSnapshot(ctx),
        });
        const exactAdjust =
            flushAnchor !== undefined
                ? (state.positions[flushAnchor.anchorIndex] ?? 0) - flushAnchor.preFlushRenderedPosition
                : undefined;
        const resolvedAdjust =
            compensationOverride ??
            (exactAdjust !== undefined && Number.isFinite(exactAdjust) ? exactAdjust : undefined) ??
            drift;
        const compensatedAdjust = getCompensatedDeferredFlushAmount(
            ctx,
            resolvedAdjust,
        );
        updateDebugDeferredInteraction(state, { phase: `flushDeferredPositions:${reason}:requestAdjust` });
        logDebugDeferredInteraction(state, "flushDeferredPositions:before-requestAdjust", {
            compensatedAdjust,
            compensationOverride,
            exactAdjust,
            flushAnchor,
            reason,
            snapshot: getTraceSnapshot(ctx),
        });
        console.log(`${Date.now()} [debug deferred-anchor] flushDeferredPositions:compensate`, {
            compensatedAdjust,
            compensationOverride,
            drift,
            reason,
            scrollBeforeAdjust: state.scroll,
        });
        if (compensatedAdjust !== 0) {
            requestAdjust(ctx, compensatedAdjust);
            logDebugDeferredInteraction(state, "flushDeferredPositions:after-requestAdjust", {
                compensatedAdjust,
                compensationOverride,
                reason,
                snapshot: getTraceSnapshot(ctx),
            });
            console.log(`${Date.now()} [debug deferred-anchor] flushDeferredPositions:after-requestAdjust`, {
                compensatedAdjust,
                reason,
                scrollAfterAdjust: state.scroll,
            });
        }
        state.triggerCalculateItemsInView?.({ doMVCP: false });
        return true;
    }

    commitDeferredPositionsRebase(ctx, deferred);
    logDebugDeferredInteraction(state, "flushDeferredPositions:after-rebase-before-adjust", {
        compensationOverride,
        reason,
        snapshot: getTraceSnapshot(ctx),
    });

    return true;
}

export function shouldFlushDeferredPositionsForScroll(ctx: StateContext, scroll: number) {
    const deferred = ctx.state.deferredPositions;
    if (!deferred) {
        return undefined;
    }
    if (deferred.isFinalizing) {
        return undefined;
    }

    if (getDeferredAnchorIndex(ctx) === undefined) {
        return "anchorInvalid" as const;
    }

    const firstItemRenderPosition = getDeferredRenderPosition(ctx, 0);
    if (firstItemRenderPosition !== undefined && firstItemRenderPosition > scroll) {
        return "scrollUnsafe" as const;
    }

    if (ctx.state.lastScrollDelta < 0 && deferred.drift > 0 && deferred.drift > scroll) {
        return "scrollUnsafe" as const;
    }

    return undefined;
}

export function maybeCompleteDeferredInitialScroll(ctx: StateContext) {
    const state = ctx.state;
    const deferred = state.deferredPositions;
    const desiredScrollOffset = deferred?.desiredScrollOffset;
    const initialTarget = state.initialScrollLastTarget ?? state.initialScroll;
    const allSizesKnown = checkAllSizesKnown(state);
    if (
        desiredScrollOffset === undefined ||
        state.scrollingTo?.isInitialScroll ||
        !state.didContainersLayout ||
        !allSizesKnown
    ) {
        if (desiredScrollOffset !== undefined) {
            console.log(`${Date.now()} [debug initial-blank] maybeCompleteDeferredInitialScroll:waiting`, {
                allSizesKnown,
                desiredScrollOffset,
                didContainersLayout: state.didContainersLayout,
                scroll: state.scroll,
                scrollingTo: state.scrollingTo,
            });
        }
        return false;
    }

    console.log(`${Date.now()} [debug initial-blank] maybeCompleteDeferredInitialScroll:complete`, {
        desiredScrollOffset,
        drift: deferred?.drift,
        scroll: state.scroll,
    });
    const settledAdjust = deferred ? getCompensatedDeferredFlushAmount(ctx, deferred.drift) : 0;
    const fallbackSettledDesiredScrollOffset = desiredScrollOffset + settledAdjust;
    console.log(`${Date.now()} [debug initial-blank] maybeCompleteDeferredInitialScroll:settle`, {
        desiredScrollOffset,
        drift: deferred?.drift,
        initialTarget,
        scroll: state.scroll,
        settledAdjust,
        settledDesiredScrollOffset: fallbackSettledDesiredScrollOffset,
    });
    flushDeferredPositions(ctx, "settled");

    const exactSettledDesiredScrollOffset =
        initialTarget !== undefined
            ? clampScrollOffset(
                  ctx,
                  state.initialScrollUsesOffset || initialTarget.index === undefined
                      ? (initialTarget.contentOffset ?? fallbackSettledDesiredScrollOffset)
                      : calculateOffsetWithOffsetPosition(ctx, state.positions[initialTarget.index] ?? 0, initialTarget),
                  initialTarget,
              )
            : fallbackSettledDesiredScrollOffset;
    const willFinalizeWithoutScroll = Math.abs(state.scroll - exactSettledDesiredScrollOffset) <= 1;
    console.log(`${Date.now()} [debug initial-blank] maybeCompleteDeferredInitialScroll:exact-settle`, {
        exactSettledDesiredScrollOffset,
        fallbackSettledDesiredScrollOffset,
        scroll: state.scroll,
        willFinalizeWithoutScroll,
    });

    if (willFinalizeWithoutScroll) {
        state.initialAnchor = undefined;
        state.initialNativeScrollWatchdog = undefined;
        state.initialScroll = undefined;
        state.initialScrollUsesOffset = false;
        state.initialScrollLastTarget = undefined;
        state.initialScrollLastTargetUsesOffset = false;
        setInitialRenderState(ctx, { didInitialScroll: true });
        return true;
    }

    console.log(`${Date.now()} [debug initial-blank] maybeCompleteDeferredInitialScroll:final-scroll`, {
        offset: exactSettledDesiredScrollOffset,
        scroll: state.scroll,
    });
    scrollTo(ctx, {
        animated: false,
        forceScroll: true,
        isInitialScroll: true,
        offset: exactSettledDesiredScrollOffset,
        precomputedWithViewOffset: true,
    });
    return true;
}
