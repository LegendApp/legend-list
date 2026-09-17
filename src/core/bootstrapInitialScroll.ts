import { isEndOfContentTarget } from "@/core/endOfContentTarget";
import { finishInitialScroll } from "@/core/finishInitialScroll";
import { materializeFixedLayoutStoreRangeAtOffsets } from "@/core/fixedLayoutMaterialization";
import { getStartOffsetAdjustment } from "@/core/getStartOffsetAdjustment";
import { getDataLength } from "@/core/IndexedData";
import { dispatchInitialScroll, resolveInitialScrollOffset, setInitialScrollTarget } from "@/core/initialScroll";
import {
    getObservedScrollOffset,
    retargetInitialScroll,
    schedulePreservedEndAnchorCorrection,
    updateInitialScrollAnchor,
} from "@/core/initialScrollAnchor";
import { syncLayoutStoreState } from "@/core/layoutStoreLifecycle";
import { Platform } from "@/platform/Platform";
import { peek$, type StateContext } from "@/state/state";
import type { ScrollIndexWithOffsetAndContentOffset } from "@/types.base";
import type { InternalState } from "@/types.internal";
import { checkAllSizesKnown } from "@/utils/checkAllSizesKnown";
import { IS_DEV } from "@/utils/devEnvironment";
import { getId } from "@/utils/getId";

const DEFAULT_BOOTSTRAP_REVEAL_MAX_FRAMES = 8;
const DEFAULT_BOOTSTRAP_REVEAL_MAX_PASSES = 24;
const BOOTSTRAP_REVEAL_ABORT_WARNING =
    "LegendList bootstrap initial scroll aborted after exceeding convergence bounds.";

function getBootstrapInitialScrollSession(state: InternalState) {
    return state.initialScroll?.bootstrap;
}

function isOffsetInitialScrollSession(state: InternalState) {
    return state.initialScroll?.kind === "offset";
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

// Inspect the target viewport separately from the mounted buffer: measurements
// can move the resolved target beyond the rows currently mounted.
function getBootstrapRevealVisibleIndices(ctx: StateContext, offset: number) {
    const viewportStart = offset - getStartOffsetAdjustment(ctx) + (peek$(ctx, "scrollAdjustPending") ?? 0);
    const viewportEnd = viewportStart + ctx.state.scrollLength;
    const { didChange, range } = materializeFixedLayoutStoreRangeAtOffsets(ctx, viewportStart, viewportEnd);
    if (didChange) syncLayoutStoreState(ctx);
    const indices: number[] = [];
    if (range) {
        ctx.state.layoutStoreRuntime!.store.forEachLayout(range.start, range.end, (index, top, size) => {
            if (top < viewportEnd && top + size > viewportStart) indices.push(index);
        });
    }
    return indices;
}

function abortBootstrapRevealIfNeeded(
    ctx: StateContext,
    bootstrap: NonNullable<InternalState["initialScroll"]>["bootstrap"],
) {
    if (
        !bootstrap ||
        (bootstrap.mountFrameCount < DEFAULT_BOOTSTRAP_REVEAL_MAX_FRAMES &&
            bootstrap.passCount < DEFAULT_BOOTSTRAP_REVEAL_MAX_PASSES)
    )
        return false;

    if (IS_DEV) {
        console.warn(BOOTSTRAP_REVEAL_ABORT_WARNING);
    }
    abortBootstrapInitialScroll(ctx);
    return true;
}

function clearBootstrapInitialScrollSession(state: InternalState) {
    state.scheduledWork.cancel("initialScrollFrame");
    if (state.initialScroll) state.initialScroll.bootstrap = undefined;
}

function startBootstrapInitialScrollSession(
    state: InternalState,
    options: { scroll: number; seedContentOffset?: number; targetIndexSeed?: number },
) {
    const previousBootstrapInitialScroll = getBootstrapInitialScrollSession(state);
    if (state.initialScroll) {
        state.initialScroll.bootstrap = {
            // Re-arming during the initial mount should spend from the same watchdog budget.
            mountFrameCount: previousBootstrapInitialScroll?.mountFrameCount ?? 0,
            passCount: 0,
            scroll: options.scroll,
            seedContentOffset:
                options.seedContentOffset ?? previousBootstrapInitialScroll?.seedContentOffset ?? options.scroll,
            targetIndexSeed: options.targetIndexSeed,
            visibleIndices: undefined,
        };
    }
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
        bootstrapInitialScroll.scroll = options?.scroll ?? bootstrapInitialScroll.scroll;
        bootstrapInitialScroll.seedContentOffset =
            options?.seedContentOffset ?? bootstrapInitialScroll.seedContentOffset;
        bootstrapInitialScroll.targetIndexSeed = options?.targetIndexSeed ?? bootstrapInitialScroll.targetIndexSeed;
        bootstrapInitialScroll.visibleIndices = undefined;
    }
}

