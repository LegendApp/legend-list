import { finishInitialScroll } from "@/core/finishInitialScroll";
import { dispatchInitialScroll, resolveInitialScrollOffset, setInitialScrollTarget } from "@/core/initialScroll";
import { setInitialScrollSession } from "@/core/initialScrollSession";
import { Platform } from "@/platform/Platform";
import { peek$, type StateContext } from "@/state/state";
import type { InternalState, ScrollIndexWithOffsetAndContentOffset } from "@/types.base";
import { checkAllSizesKnown, getMountedBufferedIndices } from "@/utils/checkAllSizesKnown";
import { IS_DEV } from "@/utils/devEnvironment";
import { getId } from "@/utils/getId";
import { getItemSize } from "@/utils/getItemSize";

const DEFAULT_BOOTSTRAP_REVEAL_EPSILON = 1;
const DEFAULT_BOOTSTRAP_REVEAL_MAX_FRAMES = 8;
const DEFAULT_BOOTSTRAP_REVEAL_MAX_PASSES = 24;
const BOOTSTRAP_REVEAL_ABORT_WARNING =
    "LegendList bootstrap initial scroll aborted after exceeding convergence bounds.";

type InternalInitialScrollTarget = NonNullable<StateContext["state"]["initialScroll"]>;

function getBootstrapInitialScrollSession(state: InternalState) {
    return state.initialScrollSession?.kind === "bootstrap" ? state.initialScrollSession.bootstrap : undefined;
}

function isOffsetInitialScrollSession(state: InternalState) {
    return state.initialScrollSession?.kind === "offset";
}

/*
 * Bootstrap convergence is based on the actual viewport slice at the resolved
 * target offset. If the same indices are still visible on the next pass, layout
 * has stopped drifting enough for us to trust the final initial-scroll target.
 */
function doVisibleIndicesMatch(previous: readonly number[] | undefined, next: readonly number[]) {
    if (!previous || previous.length !== next.length) {
        return false;
    }

    for (let i = 0; i < previous.length; i++) {
        if (previous[i] !== next[i]) {
            return false;
        }
    }

    return true;
}

/*
 * Starting from an approximate index seed keeps this scan small while bootstrap
 * is still converging. Once the target index is buffered we fall back to the
 * buffered window start instead.
 */
