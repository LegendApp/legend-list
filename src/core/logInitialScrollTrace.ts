import type { StateContext } from "@/state/state";

type TraceDetails = Record<string, unknown>;
type TraceCache = {
    finishGateKey?: string;
    viewportOwnerKey?: string;
    targetStateKey?: string;
    viewportSourceKey?: string;
};

const INITIAL_SCROLL_STAGE_ALLOWLIST = new Set([
    "doScrollTo:native",
    "doScrollTo:native:fallback-armed",
    "finishScrollTo",
    "finishScrollTo:bootstrap-activated",
    "handleLayout",
    "initialBootstrap:activate",
    "initialBootstrap:cancel",
    "initialBootstrap:finish",
    "initialBootstrap:recalculate-scheduled",
    "onScroll:clamp",
    "onScroll:clamp:bootstrap-handoff",
    "scrollTo",
    "scrollTo:defer-clamped-queued-initial-layout",
    "scrollTo:skip-duplicate-settled-target",
    "setInitialRenderState",
    "setInitialRenderState:ready",
]);

const traceCacheByState = new WeakMap<object, TraceCache>();

function snapshotTarget(target: Record<string, unknown> | undefined) {
    if (!target) {
        return undefined;
    }

    return {
        animated: target.animated,
        contentOffset: target.contentOffset,
        index: target.index,
        isInitialScroll: target.isInitialScroll,
        logicalTargetOffset: target.logicalTargetOffset,
        offset: target.offset,
        precomputedWithViewOffset: target.precomputedWithViewOffset,
        targetOffset: target.targetOffset,
        viewOffset: target.viewOffset,
        viewPosition: target.viewPosition,
    };
}

function snapshotBootstrap(bootstrap: Record<string, unknown> | undefined) {
    if (!bootstrap) {
        return undefined;
    }

    return {
        active: bootstrap.active,
        desiredOffset: bootstrap.desiredOffset,
        stableFrames: bootstrap.stableFrames,
        targetIndexHint: bootstrap.targetIndexHint,
        targetKey: bootstrap.targetKey,
        viewOffset: bootstrap.viewOffset,
        viewPosition: bootstrap.viewPosition,
    };
}

function getTraceCache(state: object) {
    let traceCache = traceCacheByState.get(state);
    if (!traceCache) {
        traceCache = {};
        traceCacheByState.set(state, traceCache);
    }
    return traceCache;
}

function getInitialScrollOwner(state: StateContext["state"]) {
    if (state.initialBootstrap?.active) {
        return "bootstrap";
    }
    if (state.scrollingTo?.isInitialScroll) {
        return "scrollingTo";
    }
    if (state.initialScroll) {
        return "initialScroll";
    }
    if (state.initialBootstrap) {
        return "bootstrap-pending";
    }
    return "none";
}

function shouldLogStage(stage: string) {
    return (
        INITIAL_SCROLL_STAGE_ALLOWLIST.has(stage) ||
        stage.startsWith("anomaly:") ||
        stage.startsWith("finish-gate:") ||
        stage.startsWith("viewport-owner:") ||
        stage.startsWith("target-state:") ||
        stage.startsWith("viewport-source:")
    );
}

export function logInitialScrollTrace(ctx: StateContext, stage: string, details?: TraceDetails) {
    const { state } = ctx;

    const shouldLog =
        !!state.initialScroll ||
        !!state.initialBootstrap?.active ||
        !!state.initialBootstrap ||
        !!state.scrollingTo?.isInitialScroll ||
        stage === "finishScrollTo";

    if (!shouldLog || !shouldLogStage(stage)) {
        return;
    }

    console.log("[legend-list][initial-scroll]", stage, {
        didContainersLayout: state.didContainersLayout,
        didFinishInitialScroll: state.didFinishInitialScroll,
        hasScrolled: state.hasScrolled,
        owner: getInitialScrollOwner(state),
        initialBootstrap: snapshotBootstrap(state.initialBootstrap as Record<string, unknown> | undefined),
        initialScroll: snapshotTarget(state.initialScroll as Record<string, unknown> | undefined),
        initialScrollUsesOffset: state.initialScrollUsesOffset,
        queuedInitialLayout: state.queuedInitialLayout,
        scroll: state.scroll,
        scrollingTo: snapshotTarget(state.scrollingTo as Record<string, unknown> | undefined),
        scrollLength: state.scrollLength,
        scrollPending: state.scrollPending,
        ...details,
    });
}

export function logInitialScrollTargetState(ctx: StateContext, reason: string, details?: TraceDetails) {
    const { state } = ctx;
    const traceCache = getTraceCache(state);
    const payload = {
        activeCommand: snapshotTarget(state.scrollingTo as Record<string, unknown> | undefined),
        bootstrapDesiredOffset: state.initialBootstrap?.desiredOffset,
        bootstrapTarget: snapshotBootstrap(state.initialBootstrap as Record<string, unknown> | undefined),
        owner: getInitialScrollOwner(state),
        reason,
        semanticTarget: snapshotTarget(state.initialScroll as Record<string, unknown> | undefined),
        ...details,
    };
    const key = JSON.stringify(payload);

    if (traceCache.targetStateKey === key) {
        return;
    }

    traceCache.targetStateKey = key;
    logInitialScrollTrace(ctx, "target-state:update", payload);
}

export function logInitialScrollViewportSource(
    ctx: StateContext,
    details: {
        effectiveScroll: number;
        endBuffered: number | null;
        endNoBuffer: number | null;
        firstFullyOnScreenIndex: number | undefined;
        source: string;
        startBuffered: number | null;
        startNoBuffer: number | null;
    } & TraceDetails,
) {
    const { state } = ctx;
    const traceCache = getTraceCache(state);
    const key = JSON.stringify(details);

    if (traceCache.viewportSourceKey === key) {
        return;
    }

    traceCache.viewportSourceKey = key;
    logInitialScrollTrace(ctx, "viewport-source:update", details);
}

export function logInitialScrollViewportOwner(
    ctx: StateContext,
    details: {
        hasActiveInitialCommand: boolean;
        reason: string;
        source: string;
    } & TraceDetails,
) {
    const { state } = ctx;
    const traceCache = getTraceCache(state);
    const key = JSON.stringify(details);

    if (traceCache.viewportOwnerKey === key) {
        return;
    }

    traceCache.viewportOwnerKey = key;
    logInitialScrollTrace(ctx, "viewport-owner:choose", details);
}

export function logInitialScrollFinishGate(
    ctx: StateContext,
    source: "fallback" | "frame",
    details: TraceDetails,
) {
    const { state } = ctx;
    const traceCache = getTraceCache(state);
    const payload = { source, ...details };
    const key = JSON.stringify(payload);

    if (traceCache.finishGateKey === key) {
        return;
    }

    traceCache.finishGateKey = key;
    logInitialScrollTrace(ctx, "finish-gate:evaluate", payload);
}
