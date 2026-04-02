import { finishInitialScroll, resolveInitialScrollOffset, setInitialScrollTarget } from "@/core/initialScroll";
import { Platform } from "@/platform/Platform";
import type { StateContext } from "@/state/state";
import type { BootstrapInitialScrollSession, InternalState, ScrollIndexWithOffsetAndContentOffset } from "@/types.base";
import { IS_DEV } from "@/utils/devEnvironment";
import { getId } from "@/utils/getId";
import { getItemSize } from "@/utils/getItemSize";
import { performInitialScroll } from "@/utils/performInitialScroll";

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
    startIndex?: number;
}) {
    const { dataLength, getSize, offset, positions, scrollLength, startIndex: requestedStartIndex } = options;
    const endOffset = offset + scrollLength;
    const visibleIndices: number[] = [];
    let index = requestedStartIndex !== undefined ? Math.max(0, Math.min(dataLength - 1, requestedStartIndex)) : 0;

    while (index > 0) {
        const previousIndex = index - 1;
        const previousPosition = positions[previousIndex];
        if (previousPosition === undefined) {
            index = previousIndex;
            continue;
        }

        const previousSize = getSize(previousIndex);
        if (previousSize === undefined) {
            index = previousIndex;
            continue;
        }

        if (previousPosition + previousSize <= offset) {
            break;
        }

        index = previousIndex;
    }

    for (; index < dataLength; index++) {
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

function startBootstrapInitialScrollSession(
    state: InternalState,
    options: { scroll: number; seedContentOffset?: number; targetIndexSeed?: number },
) {
    const previousBootstrapInitialScroll = state.bootstrapInitialScroll;
    state.bootstrapInitialScroll = {
        anchorOffset: undefined,
        frameHandle: previousBootstrapInitialScroll?.frameHandle,
        // Re-arming during the initial mount should spend from the same watchdog budget.
        mountFrameCount: previousBootstrapInitialScroll?.mountFrameCount ?? 0,
        passCount: 0,
        scroll: options.scroll,
        seedContentOffset:
            options.seedContentOffset ?? previousBootstrapInitialScroll?.seedContentOffset ?? options.scroll,
        stablePassCount: 0,
        targetIndexSeed: options.targetIndexSeed,
        visibleIndices: undefined,
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
    bootstrapInitialScroll.scroll = options?.scroll ?? bootstrapInitialScroll.scroll;
    bootstrapInitialScroll.seedContentOffset = options?.seedContentOffset ?? bootstrapInitialScroll.seedContentOffset;
    bootstrapInitialScroll.stablePassCount = 0;
    bootstrapInitialScroll.targetIndexSeed = options?.targetIndexSeed ?? bootstrapInitialScroll.targetIndexSeed;
    bootstrapInitialScroll.visibleIndices = undefined;
}

export function incrementBootstrapInitialScrollFrameCount(session: BootstrapInitialScrollSession) {
    session.mountFrameCount += 1;
}

function queueBootstrapInitialScrollReevaluation(state: InternalState) {
    requestAnimationFrame(() => {
        if (state.bootstrapInitialScroll) {
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
        }
    });
}

function ensureBootstrapInitialScrollFrameTicker(ctx: StateContext) {
    const state = ctx.state;
    const bootstrapInitialScroll = state.bootstrapInitialScroll;
    if (!bootstrapInitialScroll || bootstrapInitialScroll.frameHandle !== undefined) {
        return;
    }

    const tick = () => {
        const activeBootstrapInitialScroll = state.bootstrapInitialScroll;
        if (!activeBootstrapInitialScroll) {
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
    const seedContentOffset = options.seedContentOffset ?? (Platform.OS === "web" ? 0 : options.scroll);
    startBootstrapInitialScrollSession(state, {
        ...options,
        seedContentOffset,
    });
    ensureBootstrapInitialScrollFrameTicker(ctx);
    return Platform.OS === "web" ? undefined : seedContentOffset;
}

export function rearmBootstrapInitialScroll(
    ctx: StateContext,
    options: { scroll?: number; seedContentOffset?: number; targetIndexSeed?: number },
) {
    resetBootstrapInitialScrollSession(ctx.state, options);
    ensureBootstrapInitialScrollFrameTicker(ctx);
    queueBootstrapInitialScrollReevaluation(ctx.state);
}

function shouldFinishInitialScrollAtOrigin(options: {
    initialScrollAtEnd: boolean;
    offset: number;
    state: InternalState;
    target: ScrollIndexWithOffsetAndContentOffset;
}) {
    const { initialScrollAtEnd, offset, state, target } = options;
    if (offset !== 0 || initialScrollAtEnd) {
        return false;
    }

    if (state.initialScrollUsesOffset) {
        return Math.abs(target.contentOffset ?? 0) <= 1;
    }

    return target.index === 0 && (target.viewPosition ?? 0) === 0 && Math.abs(target.viewOffset ?? 0) <= 1;
}

function shouldFinishEmptyInitialScrollAtEnd(options: {
    dataLength: number;
    initialScrollAtEnd: boolean;
    offset: number;
    target: ScrollIndexWithOffsetAndContentOffset;
}) {
    const { dataLength, initialScrollAtEnd, offset, target } = options;
    return dataLength === 0 && initialScrollAtEnd && offset === 0 && target.viewPosition === 1;
}

function shouldRearmFinishedEmptyInitialScrollAtEnd(options: {
    dataLength: number;
    state: InternalState;
    target: ScrollIndexWithOffsetAndContentOffset | undefined;
}) {
    const { dataLength, state, target } = options;
    return !!(
        state.didFinishInitialScroll &&
        dataLength > 0 &&
        target &&
        !state.initialScrollUsesOffset &&
        target.index === 0 &&
        target.viewPosition === 1 &&
        (target.contentOffset ?? 0) === 0
    );
}

export function startBootstrapInitialScrollOnMount(
    ctx: StateContext,
    options: {
        initialScrollAtEnd: boolean;
        target: ScrollIndexWithOffsetAndContentOffset;
    },
) {
    const { initialScrollAtEnd, target } = options;
    const state = ctx.state;
    const offset = resolveInitialScrollOffset(ctx, target);

    if (shouldFinishInitialScrollAtOrigin({ initialScrollAtEnd, offset, state, target })) {
        clearBootstrapInitialScrollSession(state);
        finishInitialScroll(ctx, {
            resolvedOffset: offset,
        });
        return;
    }

    if (
        shouldFinishEmptyInitialScrollAtEnd({
            dataLength: state.props.data.length,
            initialScrollAtEnd,
            offset,
            target,
        })
    ) {
        clearBootstrapInitialScrollSession(state);
        finishInitialScroll(ctx, {
            preserveTarget: true,
            resolvedOffset: offset,
        });
        return;
    }

    startBootstrapInitialScroll(ctx, {
        scroll: offset,
        seedContentOffset: Platform.OS === "web" ? 0 : offset,
        targetIndexSeed: target.index,
    });
}

export function rearmBootstrapInitialScrollForTarget(ctx: StateContext, target: ScrollIndexWithOffsetAndContentOffset) {
    rearmBootstrapInitialScroll(ctx, {
        scroll: resolveInitialScrollOffset(ctx, target),
        targetIndexSeed: target.index,
    });
}

export function handleBootstrapInitialScrollDataChange(
    ctx: StateContext,
    options: {
        dataLength: number;
        didDataChange: boolean;
        previousDataLength: number;
        initialScrollAtEnd: boolean;
        stylePaddingBottom: number;
    },
) {
    const { dataLength, didDataChange, previousDataLength, initialScrollAtEnd, stylePaddingBottom } = options;
    const state = ctx.state;
    const initialScroll = state.initialScroll;
    if (!didDataChange || !initialScroll || state.initialScrollUsesOffset) {
        return;
    }

    if (initialScrollAtEnd && previousDataLength === 0 && dataLength > 0) {
        const lastIndex = Math.max(0, dataLength - 1);
        const updatedInitialScroll: ScrollIndexWithOffsetAndContentOffset = {
            contentOffset: undefined,
            index: lastIndex,
            viewOffset: initialScroll.viewOffset ?? -stylePaddingBottom,
            viewPosition: 1,
        };

        setInitialScrollTarget(state, updatedInitialScroll, {
            resetDidFinish: shouldRearmFinishedEmptyInitialScrollAtEnd({
                dataLength,
                state,
                target: initialScroll,
            }),
        });
        rearmBootstrapInitialScrollForTarget(ctx, updatedInitialScroll);
        return;
    }

    if (state.bootstrapInitialScroll) {
        rearmBootstrapInitialScrollForTarget(ctx, initialScroll);
    }
}

export function handleBootstrapInitialScrollFooterLayout(
    ctx: StateContext,
    options: {
        dataLength: number;
        footerSize: number;
        initialScrollAtEnd: boolean;
        stylePaddingBottom: number;
    },
) {
    const { dataLength, footerSize, initialScrollAtEnd, stylePaddingBottom } = options;
    const state = ctx.state;
    if (!initialScrollAtEnd) {
        return;
    }

    const initialScroll = state.initialScroll;
    if (!initialScroll || state.initialScrollUsesOffset) {
        return;
    }

    const lastIndex = Math.max(0, dataLength - 1);
    if (initialScroll.index !== lastIndex || initialScroll.viewPosition !== 1) {
        return;
    }

    const viewOffset = -stylePaddingBottom - footerSize;
    if (initialScroll.viewOffset === viewOffset) {
        return;
    }

    const updatedInitialScroll = { ...initialScroll, viewOffset };
    setInitialScrollTarget(state, updatedInitialScroll);
    rearmBootstrapInitialScrollForTarget(ctx, updatedInitialScroll);
}

export function evaluateBootstrapInitialScroll(ctx: StateContext) {
    const state = ctx.state;
    const bootstrapInitialScroll = state.bootstrapInitialScroll;
    const initialScroll = state.initialScroll;
    if (
        !bootstrapInitialScroll ||
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
        startIndex:
            bootstrapInitialScroll.targetIndexSeed ?? (state.startBuffered >= 0 ? state.startBuffered : undefined),
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
    clearBootstrapInitialScrollSession(state);

    performInitialScroll(ctx, {
        forceScroll: true,
        initialScrollUsesOffset: state.initialScrollUsesOffset,
        resolvedOffset,
        target: initialScroll,
        waitForCompletionFrame: Platform.OS === "web",
    });
}

export function finishBootstrapInitialScrollWithoutScroll(ctx: StateContext, resolvedOffset: number) {
    const state = ctx.state;
    clearBootstrapInitialScrollSession(state);
    finishInitialScroll(ctx, {
        recalculateItems: true,
        resolvedOffset,
    });
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
        Platform.OS !== "web" &&
        !state.initialScrollUsesOffset &&
        state.refScroller.current
    ) {
        clearBootstrapInitialScrollSession(state);

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
