import { doScrollTo } from "@/core/doScrollTo";
import { getEndAlignedViewOffset, isEndOfContentTarget } from "@/core/endOfContentTarget";
import { clearPreservedInitialScrollTarget, finishInitialScroll } from "@/core/finishInitialScroll";
import {
    advanceCurrentInitialScrollSession,
    dispatchInitialScroll,
    resolveInitialScrollOffset,
    setInitialScrollTarget,
} from "@/core/initialScroll";
import { setInitialScrollSession } from "@/core/initialScrollSession";
import { shouldMaintainScrollAtEndOnDataChange } from "@/core/shouldMaintainScrollAtEndOnDataChange";
import { Platform } from "@/platform/Platform";
import { peek$, type StateContext } from "@/state/state";
import type { ScrollIndexWithOffsetAndContentOffset } from "@/types.base";
import type { InternalState } from "@/types.internal";
import { checkAllSizesKnown } from "@/utils/checkAllSizesKnown";
import { IS_DEV } from "@/utils/devEnvironment";
import { getId } from "@/utils/getId";
import { getItemSize } from "@/utils/getItemSize";
import { getStylePaddingEnd, peekLogicalHorizontalOffset } from "@/utils/rtl";

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
    getSize: (index: number) => number;
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
        if (previousPosition !== undefined && previousPosition + getSize(previousIndex) <= offset) {
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
        if (position < endOffset && position + size > offset) {
            visibleIndices.push(index);
        } else if (visibleIndices.length > 0 && position >= endOffset) {
            break;
        }
    }

    return visibleIndices;
}

function abortBootstrapRevealIfNeeded(
    ctx: StateContext,
    options: {
        mountFrameCount: number;
        passCount: number;
    },
) {
    if (
        options.mountFrameCount >= DEFAULT_BOOTSTRAP_REVEAL_MAX_FRAMES ||
        options.passCount >= DEFAULT_BOOTSTRAP_REVEAL_MAX_PASSES
    ) {
        if (IS_DEV) {
            console.warn(BOOTSTRAP_REVEAL_ABORT_WARNING);
        }
        abortBootstrapInitialScroll(ctx);
        return true;
    }
    return false;
}

export function cancelBootstrapInitialScrollFrame(state: InternalState) {
    const bootstrapInitialScroll = getBootstrapInitialScrollSession(state);
    const frameHandle = bootstrapInitialScroll?.frameHandle;
    if (frameHandle !== undefined && typeof cancelAnimationFrame === "function") {
        cancelAnimationFrame(frameHandle);
    }
    if (bootstrapInitialScroll) {
        bootstrapInitialScroll.frameHandle = undefined;
    }
}

function clearBootstrapInitialScrollSession(state: InternalState) {
    cancelBootstrapInitialScrollFrame(state);
    setInitialScrollSession(state, { bootstrap: null });
}

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
            seedContentOffset: options.seedContentOffset ?? options.scroll,
            targetIndexSeed: options.targetIndexSeed,
            visibleIndices: undefined,
        },
        kind: "bootstrap",
    });
}

