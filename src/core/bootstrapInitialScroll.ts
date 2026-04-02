import { Platform } from "@/platform/Platform";
import type { StateContext } from "@/state/state";
import type {
    BootstrapInitialScrollSession,
    InternalState,
    ScrollIndexWithOffsetAndContentOffset,
} from "@/types.base";
import { checkThresholds } from "@/utils/checkThresholds";
import { IS_DEV } from "@/utils/devEnvironment";
import { getId } from "@/utils/getId";
import { getItemSize } from "@/utils/getItemSize";
import { setInitialRenderState } from "@/utils/setInitialRenderState";

export const DEFAULT_BOOTSTRAP_REVEAL_EPSILON = 1;
export const DEFAULT_BOOTSTRAP_REVEAL_MAX_FRAMES = 8;
export const DEFAULT_BOOTSTRAP_REVEAL_MAX_PASSES = 24;
export const DEFAULT_BOOTSTRAP_REVEAL_STABLE_PASSES = 2;

export type BootstrapRevealSnapshot = {
    anchorOffset: number;
    visibleIndices: readonly number[];
};

export function getBootstrapRevealVisibleIndices(options: {
    dataLength: number;
    getSize: (index: number) => number | undefined;
    offset: number;
    positions: Array<number | undefined>;
    scrollLength: number;
}) {
    const { dataLength, getSize, offset, positions, scrollLength } = options;
    const endOffset = offset + scrollLength;
    const visibleIndices: number[] = [];

    for (let index = 0; index < dataLength; index++) {
        const position = positions[index];
        if (position === undefined) {
            continue;
        }

        const size = getSize(index);
        if (size === undefined) {
            continue;
        }

        if (position < endOffset && position + size > offset) {
            visibleIndices.push(index);
        } else if (visibleIndices.length > 0 && position >= endOffset) {
            break;
        }
    }

    return visibleIndices;
}

export function areBootstrapRevealVisibleIndicesMeasured(options: {
    getIsMeasured: (index: number) => boolean;
    visibleIndices: readonly number[];
}) {
    const { getIsMeasured, visibleIndices } = options;
    return visibleIndices.length > 0 && visibleIndices.every((index) => getIsMeasured(index));
}

export function shouldUseBootstrapInitialScroll(options: {
    hasInitialScrollIndex: boolean;
    initialScrollAtEnd: boolean;
}) {
    const { hasInitialScrollIndex, initialScrollAtEnd } = options;
    return initialScrollAtEnd || hasInitialScrollIndex;
}

export function areBootstrapRevealSnapshotsEqual(
    previous: BootstrapRevealSnapshot | undefined,
    next: BootstrapRevealSnapshot | undefined,
    epsilon = DEFAULT_BOOTSTRAP_REVEAL_EPSILON,
) {
    if (!previous || !next) {
        return false;
    }

    if (Math.abs(previous.anchorOffset - next.anchorOffset) > epsilon) {
        return false;
    }

    if (previous.visibleIndices.length !== next.visibleIndices.length) {
        return false;
    }

    for (let i = 0; i < previous.visibleIndices.length; i++) {
        if (previous.visibleIndices[i] !== next.visibleIndices[i]) {
            return false;
        }
    }

    return true;
}

export function getBootstrapRevealStablePassCount(options: {
    next: BootstrapRevealSnapshot | undefined;
    previous: BootstrapRevealSnapshot | undefined;
    stablePassCount: number;
}) {
    const { next, previous, stablePassCount } = options;
    return areBootstrapRevealSnapshotsEqual(previous, next) ? stablePassCount + 1 : 1;
}

export function shouldAbortBootstrapReveal(options: {
    mountFrameCount: number;
    maxFrames?: number;
    maxPasses?: number;
    passCount: number;
}) {
    const {
        mountFrameCount,
        maxFrames = DEFAULT_BOOTSTRAP_REVEAL_MAX_FRAMES,
        maxPasses = DEFAULT_BOOTSTRAP_REVEAL_MAX_PASSES,
        passCount,
    } = options;
    return mountFrameCount >= maxFrames || passCount >= maxPasses;
}

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

export function queueBootstrapInitialScrollReevaluation(state: InternalState) {
    requestAnimationFrame(() => {
        if (state.bootstrapInitialScroll?.active) {
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
        }
    });
}

