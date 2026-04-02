import { calculateOffsetForIndex } from "@/core/calculateOffsetForIndex";
import { calculateOffsetWithOffsetPosition } from "@/core/calculateOffsetWithOffsetPosition";
import { clampScrollOffset } from "@/core/clampScrollOffset";
import { Platform } from "@/platform/Platform";
import type { StateContext } from "@/state/state";
import type { BootstrapInitialScrollSession, InternalState, ScrollIndexWithOffset, ScrollIndexWithOffsetAndContentOffset } from "@/types.base";
import { checkThresholds } from "@/utils/checkThresholds";
import { IS_DEV } from "@/utils/devEnvironment";
import { getId } from "@/utils/getId";
import { getItemSize } from "@/utils/getItemSize";
import { performInitialScroll } from "@/utils/performInitialScroll";
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
}

export function finishInitialScrollWithoutScroll(ctx: StateContext) {
    const state = ctx.state;
    state.initialAnchor = undefined;
    state.initialScroll = undefined;
    state.initialScrollUsesOffset = false;
    setInitialRenderState(ctx, { didInitialScroll: true });
}

export function resolveInitialScrollOffset(ctx: StateContext, initialScroll: ScrollIndexWithOffset) {
    const state = ctx.state;
    if (state.initialScrollUsesOffset) {
        return (initialScroll as ScrollIndexWithOffsetAndContentOffset).contentOffset ?? 0;
    }
    const baseOffset = initialScroll.index !== undefined ? calculateOffsetForIndex(ctx, initialScroll.index) : 0;
    const resolvedOffset = calculateOffsetWithOffsetPosition(ctx, baseOffset, initialScroll);
    return clampScrollOffset(ctx, resolvedOffset, initialScroll);
}

function startBootstrapInitialScrollSession(
    state: InternalState,
    options: { scroll: number; seedContentOffset?: number; targetIndexSeed?: number },
) {
    const previousBootstrapInitialScroll = state.bootstrapInitialScroll;
    state.bootstrapInitialScroll = {
        anchorOffset: undefined,
        // Re-arming during the initial mount should spend from the same watchdog budget.
        mountFrameCount: previousBootstrapInitialScroll?.mountFrameCount ?? 0,
        frameHandle: previousBootstrapInitialScroll?.frameHandle,
        passCount: 0,
        phase: "measuring",
        scroll: options.scroll,
        seedContentOffset: options.seedContentOffset ?? previousBootstrapInitialScroll?.seedContentOffset ?? options.scroll,
        stablePassCount: 0,
        targetIndexSeed: options.targetIndexSeed,
        visibleIndices: undefined,
        waitForRevealFrame: false,
    };
}

function resetBootstrapInitialScrollSession(
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

    bootstrapInitialScroll.anchorOffset = undefined;
    bootstrapInitialScroll.passCount = 0;
    bootstrapInitialScroll.phase = "measuring";
    bootstrapInitialScroll.scroll = options?.scroll ?? bootstrapInitialScroll.scroll;
    bootstrapInitialScroll.seedContentOffset = options?.seedContentOffset ?? bootstrapInitialScroll.seedContentOffset;
    bootstrapInitialScroll.stablePassCount = 0;
    bootstrapInitialScroll.targetIndexSeed = options?.targetIndexSeed ?? bootstrapInitialScroll.targetIndexSeed;
    bootstrapInitialScroll.visibleIndices = undefined;
    bootstrapInitialScroll.waitForRevealFrame = false;
}

export function resetBootstrapInitialScrollForDataChange(
    state: InternalState,
    target: ScrollIndexWithOffsetAndContentOffset,
) {
    const bootstrapInitialScroll = state.bootstrapInitialScroll;
    if (bootstrapInitialScroll?.phase !== "measuring") {
        return;
    }

    bootstrapInitialScroll.anchorOffset = undefined;
    bootstrapInitialScroll.passCount = 0;
    bootstrapInitialScroll.phase = "measuring";
    bootstrapInitialScroll.stablePassCount = 0;
    bootstrapInitialScroll.targetIndexSeed = target.index;
    bootstrapInitialScroll.visibleIndices = undefined;
    bootstrapInitialScroll.waitForRevealFrame = false;
}

export function markBootstrapInitialScrollCorrecting(
    session: BootstrapInitialScrollSession,
    options?: { waitForRevealFrame?: boolean },
) {
    session.phase = "correcting";
    session.waitForRevealFrame = !!options?.waitForRevealFrame;
}