function getBootstrapRevealVisibleIndices(options: {
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

function shouldAbortBootstrapReveal(options: {
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

function abortBootstrapRevealIfNeeded(
    ctx: StateContext,
    options: {
        mountFrameCount: number;
        passCount: number;
    },
) {
    if (!shouldAbortBootstrapReveal(options)) {
        return false;
    }

    if (IS_DEV) {
        console.warn(BOOTSTRAP_REVEAL_ABORT_WARNING);
    }
    abortBootstrapInitialScroll(ctx);
    return true;
}

function clearBootstrapInitialScrollSession(state: InternalState) {
    const bootstrapInitialScroll = getBootstrapInitialScrollSession(state);
    const frameHandle = bootstrapInitialScroll?.frameHandle;
    if (frameHandle !== undefined && typeof cancelAnimationFrame === "function") {
        cancelAnimationFrame(frameHandle);
    }
    if (bootstrapInitialScroll) {
        bootstrapInitialScroll.frameHandle = undefined;
    }
    setInitialScrollSession(state, {
        bootstrap: undefined,
        kind: state.initialScrollSession?.kind,
    });
}

/*
 * The only bootstrap-specific convergence state we keep is:
 * - the last resolved offset
 * - the last visible index slice at that offset
 *
 * The next pass compares against those values and either re-runs or finishes.
 */
function startBootstrapInitialScrollSession(
    state: InternalState,
    options: { scroll: number; seedContentOffset?: number; targetIndexSeed?: number },
) {
    const previousBootstrapInitialScroll = getBootstrapInitialScrollSession(state);
    setInitialScrollSession(state, {
        bootstrap: {
            frameHandle: previousBootstrapInitialScroll?.frameHandle,
            // Re-arming during the initial mount should spend from the same watchdog budget.
            mountFrameCount: previousBootstrapInitialScroll?.mountFrameCount ?? 0,
            passCount: 0,
            previousResolvedOffset: undefined,
            scroll: options.scroll,
            seedContentOffset:
                options.seedContentOffset ?? previousBootstrapInitialScroll?.seedContentOffset ?? options.scroll,
            targetIndexSeed: options.targetIndexSeed,
            visibleIndices: undefined,
        },
        kind: "bootstrap",
    });
}

/*
 * Rearming keeps the existing mount watchdog budget, but drops the previous
 * convergence snapshot so the new target has to settle again.
 */
function resetBootstrapInitialScrollSession(
    state: InternalState,
    options?: { scroll?: number; seedContentOffset?: number; targetIndexSeed?: number },
) {
    const bootstrapInitialScroll = getBootstrapInitialScrollSession(state);
    if (!bootstrapInitialScroll) {
        if (options?.scroll !== undefined) {
            startBootstrapInitialScrollSession(state, {
                scroll: options.scroll,
                seedContentOffset: options.seedContentOffset,
                targetIndexSeed: options.targetIndexSeed,
            });
        }
    } else {
        bootstrapInitialScroll.passCount = 0;
        bootstrapInitialScroll.previousResolvedOffset = undefined;
        bootstrapInitialScroll.scroll = options?.scroll ?? bootstrapInitialScroll.scroll;
        bootstrapInitialScroll.seedContentOffset =
            options?.seedContentOffset ?? bootstrapInitialScroll.seedContentOffset;
        bootstrapInitialScroll.targetIndexSeed = options?.targetIndexSeed ?? bootstrapInitialScroll.targetIndexSeed;
        bootstrapInitialScroll.visibleIndices = undefined;
        setInitialScrollSession(state, {
            bootstrap: bootstrapInitialScroll,
            kind: "bootstrap",
        });
    }
}

function queueBootstrapInitialScrollReevaluation(state: InternalState) {
    requestAnimationFrame(() => {
        if (getBootstrapInitialScrollSession(state)) {
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
        }
    });
}

/*
 * Bootstrap gets a bounded frame ticker so we can abandon convergence if layout
 * never settles and fall back to the best resolved target seen so far.
 */
function ensureBootstrapInitialScrollFrameTicker(ctx: StateContext) {
    const state = ctx.state;
    const bootstrapInitialScroll = getBootstrapInitialScrollSession(state);
    if (!bootstrapInitialScroll || bootstrapInitialScroll.frameHandle !== undefined) {
        return;
    }

    const tick = () => {
        const activeBootstrapInitialScroll = getBootstrapInitialScrollSession(state);
        if (!activeBootstrapInitialScroll) {
            return;
        }

        activeBootstrapInitialScroll.frameHandle = undefined;
        activeBootstrapInitialScroll.mountFrameCount += 1;
        if (
            abortBootstrapRevealIfNeeded(ctx, {
                mountFrameCount: activeBootstrapInitialScroll.mountFrameCount,
                passCount: activeBootstrapInitialScroll.passCount,
            })
        ) {
            return;
        }

        ensureBootstrapInitialScrollFrameTicker(ctx);
    };

    bootstrapInitialScroll.frameHandle = requestAnimationFrame(tick);
}

function rearmBootstrapInitialScroll(
    ctx: StateContext,
    options: { scroll?: number; seedContentOffset?: number; targetIndexSeed?: number },
) {
    resetBootstrapInitialScrollSession(ctx.state, options);
    ensureBootstrapInitialScrollFrameTicker(ctx);
    queueBootstrapInitialScrollReevaluation(ctx.state);
}

/*
 * End-aligned targets depend on footer size and padding, so they are rebuilt
 * when those inputs change instead of trying to preserve a stale offset.
 */
function createInitialScrollAtEndTarget(options: {
    dataLength: number;
    footerSize: number;
    preserveForFooterLayout?: boolean;
    stylePaddingBottom: number;
}) {
    const { dataLength, footerSize, preserveForFooterLayout, stylePaddingBottom } = options;
    return {
        contentOffset: undefined,
        index: Math.max(0, dataLength - 1),
        preserveForBottomPadding: true,
        preserveForFooterLayout,
        viewOffset: -stylePaddingBottom - footerSize,
        viewPosition: 1 as const,
    };
}

function shouldPreserveInitialScrollForBottomPadding(target: InternalInitialScrollTarget | undefined) {
    return !!target?.preserveForBottomPadding;
}

function shouldPreserveInitialScrollForFooterLayout(target: InternalInitialScrollTarget | undefined) {
    return !!target?.preserveForFooterLayout;
}

function isRetargetableBottomAlignedInitialScrollTarget(target: InternalInitialScrollTarget | undefined) {
    return !!(
        target &&
        target.viewPosition === 1 &&
        (shouldPreserveInitialScrollForBottomPadding(target) || shouldPreserveInitialScrollForFooterLayout(target))
    );
}

function createRetargetedBottomAlignedInitialScroll(options: {
    dataLength: number;
    footerSize: number;
    initialScrollAtEnd: boolean;
    stylePaddingBottom: number;
    target: InternalInitialScrollTarget;
}) {
    const { dataLength, footerSize, initialScrollAtEnd, stylePaddingBottom, target } = options;
    const preserveForFooterLayout = shouldPreserveInitialScrollForFooterLayout(target);
    return {
        ...target,
        contentOffset: undefined,
        index: initialScrollAtEnd ? Math.max(0, dataLength - 1) : target.index,
        preserveForBottomPadding: true,
        preserveForFooterLayout,
        viewOffset: -stylePaddingBottom - (preserveForFooterLayout ? footerSize : 0),
        viewPosition: 1 as const,
    };
}

function areEquivalentBootstrapInitialScrollTargets(
    current: InternalInitialScrollTarget,
    next: InternalInitialScrollTarget,
) {
    return (
        current.index === next.index &&
        current.preserveForBottomPadding === next.preserveForBottomPadding &&
        current.preserveForFooterLayout === next.preserveForFooterLayout &&
        current.viewOffset === next.viewOffset &&
        current.viewPosition === next.viewPosition
    );
}

function clearPendingInitialScrollFooterLayout(state: InternalState, target: InternalInitialScrollTarget) {
    if (!shouldPreserveInitialScrollForFooterLayout(target)) {
        return;
    }

    if (state.didFinishInitialScroll && !getBootstrapInitialScrollSession(state)) {
        state.initialScroll = undefined;
        setInitialScrollSession(state);
        return;
    }

    setInitialScrollTarget(state, { ...target, preserveForFooterLayout: undefined });
}

function clearFinishedViewportRetargetableInitialScroll(state: InternalState) {
    state.initialScroll = undefined;
    setInitialScrollSession(state);
}

function didFinishedInitialScrollMoveAwayFromTarget(
    ctx: StateContext,
    target: ScrollIndexWithOffsetAndContentOffset,
    epsilon = DEFAULT_BOOTSTRAP_REVEAL_EPSILON,
) {
    const state = ctx.state;
    if (!state.didFinishInitialScroll) {
        return false;
    }

    const currentOffset = getObservedBootstrapInitialScrollOffset(state);
    return Math.abs(currentOffset - resolveInitialScrollOffset(ctx, target)) > epsilon;
}

function getObservedBootstrapInitialScrollOffset(state: InternalState) {
    const observedOffset = state.refScroller.current?.getCurrentScrollOffset?.();
    return typeof observedOffset === "number" && Number.isFinite(observedOffset)
        ? observedOffset
        : (state.scrollPending ?? state.scroll ?? 0);
}

export function clearFinishedBootstrapInitialScrollTargetIfMovedAway(ctx: StateContext) {
    const state = ctx.state;
    const initialScroll = state.initialScroll;
    if (!state.didFinishInitialScroll || state.scrollingTo?.isInitialScroll || initialScroll?.viewPosition !== 1) {
        return;
    }

    if (didFinishedInitialScrollMoveAwayFromTarget(ctx, initialScroll)) {
        clearFinishedViewportRetargetableInitialScroll(state);
    }
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

    const shouldFinishAtOrigin =
        offset === 0 &&
        !initialScrollAtEnd &&
        (isOffsetInitialScrollSession(state)
            ? Math.abs(target.contentOffset ?? 0) <= 1
            : target.index === 0 && (target.viewPosition ?? 0) === 0 && Math.abs(target.viewOffset ?? 0) <= 1);
    const shouldFinishWithPreservedTarget = state.props.data.length === 0 && target.index !== undefined;

    if (shouldFinishAtOrigin) {
        clearBootstrapInitialScrollSession(state);
        finishInitialScroll(ctx, {
            resolvedOffset: offset,
        });
    } else if (shouldFinishWithPreservedTarget) {
        clearBootstrapInitialScrollSession(state);
        finishInitialScroll(ctx, {
            preserveTarget: true,
            resolvedOffset: offset,
        });
    } else {
        startBootstrapInitialScrollSession(state, {
            scroll: offset,
            seedContentOffset: Platform.OS === "web" ? 0 : offset,
            targetIndexSeed: target.index,
        });
        ensureBootstrapInitialScrollFrameTicker(ctx);
    }
}

export function handleBootstrapInitialScrollDataChange(
    ctx: StateContext,
    options: {
        dataLength: number;
        didDataChange: boolean;
        initialScrollAtEnd: boolean;
        previousDataLength: number;
        stylePaddingBottom: number;
    },
) {
    const { dataLength, didDataChange, initialScrollAtEnd, previousDataLength, stylePaddingBottom } = options;
    const state = ctx.state;
    const initialScroll = state.initialScroll;
    if (isOffsetInitialScrollSession(state) || !initialScroll) {
        return;
    }

    const shouldResetDidFinish = !!(
        state.didFinishInitialScroll &&
        previousDataLength === 0 &&
        dataLength > 0 &&
        initialScroll.index !== undefined
    );
    const bootstrapInitialScroll = getBootstrapInitialScrollSession(state);
    const shouldRetargetBottomAligned =
        dataLength > 0 && (initialScrollAtEnd || isRetargetableBottomAlignedInitialScrollTarget(initialScroll));
    if (!didDataChange && !shouldResetDidFinish && !shouldRetargetBottomAligned) {
        return;
    }

    /*
     * Data changes can move the real end-aligned target. When that happens we
     * rebuild the target and restart bootstrap instead of reusing stale settle
     * state from the old target.
     */
    if (shouldRetargetBottomAligned) {
        if (!shouldResetDidFinish && didFinishedInitialScrollMoveAwayFromTarget(ctx, initialScroll)) {
            clearPendingInitialScrollFooterLayout(state, initialScroll);
            return;
        }

        const updatedInitialScroll = initialScrollAtEnd
            ? createInitialScrollAtEndTarget({
                  dataLength,
                  footerSize: peek$(ctx, "footerSize") || 0,
                  preserveForFooterLayout: shouldPreserveInitialScrollForFooterLayout(initialScroll),
                  stylePaddingBottom,
              })
            : createRetargetedBottomAlignedInitialScroll({
                  dataLength,
                  footerSize: peek$(ctx, "footerSize") || 0,
                  initialScrollAtEnd,
                  stylePaddingBottom,
                  target: initialScroll,
              });

        if (
            !areEquivalentBootstrapInitialScrollTargets(initialScroll, updatedInitialScroll) ||
            !!bootstrapInitialScroll ||
            shouldResetDidFinish ||
            didDataChange
        ) {
            setInitialScrollTarget(state, updatedInitialScroll, {
                ctx,
                resetDidFinish: shouldResetDidFinish,
            });
            rearmBootstrapInitialScroll(ctx, {
                scroll: resolveInitialScrollOffset(ctx, updatedInitialScroll),
                seedContentOffset:
                    shouldResetDidFinish && !bootstrapInitialScroll
                        ? getObservedBootstrapInitialScrollOffset(state)
                        : undefined,
                targetIndexSeed: updatedInitialScroll.index,
            });
            return;
        }
    }

    if (!didDataChange) {
        return;
    }

    if (bootstrapInitialScroll || shouldResetDidFinish) {
        setInitialScrollTarget(state, initialScroll, {
            ctx,
            resetDidFinish: shouldResetDidFinish,
        });
        rearmBootstrapInitialScroll(ctx, {
            scroll: resolveInitialScrollOffset(ctx, initialScroll),
            seedContentOffset:
                shouldResetDidFinish && !bootstrapInitialScroll
                    ? getObservedBootstrapInitialScrollOffset(state)
                    : undefined,
            targetIndexSeed: initialScroll.index,
        });
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
    if (isOffsetInitialScrollSession(state) || dataLength === 0 || !initialScroll) {
        return;
    }

    const shouldProcessFooterLayout =
        !!getBootstrapInitialScrollSession(state) || shouldPreserveInitialScrollForFooterLayout(initialScroll);
    if (!shouldProcessFooterLayout) {
        return;
    }

    if (didFinishedInitialScrollMoveAwayFromTarget(ctx, initialScroll)) {
        clearPendingInitialScrollFooterLayout(state, initialScroll);
    } else {
        /*
         * Footer layout is one of the few post-finish events that can legitimately
         * change an end-aligned bootstrap target, so this path can re-hide and
         * restart bootstrap after the initial scroll has already completed.
         */
        const updatedInitialScroll = createInitialScrollAtEndTarget({
            dataLength,
            footerSize,
            preserveForFooterLayout: shouldPreserveInitialScrollForFooterLayout(initialScroll),
            stylePaddingBottom,
        });
        const didTargetChange =
            initialScroll.index !== updatedInitialScroll.index ||
            initialScroll.viewPosition !== updatedInitialScroll.viewPosition ||
            initialScroll.viewOffset !== updatedInitialScroll.viewOffset;

        if (!didTargetChange) {
            clearPendingInitialScrollFooterLayout(state, initialScroll);
        } else {
            setInitialScrollTarget(state, updatedInitialScroll, {
                ctx,
                resetDidFinish: !!state.didFinishInitialScroll,
            });
            rearmBootstrapInitialScroll(ctx, {
                scroll: resolveInitialScrollOffset(ctx, updatedInitialScroll),
                targetIndexSeed: updatedInitialScroll.index,
            });
        }
    }
}

export function evaluateBootstrapInitialScroll(ctx: StateContext) {
    const state = ctx.state;
    const bootstrapInitialScroll = getBootstrapInitialScrollSession(state);
    const initialScroll = state.initialScroll;
    if (
        !bootstrapInitialScroll ||
        !initialScroll ||
        isOffsetInitialScrollSession(state) ||
        state.scrollingTo?.isInitialScroll
    ) {
        return;
    }

    bootstrapInitialScroll.passCount += 1;
    if (
        abortBootstrapRevealIfNeeded(ctx, {
            mountFrameCount: bootstrapInitialScroll.mountFrameCount,
            passCount: bootstrapInitialScroll.passCount,
        })
    ) {
        return;
    }

    if (
        initialScroll.index !== undefined &&
        state.startBuffered >= 0 &&
        state.endBuffered >= 0 &&
        initialScroll.index >= state.startBuffered &&
        initialScroll.index <= state.endBuffered
    ) {
        // Once the target is buffered, scan from the buffered window instead of
        // biasing around the original requested index.
        bootstrapInitialScroll.targetIndexSeed = undefined;
    }

    const resolvedOffset = resolveInitialScrollOffset(ctx, initialScroll);
    const mountedBufferedIndices = getMountedBufferedIndices(state);
    const areMountedBufferedIndicesMeasured = checkAllSizesKnown(state, mountedBufferedIndices);
    const didResolvedOffsetChange = Math.abs(bootstrapInitialScroll.scroll - resolvedOffset) > 1;
    const { data } = state.props;
    /*
     * Mounted-buffered measurement is necessary but not sufficient on web with
     * variable row heights. We also require the resolved viewport slice itself
     * to stop changing before dispatching the final corrective scroll.
     */
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
    const areVisibleIndicesMeasured =
        visibleIndices.length > 0 &&
        visibleIndices.every((index) => {
            const id = state.idCache[index] ?? getId(state, index);
            return state.sizesKnown.has(id);
        });
    const previousResolvedOffset = bootstrapInitialScroll.previousResolvedOffset;
    const previousVisibleIndices = bootstrapInitialScroll.visibleIndices;

    bootstrapInitialScroll.previousResolvedOffset = resolvedOffset;
    bootstrapInitialScroll.visibleIndices = visibleIndices;

    if (didResolvedOffsetChange) {
        // Real measurements moved the target, so record the new offset and wait
        // for another pass before deciding bootstrap has settled.
        bootstrapInitialScroll.scroll = resolvedOffset;
        queueBootstrapInitialScrollReevaluation(state);
        return;
    }

    if (!areMountedBufferedIndicesMeasured || !areVisibleIndicesMeasured) {
        // We still do not know enough about the viewport that matters.
        return;
    }

    const didRevealSettle =
        previousResolvedOffset !== undefined &&
        Math.abs(previousResolvedOffset - resolvedOffset) <= DEFAULT_BOOTSTRAP_REVEAL_EPSILON &&
        doVisibleIndicesMatch(previousVisibleIndices, visibleIndices);
    if (!didRevealSettle) {
        // This pass becomes the baseline; the next matching pass proves stability.
        queueBootstrapInitialScrollReevaluation(state);
        return;
    }

    if (
        Platform.OS !== "web" &&
        Platform.OS !== "android" &&
        Math.abs(bootstrapInitialScroll.seedContentOffset - resolvedOffset) <= 1
    ) {
        // Non-Android native can finish without a follow-up scroll when the
        // mount seed already landed exactly where bootstrap converged.
        // Android can drop the mount-time contentOffset while content is still
        // materializing, so it must always dispatch the final scroll.
        finishBootstrapInitialScrollWithoutScroll(ctx, resolvedOffset);
    } else {
        clearBootstrapInitialScrollSession(state);

        // Web and corrected native paths do one final dispatch only after the
        // resolved viewport has converged across consecutive passes.
        dispatchInitialScroll(ctx, {
            forceScroll: true,
            resolvedOffset,
            target: initialScroll,
            waitForCompletionFrame: Platform.OS === "web",
        });
    }
}

function finishBootstrapInitialScrollWithoutScroll(ctx: StateContext, resolvedOffset: number) {
    const state = ctx.state;
    clearBootstrapInitialScrollSession(state);
    finishInitialScroll(ctx, {
        preserveTarget: state.initialScroll?.viewPosition === 1,
        recalculateItems: true,
        resolvedOffset,
    });
}

function abortBootstrapInitialScroll(ctx: StateContext) {
    const state = ctx.state;
    const bootstrapInitialScroll = getBootstrapInitialScrollSession(state);
    const initialScroll = state.initialScroll;

    if (bootstrapInitialScroll && initialScroll && !isOffsetInitialScrollSession(state) && state.refScroller.current) {
        clearBootstrapInitialScrollSession(state);

        dispatchInitialScroll(ctx, {
            forceScroll: true,
            resolvedOffset: bootstrapInitialScroll.scroll,
            target: initialScroll,
            waitForCompletionFrame: Platform.OS === "web",
        });
    } else {
        finishBootstrapInitialScrollWithoutScroll(
            ctx,
            getBootstrapInitialScrollSession(state)?.scroll ?? state.scrollPending ?? state.scroll ?? 0,
        );
    }
}