function queueBootstrapInitialScrollReevaluation(ctx: StateContext) {
    const bootstrap = ctx.state.initialScroll?.bootstrap;
    if (bootstrap) {
        bootstrap.needsReevaluation = true;
        ensureBootstrapInitialScrollFrameTicker(ctx);
    }
}

/*
 * Bootstrap gets a bounded frame ticker so we can abandon convergence if layout
 * never settles and fall back to the best resolved target seen so far.
 */
function ensureBootstrapInitialScrollFrameTicker(ctx: StateContext) {
    const state = ctx.state;
    const bootstrapInitialScroll = getBootstrapInitialScrollSession(state);
    if (!bootstrapInitialScroll || state.scheduledWork.has("initialScrollFrame")) {
        return;
    }

    const tick = () => {
        const activeBootstrapInitialScroll = getBootstrapInitialScrollSession(state);
        if (!activeBootstrapInitialScroll) {
            return;
        }

        activeBootstrapInitialScroll.mountFrameCount += 1;
        if (abortBootstrapRevealIfNeeded(ctx, activeBootstrapInitialScroll)) {
            return;
        }

        if (activeBootstrapInitialScroll.needsReevaluation) {
            activeBootstrapInitialScroll.needsReevaluation = false;
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
        }
        ensureBootstrapInitialScrollFrameTicker(ctx);
    };

    state.scheduledWork.frame(tick, "initialScrollFrame");
}