function queueBootstrapInitialScrollReevaluation(state: InternalState) {
    requestAnimationFrame(() => {
        if (!state.isUnmounted && getBootstrapInitialScrollSession(state)) {
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
        if (state.isUnmounted || !activeBootstrapInitialScroll) {
            return;
        }

        activeBootstrapInitialScroll.frameHandle = undefined;
        activeBootstrapInitialScroll.mountFrameCount += 1;
        if (abortBootstrapRevealIfNeeded(ctx, activeBootstrapInitialScroll)) {
            return;
        }

        ensureBootstrapInitialScrollFrameTicker(ctx);
    };

    bootstrapInitialScroll.frameHandle = requestAnimationFrame(tick);
}

// Keep the mount watchdog budget, but require the new target to converge again.
function rearmBootstrapInitialScroll(
    ctx: StateContext,
    options: { scroll: number; seedContentOffset?: number; targetIndexSeed?: number },
) {
    const state = ctx.state;
    const bootstrapInitialScroll = getBootstrapInitialScrollSession(state);
    if (bootstrapInitialScroll) {
        bootstrapInitialScroll.passCount = 0;
        bootstrapInitialScroll.previousResolvedOffset = undefined;
        bootstrapInitialScroll.scroll = options.scroll;
        bootstrapInitialScroll.seedContentOffset =
            options.seedContentOffset ?? bootstrapInitialScroll.seedContentOffset;
        bootstrapInitialScroll.targetIndexSeed = options.targetIndexSeed ?? bootstrapInitialScroll.targetIndexSeed;
        bootstrapInitialScroll.visibleIndices = undefined;
    } else {
        startBootstrapInitialScrollSession(state, options);
    }
    ensureBootstrapInitialScrollFrameTicker(ctx);
    queueBootstrapInitialScrollReevaluation(state);
}

/*
 * End-aligned targets depend on footer size and padding, so they are rebuilt
 * when those inputs change instead of trying to preserve a stale offset.
 */
function createInitialScrollAtEndTarget(options: {
    dataLength: number;
    footerSize: number;
    index?: number;
    preserveForFooterLayout?: boolean;
    stylePaddingEnd: number;
}): InternalInitialScrollTarget {
    const { dataLength, footerSize, index, preserveForFooterLayout, stylePaddingEnd } = options;
    return {
        contentOffset: undefined,
        index: index ?? Math.max(0, dataLength - 1),
        preserveForBottomPadding: true,
        preserveForFooterLayout,
        viewOffset: getEndAlignedViewOffset(stylePaddingEnd, footerSize),
        viewPosition: 1 as const,
    };
}

function isRetargetableBottomAlignedInitialScrollTarget(target: InternalInitialScrollTarget | undefined) {
    return !!(
        target &&
        target.viewPosition === 1 &&
        (target.preserveForBottomPadding || target.preserveForFooterLayout)
    );
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
        current.viewPosition === next.viewPosition &&
        current.viewPositionFallback === next.viewPositionFallback
    );
}

function clearPendingInitialScrollFooterLayout(
    ctx: StateContext,
    options: {
        dataLength: number;
        stylePaddingEnd: number;
        target: InternalInitialScrollTarget;
    },
) {
    const { dataLength, stylePaddingEnd, target } = options;
    if (!target.preserveForFooterLayout) {
        return;
    }

    // Keep the footer in the offset after preservation expires;
    // ordinary item alignment does not include it.
    const clearedFooterTarget = createInitialScrollAtEndTarget({
        dataLength,
        footerSize: peek$(ctx, "footerSize") || 0,
        stylePaddingEnd,
    });

    setInitialScrollTarget(ctx, clearedFooterTarget);
}

function didFinishedInitialScrollMoveAwayFromTarget(ctx: StateContext, target: ScrollIndexWithOffsetAndContentOffset) {
    const state = ctx.state;
    if (!state.didFinishInitialScroll) {
        return false;
    }

    const currentOffset = getObservedBootstrapInitialScrollOffset(state);
    return Math.abs(currentOffset - resolveInitialScrollOffset(ctx, target)) > DEFAULT_BOOTSTRAP_REVEAL_EPSILON;
}

function getObservedBootstrapInitialScrollOffset(state: InternalState) {
    const observedOffset = state.refScroller.current?.getCurrentScrollOffset?.();
    return typeof observedOffset === "number" && Number.isFinite(observedOffset)
        ? Platform.OS === "web" && state.props.horizontal
            ? peekLogicalHorizontalOffset(state, observedOffset, state.refScroller.current?.getMaxScrollOffset?.())
            : observedOffset
        : state.scrollPending;
}

function getPreservedEndAnchorOffsetDiff(ctx: StateContext) {
    const state = ctx.state;
    const initialScroll = state.initialScroll;
    if (
        !state.didFinishInitialScroll ||
        state.scrollingTo ||
        state.pendingScrollResolve ||
        state.maintainingScrollAtEnd ||
        state.isDragging ||
        !initialScroll ||
        initialScroll.viewPosition !== 1 ||
        state.props.data.length === 0 ||
        (initialScroll.index !== undefined && initialScroll.index >= state.props.data.length) ||
        isOffsetInitialScrollSession(state)
    ) {
        return;
    }

    const currentOffset =
        Platform.OS !== "web" && typeof state.lastNativeScroll === "number" && Number.isFinite(state.lastNativeScroll)
            ? state.lastNativeScroll
            : getObservedBootstrapInitialScrollOffset(state);

    return resolveInitialScrollOffset(ctx, initialScroll) - currentOffset;
}

export function schedulePreservedEndAnchorCorrection(ctx: StateContext) {
    if (getPreservedEndAnchorOffsetDiff(ctx) === undefined) {
        return false;
    }

    const state = ctx.state;
    const correction: NonNullable<InternalState["preservedEndAnchorCorrection"]> = {};
    state.preservedEndAnchorCorrection = correction;

    const tick = () => {
        if (state.preservedEndAnchorCorrection !== correction) {
            return;
        }

        const offsetDiff = getPreservedEndAnchorOffsetDiff(ctx);
        if (state.isUnmounted || offsetDiff === undefined || Math.abs(offsetDiff) <= DEFAULT_BOOTSTRAP_REVEAL_EPSILON) {
            state.preservedEndAnchorCorrection = undefined;
            return;
        }

        const hasObservedNativeScrollAfterRequest =
            !correction.lastRequestTime || (state.lastNativeScrollTime ?? 0) > correction.lastRequestTime;

        // Web can clamp against an old DOM extent without emitting a scroll event.
        if (Platform.OS === "web" || hasObservedNativeScrollAfterRequest) {
            correction.lastRequestTime = Date.now();
            // Use an absolute target: the viewport may already have clamped after layout.
            doScrollTo(ctx, {
                animated: false,
                horizontal: state.props.horizontal,
                offset: resolveInitialScrollOffset(ctx, state.initialScroll!),
            });
            // The correction moves before its scroll event; render the destination in the same frame.
            state.triggerCalculateItemsInView?.();
        }

        requestAnimationFrame(tick);
    };
    // React commits the measured extent and positions in a microtask. Correct
    // after that commit so web growth paints at the end, without waiting a frame.
    if (Platform.OS === "web") queueMicrotask(tick);
    else requestAnimationFrame(tick);
    return true;
}

export function clearFinishedBootstrapInitialScrollTargetIfMovedAway(ctx: StateContext, didScrollMove = false) {
    const state = ctx.state;
    const initialScroll = state.initialScroll;
    if (
        !state.didFinishInitialScroll ||
        state.scrollingTo?.isInitialScroll ||
        initialScroll?.viewPosition !== 1 ||
        (state.preservedEndAnchorCorrection && !didScrollMove)
    ) {
        return;
    }

    if (didFinishedInitialScrollMoveAwayFromTarget(ctx, initialScroll)) {
        // Estimates can be stale while the browser is already at the real end.
        // Keep that target for the next data/layout pass instead of MVCP anchoring.
        const shouldKeepEndTargetAlive =
            isRetargetableBottomAlignedInitialScrollTarget(initialScroll) && peek$(ctx, "isAtEnd");

        if (!shouldKeepEndTargetAlive) {
            state.preservedEndAnchorCorrection = undefined;
            // Downgrade footer targets so later header/layout changes can still retarget them.
            if (initialScroll.preserveForFooterLayout) {
                clearPendingInitialScrollFooterLayout(ctx, {
                    dataLength: state.props.data.length,
                    stylePaddingEnd: getStylePaddingEnd(state.props),
                    target: initialScroll,
                });
            } else {
                clearPreservedInitialScrollTarget(state);
            }
        }
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

    if (shouldFinishAtOrigin || shouldFinishWithPreservedTarget) {
        clearBootstrapInitialScrollSession(state);
        finishInitialScroll(ctx, {
            // Empty data retains its target for the first non-empty layout; origin targets are complete.
            preserveTarget: !shouldFinishAtOrigin,
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
        stylePaddingEnd: number;
    },
) {
    const { dataLength, didDataChange, initialScrollAtEnd, previousDataLength, stylePaddingEnd } = options;
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
    const shouldClearFinishedResizePreservation =
        didDataChange &&
        dataLength > 0 &&
        state.didFinishInitialScroll &&
        !bootstrapInitialScroll &&
        !shouldResetDidFinish &&
        !state.scrollingTo?.isInitialScroll &&
        (!initialScrollAtEnd || shouldMaintainScrollAtEndOnDataChange(state));
    /*
     * Once bootstrap and its final dispatch are idle, release finished targets
     * for data changes owned by maintenance. Restarting bootstrap would replace
     * its scroll. Keep targets for initial-only and empty-to-non-empty handoffs.
     */
    if (shouldClearFinishedResizePreservation) {
        clearPreservedInitialScrollTarget(state);
        return;
    }

    const shouldRetargetBottomAligned =
        dataLength > 0 && (initialScrollAtEnd || isRetargetableBottomAlignedInitialScrollTarget(initialScroll));
    if (!didDataChange && !shouldResetDidFinish && !shouldRetargetBottomAligned) {
        return;
    }
    const retarget = (target: InternalInitialScrollTarget) => {
        setInitialScrollTarget(ctx, target, {
            resetDidFinish: shouldResetDidFinish,
        });
        rearmBootstrapInitialScroll(ctx, {
            scroll: resolveInitialScrollOffset(ctx, target),
            seedContentOffset:
                shouldResetDidFinish && !bootstrapInitialScroll
                    ? getObservedBootstrapInitialScrollOffset(state)
                    : undefined,
            targetIndexSeed: target.index,
        });
    };

    if (shouldRetargetBottomAligned) {
        const updatedInitialScroll = initialScrollAtEnd
            ? createInitialScrollAtEndTarget({
                  dataLength,
                  footerSize: peek$(ctx, "footerSize") || 0,
                  preserveForFooterLayout: !!initialScroll.preserveForFooterLayout,
                  stylePaddingEnd,
              })
            : {
                  ...initialScroll,
                  contentOffset: undefined,
                  preserveForBottomPadding: true,
                  preserveForFooterLayout: !!initialScroll.preserveForFooterLayout,
                  // Numeric targets stop including the footer once data grows past them.
                  viewOffset: getEndAlignedViewOffset(
                      stylePaddingEnd,
                      isEndOfContentTarget(initialScroll, dataLength) ? peek$(ctx, "footerSize") || 0 : 0,
                  ),
                  viewPosition: 1 as const,
              };

        /*
         * If the finished target already drifted away, first drop any pending
         * footer-preservation state instead of reusing the stale target.
         */
        if (!shouldResetDidFinish && didFinishedInitialScrollMoveAwayFromTarget(ctx, initialScroll)) {
            clearPendingInitialScrollFooterLayout(ctx, {
                dataLength,
                stylePaddingEnd,
                target: initialScroll,
            });
            return;
        }

        if (
            !areEquivalentBootstrapInitialScrollTargets(initialScroll, updatedInitialScroll) ||
            !!bootstrapInitialScroll ||
            shouldResetDidFinish ||
            didDataChange
        ) {
            retarget(updatedInitialScroll);
            return;
        }
    }

    if (!didDataChange) {
        return;
    }

    /*
     * Rearm active sessions and new datasets, including those whose render reset
     * already cleared didFinishInitialScroll before the data handoff.
     */
    if (bootstrapInitialScroll || (previousDataLength === 0 && dataLength > 0)) {
        retarget(initialScroll);
    }
}

export function handleBootstrapInitialScrollFooterLayout(
    ctx: StateContext,
    options: {
        dataLength: number;
        footerSize: number;
        initialScrollAtEnd: boolean;
        stylePaddingEnd: number;
    },
) {
    const { dataLength, footerSize, initialScrollAtEnd, stylePaddingEnd } = options;
    const state = ctx.state;
    const initialScroll = state.initialScroll;
    if (!initialScrollAtEnd && !isEndOfContentTarget(initialScroll, dataLength)) {
        return;
    }

    if (isOffsetInitialScrollSession(state) || dataLength === 0 || !initialScroll) {
        return;
    }

    const bootstrapInitialScroll = getBootstrapInitialScrollSession(state);
    const isFinalInitialScroll = !!state.scrollingTo?.isInitialScroll && !bootstrapInitialScroll;
    const shouldProcessFooterLayout =
        isFinalInitialScroll || !!bootstrapInitialScroll || initialScroll.preserveForFooterLayout;
    if (!shouldProcessFooterLayout) {
        return;
    }

    /*
     * If the finished target already drifted, downgrade the footer-preserved
     * target first so later layout changes still have a valid preserved target.
     */
    if (didFinishedInitialScrollMoveAwayFromTarget(ctx, initialScroll)) {
        clearPendingInitialScrollFooterLayout(ctx, {
            dataLength,
            stylePaddingEnd,
            target: initialScroll,
        });
    } else {
        // Footer layout can restart bootstrap and hide rows even after initial placement finishes.
        const updatedInitialScroll = createInitialScrollAtEndTarget({
            dataLength,
            footerSize,
            index: initialScrollAtEnd ? undefined : initialScroll.index,
            preserveForFooterLayout: !!initialScroll.preserveForFooterLayout,
            stylePaddingEnd,
        });
        const didTargetChange =
            initialScroll.index !== updatedInitialScroll.index ||
            initialScroll.viewPosition !== updatedInitialScroll.viewPosition ||
            initialScroll.viewPositionFallback !== updatedInitialScroll.viewPositionFallback ||
            initialScroll.viewOffset !== updatedInitialScroll.viewOffset;

        if (isFinalInitialScroll) {
            // The final request may have been clamped before the footer committed.
            // Retry without restarting bootstrap or revealing its optimistic offset.
            setInitialScrollTarget(ctx, updatedInitialScroll);
            advanceCurrentInitialScrollSession(ctx, { forceScroll: true });
        } else if (!didTargetChange) {
            clearPendingInitialScrollFooterLayout(ctx, {
                dataLength,
                stylePaddingEnd,
                target: initialScroll,
            });
        } else {
            const didFinishInitialScroll = !!state.didFinishInitialScroll;
            setInitialScrollTarget(ctx, updatedInitialScroll, {
                resetDidFinish: didFinishInitialScroll,
            });
            rearmBootstrapInitialScroll(ctx, {
                scroll: resolveInitialScrollOffset(ctx, updatedInitialScroll),
                targetIndexSeed: updatedInitialScroll.index,
            });
        }
    }
}

export function handleBootstrapInitialScrollLayoutChange(ctx: StateContext) {
    const state = ctx.state;
    const initialScroll = state.initialScroll;
    const bootstrapInitialScroll = getBootstrapInitialScrollSession(state);

    /*
     * Layout changes only move measured bootstrap targets. After bootstrap is
     * gone, only bottom-aligned targets stay preserved for late viewport shifts.
     */
    if (
        initialScroll &&
        state.props.data.length > 0 &&
        !isOffsetInitialScrollSession(state) &&
        (bootstrapInitialScroll || initialScroll.viewPosition === 1)
    ) {
        const resolvedOffset = resolveInitialScrollOffset(ctx, initialScroll);
        const scrollingTo = state.scrollingTo?.isInitialScroll ? state.scrollingTo : undefined;

        // Late viewport changes retarget the active or preserved position without rearming bootstrap.
        if (!bootstrapInitialScroll && (scrollingTo || state.didFinishInitialScroll)) {
            const currentOffset = scrollingTo
                ? (scrollingTo.targetOffset ?? scrollingTo.offset)
                : getObservedBootstrapInitialScrollOffset(state);
            const offsetDiff = resolvedOffset - currentOffset;

            if (Math.abs(offsetDiff) > DEFAULT_BOOTSTRAP_REVEAL_EPSILON) {
                if (state.didFinishInitialScroll) {
                    schedulePreservedEndAnchorCorrection(ctx);
                } else if (scrollingTo) {
                    state.initialScroll = {
                        ...initialScroll,
                        contentOffset: resolvedOffset,
                    };
                    dispatchInitialScroll(ctx, {
                        forceScroll: true,
                        resolvedOffset,
                        target: state.initialScroll,
                    });
                }
            }
        } else {
            rearmBootstrapInitialScroll(ctx, {
                scroll: resolvedOffset,
                targetIndexSeed: initialScroll.index,
            });
        }
    }
}

export function evaluateBootstrapInitialScroll(ctx: StateContext) {
    const state = ctx.state;
    const bootstrapInitialScroll = getBootstrapInitialScrollSession(state);
    const initialScroll = state.initialScroll;
    if (state.isUnmounted || !bootstrapInitialScroll || !initialScroll || state.scrollingTo?.isInitialScroll) {
        return;
    }

    bootstrapInitialScroll.passCount += 1;
    if (abortBootstrapRevealIfNeeded(ctx, bootstrapInitialScroll)) {
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
    const areMountedBufferedIndicesMeasured = checkAllSizesKnown(state, state.startBuffered, state.endBuffered);
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
        Math.abs(bootstrapInitialScroll.seedContentOffset - resolvedOffset) <= 1 &&
        Math.abs(getObservedBootstrapInitialScrollOffset(state) - resolvedOffset) <= 1
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
    const shouldPreserveResizeTarget =
        !state.clearPreservedInitialScrollOnNextFinish &&
        state.props.data.length > 0 &&
        state.initialScroll?.viewPosition === 1;
    finishInitialScroll(ctx, {
        preserveTarget: shouldPreserveResizeTarget,
        recalculateItems: true,
        resolvedOffset,
        schedulePreservedTargetClear: shouldPreserveResizeTarget,
    });
}

function abortBootstrapInitialScroll(ctx: StateContext) {
    const state = ctx.state;
    const bootstrapInitialScroll = getBootstrapInitialScrollSession(state);
    const initialScroll = state.initialScroll;

    if (bootstrapInitialScroll && initialScroll && state.refScroller.current) {
        clearBootstrapInitialScrollSession(state);

        dispatchInitialScroll(ctx, {
            forceScroll: true,
            resolvedOffset: bootstrapInitialScroll.scroll,
            target: initialScroll,
            waitForCompletionFrame: Platform.OS === "web",
        });
    } else {
        finishBootstrapInitialScrollWithoutScroll(ctx, bootstrapInitialScroll?.scroll ?? state.scrollPending);
    }
}
