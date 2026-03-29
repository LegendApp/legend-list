import type { InternalState } from "@/types.base";

type DebugDeferredInteractionTrace = {
    diff?: number;
    index: number;
    itemKey: string;
    nextSize?: number;
    phase?: string;
    prevSize?: number;
    seq: number;
    startedAt: number;
    traceId: string;
};

type DebugDeferredInteractionSnapshotTarget = {
    basePosition?: number;
    deferredPosition?: number;
    index: number;
    key: string;
};

type DebugDeferredInteractionSnapshot = {
    firstFullyOnScreen?: DebugDeferredInteractionSnapshotTarget;
    firstOnScreen?: DebugDeferredInteractionSnapshotTarget;
    item?: DebugDeferredInteractionSnapshotTarget;
    scroll?: number;
};

type DebugDeferredInteractionBurst = {
    anchorIndex?: number;
    anchorKey?: string;
    burstId: string;
    firstAnchorRenderPosition?: number;
    firstScroll?: number;
    lastEventAt: number;
    lastKnownScroll?: number;
    originIndex: number;
    originItemKey: string;
    requestAdjustCalls: number;
    requestAdjustTotal: number;
    seq: number;
    startedAt: number;
    summaryTimer?: ReturnType<typeof setTimeout>;
    totalDeferredResizeUpdates: number;
    totalMvcpRecalculates: number;
    totalFirstMeasurementUpdates: number;
    totalOriginUpdates: number;
    totalSiblingUpdates: number;
    totalSizeUpdates: number;
    totalVisibleInteractionAdjusts: number;
    totalVisibleInteractionFlushes: number;
    finalAnchorRenderPosition?: number;
};

const DEBUG_DEFERRED_INTERACTION_ID = "visible-interaction-v7";
const DEBUG_DEFERRED_INTERACTION_BURST_IDLE_MS = 80;
const traces = new WeakMap<InternalState, DebugDeferredInteractionTrace>();
const bursts = new WeakMap<InternalState, DebugDeferredInteractionBurst>();
let nextTraceId = 1;
let nextBurstId = 1;

function getRenderedPosition(target: DebugDeferredInteractionSnapshotTarget | undefined) {
    return target?.deferredPosition ?? target?.basePosition;
}

function getBurstAnchor(snapshot: DebugDeferredInteractionSnapshot) {
    return snapshot.firstOnScreen ?? snapshot.item ?? snapshot.firstFullyOnScreen;
}

function clearBurstSummaryTimer(burst: DebugDeferredInteractionBurst) {
    if (burst.summaryTimer !== undefined) {
        clearTimeout(burst.summaryTimer);
        burst.summaryTimer = undefined;
    }
}

function logDebugDeferredBurstSummary(state: InternalState, reason: string) {
    const burst = bursts.get(state);
    if (!burst) {
        return;
    }

    clearBurstSummaryTimer(burst);
    console.log(`${Date.now()} [debug deferred-anchor ${DEBUG_DEFERRED_INTERACTION_ID}] burst:summary`, {
        anchorIndex: burst.anchorIndex,
        anchorKey: burst.anchorKey,
        burstId: burst.burstId,
        durationMs: burst.lastEventAt - burst.startedAt,
        finalAnchorRenderPosition: burst.finalAnchorRenderPosition,
        finalScroll: burst.lastKnownScroll,
        firstAnchorRenderPosition: burst.firstAnchorRenderPosition,
        firstScroll: burst.firstScroll,
        originIndex: burst.originIndex,
        originItemKey: burst.originItemKey,
        reason,
        requestAdjustCalls: burst.requestAdjustCalls,
        requestAdjustTotal: burst.requestAdjustTotal,
        startedAt: burst.startedAt,
        totalDeferredResizeUpdates: burst.totalDeferredResizeUpdates,
        totalFirstMeasurementUpdates: burst.totalFirstMeasurementUpdates,
        totalMvcpRecalculates: burst.totalMvcpRecalculates,
        totalOriginUpdates: burst.totalOriginUpdates,
        totalSiblingUpdates: burst.totalSiblingUpdates,
        totalSizeUpdates: burst.totalSizeUpdates,
        totalVisibleInteractionAdjusts: burst.totalVisibleInteractionAdjusts,
        totalVisibleInteractionFlushes: burst.totalVisibleInteractionFlushes,
    });
    bursts.delete(state);
}