export function incrementBootstrapInitialScrollFrameCount(session: BootstrapInitialScrollSession) {
    session.mountFrameCount += 1;
}

function queueBootstrapInitialScrollReevaluation(state: InternalState) {
    requestAnimationFrame(() => {
        if (state.bootstrapInitialScroll?.phase === "measuring") {
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
        }
    });
}

function ensureBootstrapInitialScrollFrameTicker(ctx: StateContext) {
    const state = ctx.state;
    const bootstrapInitialScroll = state.bootstrapInitialScroll;
    if (bootstrapInitialScroll?.phase !== "measuring" || bootstrapInitialScroll.frameHandle !== undefined) {
        return;
    }

    const tick = () => {
        const activeBootstrapInitialScroll = state.bootstrapInitialScroll;
        if (activeBootstrapInitialScroll?.phase !== "measuring") {
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
            abortBootstrapInitialScroll(ctx);
            return;
        }

        ensureBootstrapInitialScrollFrameTicker(ctx);
    };

    bootstrapInitialScroll.frameHandle = requestAnimationFrame(tick);
}

export function startBootstrapInitialScroll(
    ctx: StateContext,
    options: { scroll: number; seedContentOffset?: number; targetIndexSeed?: number },
) {
    const state = ctx.state;
    startBootstrapInitialScrollSession(state, {
        ...options,
        seedContentOffset: options.seedContentOffset ?? (Platform.OS === "web" ? 0 : options.scroll),
    });
    ensureBootstrapInitialScrollFrameTicker(ctx);
    return Platform.OS === "web" ? undefined : state.bootstrapInitialScroll?.seedContentOffset;
}

export function rearmBootstrapInitialScroll(
    ctx: StateContext,
    options: { scroll?: number; seedContentOffset?: number; targetIndexSeed?: number },
) {
    resetBootstrapInitialScrollSession(ctx.state, options);
    ensureBootstrapInitialScrollFrameTicker(ctx);
    queueBootstrapInitialScrollReevaluation(ctx.state);
}

export function evaluateBootstrapInitialScroll(ctx: StateContext) {
    const state = ctx.state;
    const bootstrapInitialScroll = state.bootstrapInitialScroll;
    const initialScroll = state.initialScroll;
    if (
        !isBootstrapInitialScrollMeasuring(bootstrapInitialScroll) ||
        !initialScroll ||
        state.initialScrollUsesOffset ||
        state.scrollingTo?.isInitialScroll
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
        abortBootstrapInitialScroll(ctx);
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

    const resolvedOffset = resolveInitialScrollOffset(ctx, initialScroll);
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
        finishBootstrapInitialScrollWithoutScroll(ctx, resolvedOffset);
        return;
    }

    if (bootstrapInitialScroll.frameHandle !== undefined && typeof cancelAnimationFrame === "function") {
        cancelAnimationFrame(bootstrapInitialScroll.frameHandle);
        bootstrapInitialScroll.frameHandle = undefined;
    }
    markBootstrapInitialScrollCorrecting(bootstrapInitialScroll, {
        waitForRevealFrame: Platform.OS === "web",
    });

    performInitialScroll(ctx, {
        forceScroll: true,
        initialScrollUsesOffset: state.initialScrollUsesOffset,
        resolvedOffset,
        target: initialScroll,
    });
}

export function finishBootstrapInitialScrollWithoutScroll(
    ctx: StateContext,
    resolvedOffset: number,
) {
    const state = ctx.state;
    state.scroll = resolvedOffset;
    state.scrollPending = resolvedOffset;
    state.scrollPrev = resolvedOffset;
    clearBootstrapInitialScrollSession(state);
    finishInitialScrollWithoutScroll(ctx);
    state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
    checkThresholds(ctx);
}

export function getBootstrapInitialScrollAbortOffset(state: InternalState) {
    if (Platform.OS === "web") {
        return 0;
    }

    return state.bootstrapInitialScroll?.scroll ?? state.scrollPending ?? state.scroll ?? 0;
}

export function abortBootstrapInitialScroll(ctx: StateContext) {
    const state = ctx.state;
    const bootstrapInitialScroll = state.bootstrapInitialScroll;
    const initialScroll = state.initialScroll;

    if (
        bootstrapInitialScroll &&
        initialScroll &&
        bootstrapInitialScroll.phase === "measuring" &&
        Platform.OS !== "web" &&
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

    finishBootstrapInitialScrollWithoutScroll(ctx, getBootstrapInitialScrollAbortOffset(state));
}
