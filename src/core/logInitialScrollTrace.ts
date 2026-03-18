import type { StateContext } from "@/state/state";

type TraceDetails = Record<string, unknown>;

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

export function logInitialScrollTrace(ctx: StateContext, stage: string, details?: TraceDetails) {
    const { state } = ctx;

    const shouldLog =
        !!state.initialScroll ||
        !!state.initialBootstrap?.active ||
        !!state.scrollingTo?.isInitialScroll ||
        stage === "finishScrollTo";

    if (!shouldLog) {
        return;
    }

    console.log("[legend-list][initial-scroll]", stage, {
        didContainersLayout: state.didContainersLayout,
        didFinishInitialScroll: state.didFinishInitialScroll,
        hasScrolled: state.hasScrolled,
        initialScroll: snapshotTarget(state.initialScroll as Record<string, unknown> | undefined),
        initialScrollUsesOffset: state.initialScrollUsesOffset,
        initialBootstrap: state.initialBootstrap,
        queuedInitialLayout: state.queuedInitialLayout,
        scroll: state.scroll,
        scrollingTo: snapshotTarget(state.scrollingTo as Record<string, unknown> | undefined),
        scrollLength: state.scrollLength,
        scrollPending: state.scrollPending,
        ...details,
    });
}