function scheduleBurstSummary(state: InternalState, burst: DebugDeferredInteractionBurst) {
    clearBurstSummaryTimer(burst);
    burst.summaryTimer = setTimeout(() => {
        logDebugDeferredBurstSummary(state, "idle-timeout");
    }, DEBUG_DEFERRED_INTERACTION_BURST_IDLE_MS);
}

export function startDebugDeferredInteraction(
    state: InternalState,
    params: Omit<DebugDeferredInteractionTrace, "seq" | "traceId">,
) {
    const trace: DebugDeferredInteractionTrace = {
        ...params,
        seq: 0,
        traceId: `${DEBUG_DEFERRED_INTERACTION_ID}-${nextTraceId++}`,
    };
    traces.set(state, trace);
    return trace;
}

export function getDebugDeferredInteraction(state: InternalState) {
    return traces.get(state);
}

export function startOrContinueDebugDeferredInteractionBurst(
    state: InternalState,
    params: {
        diff?: number;
        index: number;
        itemKey: string;
        nextSize?: number;
        prevSize?: number;
        snapshot?: DebugDeferredInteractionSnapshot;
        startedAt: number;
    },
) {
    let burst = bursts.get(state);
    if (burst && params.startedAt - burst.lastEventAt > DEBUG_DEFERRED_INTERACTION_BURST_IDLE_MS) {
        logDebugDeferredBurstSummary(state, "gap");
        burst = undefined;
    }

    if (!burst) {
        const anchor = params.snapshot ? getBurstAnchor(params.snapshot) : undefined;
        const anchorRenderPosition = getRenderedPosition(anchor);
        burst = {
            anchorIndex: anchor?.index,
            anchorKey: anchor?.key,
            burstId: `${DEBUG_DEFERRED_INTERACTION_ID}-burst-${nextBurstId++}`,
            finalAnchorRenderPosition: anchorRenderPosition,
            firstAnchorRenderPosition: anchorRenderPosition,
            firstScroll: params.snapshot?.scroll,
            lastEventAt: params.startedAt,
            lastKnownScroll: params.snapshot?.scroll,
            originIndex: params.index,
            originItemKey: params.itemKey,
            requestAdjustCalls: 0,
            requestAdjustTotal: 0,
            seq: 0,
            startedAt: params.startedAt,
            totalDeferredResizeUpdates: 0,
            totalFirstMeasurementUpdates: 0,
            totalMvcpRecalculates: 0,
            totalOriginUpdates: 0,
            totalSiblingUpdates: 0,
            totalSizeUpdates: 0,
            totalVisibleInteractionAdjusts: 0,
            totalVisibleInteractionFlushes: 0,
        };
        bursts.set(state, burst);
    }

    burst.lastEventAt = params.startedAt;
    burst.totalSizeUpdates++;
    if (params.index === burst.originIndex && params.itemKey === burst.originItemKey) {
        burst.totalOriginUpdates++;
    } else {
        burst.totalSiblingUpdates++;
    }
    if (params.snapshot) {
        updateDebugDeferredInteractionBurstSnapshot(state, params.snapshot);
    } else {
        scheduleBurstSummary(state, burst);
    }
    return burst;
}

export function getDebugDeferredInteractionBurst(state: InternalState) {
    return bursts.get(state);
}