function rearmBootstrapInitialScroll(
    ctx: StateContext,
    options: { scroll?: number; seedContentOffset?: number; targetIndexSeed?: number },
) {
    resetBootstrapInitialScrollSession(ctx.state, options);
    ensureBootstrapInitialScrollFrameTicker(ctx);
    queueBootstrapInitialScrollReevaluation(ctx);
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
    const shouldFinishWithPreservedTarget = getDataLength(state) === 0 && target.index !== undefined;

    if (shouldFinishAtOrigin) {
        clearBootstrapInitialScrollSession(state);
        finishInitialScroll(ctx, {
            resolvedOffset: offset,
        });
    } else if (shouldFinishWithPreservedTarget) {
        /*
         * Empty-data bootstrap targets must stay preserved so the first real
         * data can replay the intended initial position later.
         */
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
        stylePaddingEnd: number;
    },
) {
    const { state } = ctx;
    const { dataLength, didDataChange, initialScrollAtEnd, previousDataLength, stylePaddingEnd } = options;
    const initial = state.initialScroll;
    if (!initial) {
        updateInitialScrollAnchor(ctx, options);
        return;
    }
    if (initial.kind === "offset") return;
    const replay = state.didFinishInitialScroll && previousDataLength === 0 && dataLength > 0;
    const retarget = dataLength > 0 && (initialScrollAtEnd || initial.preserveForBottomPadding);
    if (!didDataChange && !replay && !retarget) return;
    const next = retarget
        ? retargetInitialScroll(initial, dataLength, peek$(ctx, "footerSize") || 0, stylePaddingEnd, initialScrollAtEnd)
        : initial;
    const changed = next.index !== initial.index || next.viewOffset !== initial.viewOffset;
    if (changed || initial.bootstrap || replay) {
        setInitialScrollTarget(ctx, next, { resetDidFinish: !!replay });
        rearmBootstrapInitialScroll(ctx, {
            scroll: resolveInitialScrollOffset(ctx, next),
            seedContentOffset: replay && !initial.bootstrap ? getObservedScrollOffset(state) : undefined,
            targetIndexSeed: next.index,
        });
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
    const { state } = ctx;
    const target = state.initialScroll ?? state.initialScrollAnchor;
    if (!options.dataLength || (!options.initialScrollAtEnd && !isEndOfContentTarget(target, options.dataLength))) return;
    const initial = state.initialScroll;
    if (!initial) {
        updateInitialScrollAnchor(ctx, options);
    } else if (initial.kind !== "offset" && (initial.bootstrap || initial.preserveForFooterLayout)) {
        const next = retargetInitialScroll(
            initial,
            options.dataLength,
            options.footerSize,
            options.stylePaddingEnd,
            options.initialScrollAtEnd,
        );
        if (initial.kind === "end" || next.index !== initial.index || next.viewOffset !== initial.viewOffset) {
            setInitialScrollTarget(ctx, next);
            rearmBootstrapInitialScroll(ctx, {
                scroll: resolveInitialScrollOffset(ctx, next),
                targetIndexSeed: next.index,
            });
        } else {
            initial.preserveForFooterLayout = undefined;
        }
    }
}

export function handleBootstrapInitialScrollLayoutChange(ctx: StateContext) {
    const { state } = ctx;
    const initial = state.initialScroll;
    if (!initial) {
        schedulePreservedEndAnchorCorrection(ctx);
    } else if (
        initial.kind !== "offset" &&
        getDataLength(state) > 0 &&
        (initial.bootstrap || initial.viewPosition === 1)
    ) {
        const offset = resolveInitialScrollOffset(ctx, initial);
        if (initial.bootstrap) {
            rearmBootstrapInitialScroll(ctx, { scroll: offset, targetIndexSeed: initial.index });
        } else if (
            state.scrollingTo?.isInitialScroll &&
            Math.abs(offset - (state.scrollingTo.targetOffset ?? state.scrollingTo.offset)) > 1
        ) {
            initial.contentOffset = offset;
            dispatchInitialScroll(ctx, { forceScroll: true, resolvedOffset: offset, target: initial });
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
    const visibleIndices = getBootstrapRevealVisibleIndices(ctx, resolvedOffset);
    const areVisibleIndicesMeasured =
        visibleIndices.length > 0 &&
        visibleIndices.every((index) => {
            const id = state.idCache[index] ?? getId(state, index);
            return state.sizesKnown.has(id);
        });
    const previousVisibleIndices = bootstrapInitialScroll.visibleIndices;

    bootstrapInitialScroll.visibleIndices = visibleIndices;

    if (didResolvedOffsetChange) {
        // Real measurements moved the target, so record the new offset and wait
        // for another pass before deciding bootstrap has settled.
        bootstrapInitialScroll.scroll = resolvedOffset;
        queueBootstrapInitialScrollReevaluation(ctx);
        return;
    }

    if (!areMountedBufferedIndicesMeasured || !areVisibleIndicesMeasured) {
        // We still do not know enough about the viewport that matters.
        return;
    }

    const didRevealSettle = doVisibleIndicesMatch(previousVisibleIndices, visibleIndices);
    if (!didRevealSettle) {
        // This pass becomes the baseline; the next matching pass proves stability.
        queueBootstrapInitialScrollReevaluation(ctx);
        return;
    }

    if (
        Platform.OS !== "web" &&
        Platform.OS !== "android" &&
        Math.abs(bootstrapInitialScroll.seedContentOffset - resolvedOffset) <= 1 &&
        Math.abs(getObservedScrollOffset(state) - resolvedOffset) <= 1
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
    const shouldPreserveResizeTarget = getDataLength(state) > 0 && state.initialScroll?.viewPosition === 1;
    finishInitialScroll(ctx, {
        preserveTarget: shouldPreserveResizeTarget,
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
