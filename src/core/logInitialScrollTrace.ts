import type { StateContext } from "@/state/state";

type TraceDetails = Record<string, unknown>;

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
    return INITIAL_SCROLL_STAGE_ALLOWLIST.has(stage);
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
        initialBootstrap: snapshotBootstrap(state.initialBootstrap as Record<string, unknown> | undefined),
        initialScroll: snapshotTarget(state.initialScroll as Record<string, unknown> | undefined),
        initialScrollUsesOffset: state.initialScrollUsesOffset,
        owner: getInitialScrollOwner(state),
        queuedInitialLayout: state.queuedInitialLayout,
        scroll: state.scroll,
        scrollingTo: snapshotTarget(state.scrollingTo as Record<string, unknown> | undefined),
        scrollLength: state.scrollLength,
        scrollPending: state.scrollPending,
        ...details,
    });
}
