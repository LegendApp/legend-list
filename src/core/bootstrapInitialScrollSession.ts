import type { BootstrapInitialScrollSession, InternalState } from "@/types.base";

export function isBootstrapInitialScrollMeasuring(
    session: BootstrapInitialScrollSession | undefined,
): session is BootstrapInitialScrollSession {
    return session?.phase === "measuring";
}

export function isBootstrapInitialScrollCorrecting(session: BootstrapInitialScrollSession | undefined) {
    return session?.phase === "correcting";
}

export function isBootstrapInitialScrollRevealDelay(session: BootstrapInitialScrollSession | undefined) {
    return session?.phase === "reveal_delay";
}

export function shouldSuppressBootstrapInitialScrollSideEffects(session: BootstrapInitialScrollSession | undefined) {
    return !!session && session.phase === "measuring";
}

export function getBootstrapInitialScrollTargetIndexSeed(session: BootstrapInitialScrollSession | undefined) {
    return isBootstrapInitialScrollMeasuring(session) ? session.targetIndexSeed : undefined;
}

export function getBootstrapInitialScrollVirtualScroll(session: BootstrapInitialScrollSession | undefined) {
    return isBootstrapInitialScrollMeasuring(session) ? session.scroll : undefined;
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
        frameCount: previousBootstrapInitialScroll?.frameCount ?? 0,
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

export function markBootstrapInitialScrollRevealDelay(session: BootstrapInitialScrollSession) {
    session.phase = "reveal_delay";
    session.waitForRevealFrame = false;
}

export function incrementBootstrapInitialScrollFrameCount(session: BootstrapInitialScrollSession) {
    session.frameCount += 1;
}

export function incrementBootstrapInitialScrollPassCount(session: BootstrapInitialScrollSession) {
    session.passCount += 1;
}