export function startBootstrapInitialScroll(options: {
    abortBootstrapInitialScroll: () => void;
    state: InternalState;
    scroll: number;
    seedContentOffset?: number;
    targetIndexSeed?: number;
}) {
    const { abortBootstrapInitialScroll, state, ...sessionOptions } = options;
    startBootstrapInitialScrollSession(state, {
        ...sessionOptions,
        seedContentOffset: sessionOptions.seedContentOffset ?? (Platform.OS === "web" ? 0 : sessionOptions.scroll),
    });
    ensureBootstrapInitialScrollFrameTicker({
        abortBootstrapInitialScroll,
        state,
    });
    return Platform.OS === "web" ? undefined : state.bootstrapInitialScroll?.seedContentOffset;
}

export function rearmBootstrapInitialScroll(options: {
    abortBootstrapInitialScroll: () => void;
    state: InternalState;
    scroll?: number;
    seedContentOffset?: number;
    targetIndexSeed?: number;
}) {
    const { abortBootstrapInitialScroll, state, ...sessionOptions } = options;
    resetBootstrapInitialScrollSession(state, sessionOptions);
    ensureBootstrapInitialScrollFrameTicker({
        abortBootstrapInitialScroll,
        state,
    });
    queueBootstrapInitialScrollReevaluation(state);
}

export function ensureBootstrapInitialScrollFrameTicker(options: {
    abortBootstrapInitialScroll: () => void;
    state: InternalState;
}) {
    const { abortBootstrapInitialScroll, state } = options;
    const bootstrapInitialScroll = state.bootstrapInitialScroll;
    if (!bootstrapInitialScroll?.active || bootstrapInitialScroll.frameHandle !== undefined) {
        return;
    }

    const tick = () => {
        const activeBootstrapInitialScroll = state.bootstrapInitialScroll;
        if (!activeBootstrapInitialScroll?.active) {
            return;
        }

        activeBootstrapInitialScroll.frameHandle = undefined;
        incrementBootstrapInitialScrollFrameCount(activeBootstrapInitialScroll);
        if (
            shouldAbortBootstrapReveal({
                mountFrameCount: activeBootstrapInitialScroll.mountFrameCount,
                passCount: activeBootstrapInitialScroll.passCount,
            })
        ) {
            if (IS_DEV) {
                console.warn("LegendList bootstrap initial scroll aborted after exceeding convergence bounds.");
            }
            abortBootstrapInitialScroll();
            return;
        }

        ensureBootstrapInitialScrollFrameTicker(options);
    };

    bootstrapInitialScroll.frameHandle = requestAnimationFrame(tick);
}

