import { Platform } from "@/platform/Platform";
import type { StateContext } from "@/state/state";
import type { ScrollIndexWithOffsetAndContentOffset } from "@/types.base";
import { checkThresholds } from "@/utils/checkThresholds";
import { performInitialScroll } from "@/utils/performInitialScroll";
import type { BootstrapInitialScrollSession, InternalState } from "@/types.base";

export function isBootstrapInitialScrollMeasuring(
    session: BootstrapInitialScrollSession | undefined,
): session is BootstrapInitialScrollSession {
    return session?.phase === "measuring";
}

export function clearBootstrapInitialScrollFrameHandle(state: InternalState) {
    const frameHandle = state.bootstrapInitialScroll?.frameHandle;
    if (frameHandle !== undefined && typeof cancelAnimationFrame === "function") {
        cancelAnimationFrame(frameHandle);
    }
    if (state.bootstrapInitialScroll) {
        state.bootstrapInitialScroll.frameHandle = undefined;
    }
}

export function clearBootstrapInitialScrollSession(state: InternalState) {
    clearBootstrapInitialScrollFrameHandle(state);
    state.bootstrapInitialScroll = undefined;
    state.bootstrapInitialScrollEvaluate = undefined;
}

export function startBootstrapInitialScrollSession(
    state: InternalState,
    options: { scroll: number; seedContentOffset?: number; targetIndexSeed?: number },
) {
    const previousBootstrapInitialScroll = state.bootstrapInitialScroll;
    state.bootstrapInitialScroll = {
        active: true,
        anchorOffset: undefined,
        // Re-arming during the initial mount should spend from the same watchdog budget.
        mountFrameCount: previousBootstrapInitialScroll?.mountFrameCount ?? 0,
        frameHandle: previousBootstrapInitialScroll?.frameHandle,
        passCount: 0,
        pendingFinalCorrection: false,
        phase: "measuring",
        scroll: options.scroll,
        seedContentOffset: options.seedContentOffset ?? previousBootstrapInitialScroll?.seedContentOffset ?? options.scroll,
        stablePassCount: 0,
        suppressSideEffects: true,
        targetIndexSeed: options.targetIndexSeed,
        visibleIndices: undefined,
        waitForRevealFrame: false,
    };
}

export function resetBootstrapInitialScrollSession(
    state: InternalState,
    options?: { scroll?: number; seedContentOffset?: number; targetIndexSeed?: number },
) {
    const bootstrapInitialScroll = state.bootstrapInitialScroll;
    if (!bootstrapInitialScroll) {
        if (options?.scroll !== undefined) {
            startBootstrapInitialScrollSession(state, {
                scroll: options.scroll,
                seedContentOffset: options.seedContentOffset,
                targetIndexSeed: options.targetIndexSeed,
            });
        }
        return;
    }

    bootstrapInitialScroll.active = true;
    bootstrapInitialScroll.anchorOffset = undefined;
    bootstrapInitialScroll.passCount = 0;
    bootstrapInitialScroll.pendingFinalCorrection = false;
    bootstrapInitialScroll.phase = "measuring";
    bootstrapInitialScroll.scroll = options?.scroll ?? bootstrapInitialScroll.scroll;
    bootstrapInitialScroll.seedContentOffset = options?.seedContentOffset ?? bootstrapInitialScroll.seedContentOffset;
    bootstrapInitialScroll.stablePassCount = 0;
    bootstrapInitialScroll.suppressSideEffects = true;
    bootstrapInitialScroll.targetIndexSeed = options?.targetIndexSeed ?? bootstrapInitialScroll.targetIndexSeed;
    bootstrapInitialScroll.visibleIndices = undefined;
    bootstrapInitialScroll.waitForRevealFrame = false;
}

export function resetBootstrapInitialScrollForDataChange(
    state: InternalState,
    target: ScrollIndexWithOffsetAndContentOffset,
) {
    const bootstrapInitialScroll = state.bootstrapInitialScroll;
    if (!bootstrapInitialScroll || !bootstrapInitialScroll.active) {
        return;
    }

    bootstrapInitialScroll.anchorOffset = undefined;
    bootstrapInitialScroll.passCount = 0;
    bootstrapInitialScroll.pendingFinalCorrection = false;
    bootstrapInitialScroll.phase = "measuring";
    bootstrapInitialScroll.stablePassCount = 0;
    bootstrapInitialScroll.suppressSideEffects = true;
    bootstrapInitialScroll.targetIndexSeed = target.index;
    bootstrapInitialScroll.visibleIndices = undefined;
    bootstrapInitialScroll.waitForRevealFrame = false;
}

export function markBootstrapInitialScrollCorrecting(
    session: BootstrapInitialScrollSession,
    options?: { waitForRevealFrame?: boolean },
) {
    session.active = false;
    session.pendingFinalCorrection = true;
    session.phase = "correcting";
    session.suppressSideEffects = false;
    session.waitForRevealFrame = !!options?.waitForRevealFrame;
}

export function incrementBootstrapInitialScrollFrameCount(session: BootstrapInitialScrollSession) {
    session.mountFrameCount += 1;
}

export function finishBootstrapInitialScrollWithoutScroll(
    ctx: StateContext,
    resolvedOffset: number,
    finishInitialScrollWithoutScroll: () => void,
) {
    const state = ctx.state;
    state.scroll = resolvedOffset;
    state.scrollPending = resolvedOffset;
    state.scrollPrev = resolvedOffset;
    clearBootstrapInitialScrollSession(state);
    finishInitialScrollWithoutScroll();
    state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
    checkThresholds(ctx);
}

export function getBootstrapInitialScrollAbortOffset(state: InternalState) {
    if (Platform.OS === "web") {
        return 0;
    }

    return state.bootstrapInitialScroll?.scroll ?? state.scrollPending ?? state.scroll ?? 0;
}

export function abortBootstrapInitialScroll(
    ctx: StateContext,
    finishInitialScrollWithoutScroll: () => void,
) {
    const state = ctx.state;
    const bootstrapInitialScroll = state.bootstrapInitialScroll;
    const initialScroll = state.initialScroll;

    if (
        Platform.OS !== "web" &&
        bootstrapInitialScroll &&
        initialScroll &&
        !state.initialScrollUsesOffset &&
        state.refScroller.current
    ) {
        clearBootstrapInitialScrollFrameHandle(state);
        markBootstrapInitialScrollCorrecting(bootstrapInitialScroll);

        performInitialScroll(ctx, {
            forceScroll: true,
            initialScrollUsesOffset: state.initialScrollUsesOffset,
            resolvedOffset: bootstrapInitialScroll.scroll,
            target: initialScroll,
        });
        return;
    }

    finishBootstrapInitialScrollWithoutScroll(
        ctx,
        getBootstrapInitialScrollAbortOffset(state),
        finishInitialScrollWithoutScroll,
    );
}
