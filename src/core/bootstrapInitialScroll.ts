import {
    dispatchInitialScroll,
    finishInitialScroll,
    resolveInitialScrollOffset,
    setInitialScrollTarget,
} from "@/core/initialScroll";
import { setInitialScrollSession } from "@/core/initialScrollSession";
import { Platform } from "@/platform/Platform";
import { peek$, type StateContext } from "@/state/state";
import type { InternalState, ScrollIndexWithOffsetAndContentOffset } from "@/types.base";
import { checkAllSizesKnown, getMountedBufferedIndices } from "@/utils/checkAllSizesKnown";
import { IS_DEV } from "@/utils/devEnvironment";

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
            scroll: options.scroll,
            seedContentOffset:
                options.seedContentOffset ?? previousBootstrapInitialScroll?.seedContentOffset ?? options.scroll,
            targetIndexSeed: options.targetIndexSeed,
        },
        kind: "bootstrap",
    });
}

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
        return;
    }

    bootstrapInitialScroll.passCount = 0;
    bootstrapInitialScroll.scroll = options?.scroll ?? bootstrapInitialScroll.scroll;
    bootstrapInitialScroll.seedContentOffset = options?.seedContentOffset ?? bootstrapInitialScroll.seedContentOffset;
    bootstrapInitialScroll.targetIndexSeed = options?.targetIndexSeed ?? bootstrapInitialScroll.targetIndexSeed;
    setInitialScrollSession(state, {
        bootstrap: bootstrapInitialScroll,
        kind: "bootstrap",
    });
}

function queueBootstrapInitialScrollReevaluation(state: InternalState) {
    requestAnimationFrame(() => {
        if (getBootstrapInitialScrollSession(state)) {
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
        }
    });
}

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

    setInitialScrollTarget(state, { ...target, preserveForFooterLayout: undefined });
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
    if (shouldFinishAtOrigin) {
        clearBootstrapInitialScrollSession(state);
        finishInitialScroll(ctx, {
            resolvedOffset: offset,
        });
        return;
    }

    if (state.props.data.length === 0 && target.index !== undefined) {
        clearBootstrapInitialScrollSession(state);
        finishInitialScroll(ctx, {
            preserveTarget: true,
            resolvedOffset: offset,
        });
        return;
    }

    startBootstrapInitialScrollSession(state, {
        scroll: offset,
        seedContentOffset: Platform.OS === "web" ? 0 : offset,
        targetIndexSeed: target.index,
    });
    ensureBootstrapInitialScrollFrameTicker(ctx);
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
        return;
    }

    const updatedInitialScroll = createInitialScrollAtEndTarget({
        dataLength,
        footerSize,
        preserveForFooterLayout: shouldPreserveInitialScrollForFooterLayout(initialScroll),
        stylePaddingBottom,
    });
    if (
        initialScroll.index === updatedInitialScroll.index &&
        initialScroll.viewPosition === updatedInitialScroll.viewPosition &&
        initialScroll.viewOffset === updatedInitialScroll.viewOffset
    ) {
        clearPendingInitialScrollFooterLayout(state, initialScroll);
        return;
    }

    setInitialScrollTarget(state, updatedInitialScroll, {
        ctx,
        resetDidFinish: !!state.didFinishInitialScroll,
    });
    rearmBootstrapInitialScroll(ctx, {
        scroll: resolveInitialScrollOffset(ctx, updatedInitialScroll),
        targetIndexSeed: updatedInitialScroll.index,
    });
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
        bootstrapInitialScroll.targetIndexSeed = undefined;
    }

    const resolvedOffset = resolveInitialScrollOffset(ctx, initialScroll);
    const mountedBufferedIndices = getMountedBufferedIndices(state);
    const areMountedBufferedIndicesMeasured = checkAllSizesKnown(state, mountedBufferedIndices);
    const didResolvedOffsetChange = Math.abs(bootstrapInitialScroll.scroll - resolvedOffset) > 1;

    if (didResolvedOffsetChange) {
        bootstrapInitialScroll.scroll = resolvedOffset;
    }

    if (!areMountedBufferedIndicesMeasured) {
        if (didResolvedOffsetChange) {
            queueBootstrapInitialScrollReevaluation(state);
        }
        return;
    }

    if (Platform.OS !== "web" && Math.abs(bootstrapInitialScroll.seedContentOffset - resolvedOffset) <= 1) {
        finishBootstrapInitialScrollWithoutScroll(ctx, resolvedOffset);
        return;
    }

    clearBootstrapInitialScrollSession(state);

    dispatchInitialScroll(ctx, {
        forceScroll: true,
        resolvedOffset,
        target: initialScroll,
        waitForCompletionFrame: Platform.OS === "web",
    });
}

function finishBootstrapInitialScrollWithoutScroll(ctx: StateContext, resolvedOffset: number) {
    const state = ctx.state;
    clearBootstrapInitialScrollSession(state);
    finishInitialScroll(ctx, {
        preserveTarget: shouldPreserveInitialScrollForFooterLayout(state.initialScroll),
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
        return;
    }

    finishBootstrapInitialScrollWithoutScroll(
        ctx,
        getBootstrapInitialScrollSession(state)?.scroll ?? state.scrollPending ?? state.scroll ?? 0,
    );
}