export function evaluateBootstrapInitialScroll(
    ctx: StateContext,
    options: {
        abortBootstrapInitialScroll: () => void;
        finishBootstrapInitialScrollWithoutScroll: (resolvedOffset: number) => void;
        performInitialScroll: (resolvedOffset: number, target: ScrollIndexWithOffsetAndContentOffset) => void;
        resolveInitialScrollOffset: (initialScroll: ScrollIndexWithOffsetAndContentOffset) => number;
    },
) {
    const { abortBootstrapInitialScroll, finishBootstrapInitialScrollWithoutScroll } = options;
    const state = ctx.state;
    const bootstrapInitialScroll = state.bootstrapInitialScroll;
    const initialScroll = state.initialScroll;
    if (
        !bootstrapInitialScroll?.active ||
        !isBootstrapInitialScrollMeasuring(bootstrapInitialScroll) ||
        !initialScroll ||
        state.initialScrollUsesOffset ||
        state.scrollingTo?.isInitialScroll ||
        bootstrapInitialScroll.pendingFinalCorrection
    ) {
        return;
    }

    bootstrapInitialScroll.passCount += 1;
    if (
        shouldAbortBootstrapReveal({
            mountFrameCount: bootstrapInitialScroll.mountFrameCount,
            passCount: bootstrapInitialScroll.passCount,
        })
    ) {
        if (IS_DEV) {
            console.warn("LegendList bootstrap initial scroll aborted after exceeding convergence bounds.");
        }
        abortBootstrapInitialScroll();
        return;
    }

    if (
        initialScroll.index !== undefined &&
        state.startBuffered >= 0 &&
        state.endBuffered >= 0 &&
        initialScroll.index >= state.startBuffered &&
        initialScroll.index <= state.endBuffered
    ) {
        bootstrapInitialScroll.targetIndexSeed = undefined;
    }

    const resolvedOffset = options.resolveInitialScrollOffset(initialScroll);
    const { data } = state.props;
    const visibleIndices = getBootstrapRevealVisibleIndices({
        dataLength: data.length,
        getSize: (index) => {
            const id = state.idCache[index] ?? getId(state, index);
            return state.sizes.get(id) ?? getItemSize(ctx, id, index, data[index]);
        },
        offset: resolvedOffset,
        positions: state.positions,
        scrollLength: state.scrollLength,
    });
    const areVisibleIndicesMeasured = areBootstrapRevealVisibleIndicesMeasured({
        getIsMeasured: (index) => {
            const id = state.idCache[index] ?? getId(state, index);
            return state.sizesKnown.has(id);
        },
        visibleIndices,
    });

    const previousSnapshot =
        bootstrapInitialScroll.anchorOffset !== undefined && bootstrapInitialScroll.visibleIndices
            ? {
                  anchorOffset: bootstrapInitialScroll.anchorOffset,
                  visibleIndices: bootstrapInitialScroll.visibleIndices,
              }
            : undefined;
    const nextSnapshot = {
        anchorOffset: resolvedOffset,
        visibleIndices,
    };

    bootstrapInitialScroll.anchorOffset = resolvedOffset;
    bootstrapInitialScroll.visibleIndices = visibleIndices;

    if (Math.abs(bootstrapInitialScroll.scroll - resolvedOffset) > 1) {
        bootstrapInitialScroll.scroll = resolvedOffset;
        bootstrapInitialScroll.stablePassCount = 0;
        queueBootstrapInitialScrollReevaluation(state);
        return;
    }

    if (!areVisibleIndicesMeasured) {
        bootstrapInitialScroll.stablePassCount = 0;
        return;
    }

    bootstrapInitialScroll.stablePassCount = getBootstrapRevealStablePassCount({
        next: nextSnapshot,
        previous: previousSnapshot,
        stablePassCount: bootstrapInitialScroll.stablePassCount,
    });

    if (bootstrapInitialScroll.stablePassCount < DEFAULT_BOOTSTRAP_REVEAL_STABLE_PASSES) {
        queueBootstrapInitialScrollReevaluation(state);
        return;
    }

    if (Platform.OS !== "web" && Math.abs(bootstrapInitialScroll.seedContentOffset - resolvedOffset) <= 1) {
        finishBootstrapInitialScrollWithoutScroll(resolvedOffset);
        return;
    }

    if (bootstrapInitialScroll.frameHandle !== undefined && typeof cancelAnimationFrame === "function") {
        cancelAnimationFrame(bootstrapInitialScroll.frameHandle);
        bootstrapInitialScroll.frameHandle = undefined;
    }
    markBootstrapInitialScrollCorrecting(bootstrapInitialScroll, {
        waitForRevealFrame: Platform.OS === "web",
    });

    options.performInitialScroll(resolvedOffset, initialScroll);
}

export function finishBootstrapInitialScroll(
    ctx: StateContext,
    resolvePendingScroll?: () => void,
) {
    const state = ctx.state;
    const waitForRevealFrame = !!state.bootstrapInitialScroll?.waitForRevealFrame;

    const finishReveal = () => {
        state.bootstrapInitialScroll = undefined;
        state.bootstrapInitialScrollEvaluate = undefined;
        state.initialScroll = undefined;
        state.initialScrollUsesOffset = false;
        state.initialAnchor = undefined;
        state.initialNativeScrollWatchdog = undefined;

        if (state.props?.data) {
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
        }

        setInitialRenderState(ctx, { didInitialScroll: true });
        checkThresholds(ctx);
        resolvePendingScroll?.();
    };

    if (waitForRevealFrame) {
        requestAnimationFrame(finishReveal);
    } else {
        finishReveal();
    }
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
    performInitialScroll: ((resolvedOffset: number, target: ScrollIndexWithOffsetAndContentOffset) => void) | undefined,
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

        performInitialScroll?.(bootstrapInitialScroll.scroll, initialScroll);
        return;
    }

    finishBootstrapInitialScrollWithoutScroll(
        ctx,
        getBootstrapInitialScrollAbortOffset(state),
        finishInitialScrollWithoutScroll,
    );
}
