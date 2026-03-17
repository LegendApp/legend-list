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

function snapshotWatchdog(watchdog: StateContext["state"]["initialNativeScrollWatchdog"]) {
    if (!watchdog) {
        return undefined;
    }

    return {
        startScroll: watchdog.startScroll,
        targetOffset: watchdog.targetOffset,
    };
}

export function logInitialScrollTrace(ctx: StateContext, stage: string, details?: TraceDetails) {
    const { state } = ctx;

    const shouldLog =
        !!state.initialScroll ||
        !!state.initialNativeScrollWatchdog ||
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
        queuedInitialLayout: state.queuedInitialLayout,
        scroll: state.scroll,
        scrollingTo: snapshotTarget(state.scrollingTo as Record<string, unknown> | undefined),
        scrollLength: state.scrollLength,
        scrollPending: state.scrollPending,
        watchdog: snapshotWatchdog(state.initialNativeScrollWatchdog),
        ...details,
    });
}