export function updateDebugDeferredInteraction(
    state: InternalState,
    patch: Partial<Omit<DebugDeferredInteractionTrace, "seq" | "traceId">>,
) {
    const trace = traces.get(state);
    if (!trace) {
        return undefined;
    }
    Object.assign(trace, patch);
    return trace;
}

export function updateDebugDeferredInteractionBurstSnapshot(
    state: InternalState,
    snapshot: DebugDeferredInteractionSnapshot,
) {
    const burst = bursts.get(state);
    if (!burst) {
        return undefined;
    }

    const anchor = getBurstAnchor(snapshot);
    if (burst.anchorIndex === undefined && anchor) {
        burst.anchorIndex = anchor.index;
        burst.anchorKey = anchor.key;
        burst.firstAnchorRenderPosition = getRenderedPosition(anchor);
    }

    const anchorTarget =
        snapshot.firstOnScreen?.index === burst.anchorIndex
            ? snapshot.firstOnScreen
            : snapshot.item?.index === burst.anchorIndex
              ? snapshot.item
              : snapshot.firstFullyOnScreen?.index === burst.anchorIndex
                ? snapshot.firstFullyOnScreen
                : undefined;

    if (anchorTarget) {
        burst.finalAnchorRenderPosition = getRenderedPosition(anchorTarget);
    }
    if (snapshot.scroll !== undefined) {
        burst.lastKnownScroll = snapshot.scroll;
    }
    scheduleBurstSummary(state, burst);
    return burst;
}

export function recordDebugDeferredInteractionBurstDecision(
    state: InternalState,
    params: {
        didApplyDeferredResizeDelta?: boolean;
        didFirstMeasurement?: boolean;
        didFlushVisibleInteraction?: boolean;
        didRequestMvcpRecalculate?: boolean;
        didRequestVisibleInteractionAdjust?: boolean;
    },
) {
    const burst = bursts.get(state);
    if (!burst) {
        return undefined;
    }
    if (params.didApplyDeferredResizeDelta) {
        burst.totalDeferredResizeUpdates++;
    }
    if (params.didFirstMeasurement) {
        burst.totalFirstMeasurementUpdates++;
    }
    if (params.didFlushVisibleInteraction) {
        burst.totalVisibleInteractionFlushes++;
    }
    if (params.didRequestMvcpRecalculate) {
        burst.totalMvcpRecalculates++;
    }
    if (params.didRequestVisibleInteractionAdjust) {
        burst.totalVisibleInteractionAdjusts++;
    }
    scheduleBurstSummary(state, burst);
    return burst;
}

export function recordDebugDeferredInteractionBurstAdjust(
    state: InternalState,
    positionDiff: number,
    nextScroll?: number,
) {
    const burst = bursts.get(state);
    if (!burst) {
        return undefined;
    }
    burst.requestAdjustCalls++;
    burst.requestAdjustTotal += positionDiff;
    if (nextScroll !== undefined) {
        burst.lastKnownScroll = nextScroll;
    }
    scheduleBurstSummary(state, burst);
    return burst;
}

export function logDebugDeferredInteraction(
    state: InternalState,
    event: string,
    payload: Record<string, unknown> = {},
) {
    const trace = traces.get(state);
    if (!trace) {
        return;
    }
    const burst = bursts.get(state);
    console.log(`${Date.now()} [debug deferred-anchor ${DEBUG_DEFERRED_INTERACTION_ID}] ${event}`, {
        burstAdjustCalls: burst?.requestAdjustCalls,
        burstAdjustTotal: burst?.requestAdjustTotal,
        burstId: burst?.burstId,
        burstSeq: burst ? ++burst.seq : undefined,
        burstSizeUpdates: burst?.totalSizeUpdates,
        diff: trace.diff,
        index: trace.index,
        itemKey: trace.itemKey,
        nextSize: trace.nextSize,
        phase: trace.phase,
        prevSize: trace.prevSize,
        seq: ++trace.seq,
        startedAt: trace.startedAt,
        traceId: trace.traceId,
        ...payload,
    });
}
