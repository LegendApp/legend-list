import {
    evaluateBootstrapInitialScroll,
    getBootstrapInitialScrollOffset,
    getBootstrapInitialScrollTargetIndexSeed,
    handleBootstrapInitialScrollDataChange,
    handleBootstrapInitialScrollFooterLayout,
    hasBootstrapInitialScrollSession,
    shouldUseBootstrapInitialScroll,
    startBootstrapInitialScrollOnMount,
} from "@/core/bootstrapInitialScroll";
import { checkFinishedScroll, shouldQueueAlignedInitialScrollCompletionCheck } from "@/core/checkFinishedScroll";
import {
    advanceMeasuredInitialScroll,
    advanceOffsetInitialScroll,
    finishInitialScroll,
    getInitialContentOffsetForMount,
    resolveInitialScrollOffset,
    setInitialScrollTarget,
} from "@/core/initialScroll";
import {
    getInitialScrollSessionKind,
    setInitialScrollSessionPhase,
    syncInitialScrollSessionFromLegacyState,
} from "@/core/initialScrollSession";
import { prepareMVCP } from "@/core/mvcp";
import { updateViewableItems } from "@/core/viewability";
import type { LayoutRectangle } from "@/platform/platform-types";
import type { StateContext } from "@/state/state";
import { checkAllSizesKnown } from "@/utils/checkAllSizesKnown";
import { setDidLayout } from "@/utils/setDidLayout";
import { setInitialRenderState } from "@/utils/setInitialRenderState";

export { getInitialContentOffsetForMount, shouldUseBootstrapInitialScroll };

export function createInitialScrollCalculationController(ctx: StateContext) {
    const suppressSideEffects = hasBootstrapInitialScrollSession(ctx.state);

    return {
        allowsScrollRangeOptimization() {
            return !suppressSideEffects;
        },
        finalize() {
            if (suppressSideEffects) {
                evaluateBootstrapInitialScroll(ctx);
            }
        },
        getScrollState(options: { queuedInitialLayout?: boolean; scrollState: number }) {
            const { queuedInitialLayout, scrollState } = options;
            if (suppressSideEffects) {
                return getBootstrapInitialScrollOffset(ctx.state) ?? scrollState;
            }

            const initialScroll = ctx.state.initialScroll;
            if (!queuedInitialLayout && initialScroll) {
                // Before the initial layout settles, keep viewport math anchored to the
                // current initial-scroll target instead of transient native adjustments.
                return resolveInitialScrollOffset(ctx, initialScroll);
            }

            return scrollState;
        },
        handleLayoutReady(options: { endBuffered: number | null; queuedInitialLayout?: boolean }) {
            const { endBuffered, queuedInitialLayout } = options;
            if (suppressSideEffects || queuedInitialLayout || endBuffered === null) {
                return;
            }

            if (checkAllSizesKnown(ctx.state)) {
                setDidLayout(ctx);
                handleInitialScrollLayoutReady(ctx);
            }
        },
        handlePostCalculateSideEffects(options: {
            data: readonly any[];
            endNoBuffer: number | null;
            nextActiveStickyIndex: number;
            onStickyHeaderChange?: ((info: { index: number; item: any }) => void) | null | undefined;
            previousStickyIndex: number;
            scrollLength: number;
            startNoBuffer: number | null;
            stickyIndicesArr: number[];
            viewabilityConfigCallbackPairs: StateContext["state"]["viewabilityConfigCallbackPairs"];
        }) {
            const {
                data,
                endNoBuffer,
                nextActiveStickyIndex,
                onStickyHeaderChange,
                previousStickyIndex,
                scrollLength,
                startNoBuffer,
                stickyIndicesArr,
                viewabilityConfigCallbackPairs,
            } = options;
            if (suppressSideEffects) {
                return;
            }

            if (viewabilityConfigCallbackPairs && startNoBuffer !== null && endNoBuffer !== null) {
                updateViewableItems(
                    ctx.state,
                    ctx,
                    viewabilityConfigCallbackPairs,
                    scrollLength,
                    startNoBuffer,
                    endNoBuffer,
                );
            }

            if (
                onStickyHeaderChange &&
                stickyIndicesArr.length > 0 &&
                nextActiveStickyIndex !== undefined &&
                nextActiveStickyIndex !== previousStickyIndex
            ) {
                const item = data[nextActiveStickyIndex];
                if (item !== undefined) {
                    onStickyHeaderChange({ index: nextActiveStickyIndex, item });
                }
            }
        },
        loopStartSeed: suppressSideEffects ? getBootstrapInitialScrollTargetIndexSeed(ctx.state) : undefined,
        prepareMVCP(options: { dataChanged?: boolean; doMVCP?: boolean }) {
            const { dataChanged, doMVCP } = options;
            return doMVCP && !suppressSideEffects ? prepareMVCP(ctx, dataChanged) : undefined;
        },
    };
}

export function continueInitialScroll(
    ctx: StateContext,
    options?: {
        forceScroll?: boolean;
        waitForInitialLayout?: boolean;
    },
) {
    return getInitialScrollSessionKind(ctx.state) === "offset"
        ? advanceOffsetInitialScroll(ctx, {
              forceScroll: options?.forceScroll,
          })
        : advanceMeasuredInitialScroll(ctx, options);
}

export function handleInitialScrollLayoutChange(
    ctx: StateContext,
    options?: {
        useBootstrapInitialScroll?: boolean;
        waitForInitialLayout?: boolean;
    },
) {
    if (options?.useBootstrapInitialScroll) {
        return false;
    }

    return continueInitialScroll(ctx, {
        waitForInitialLayout: options?.waitForInitialLayout,
    });
}

export function handleInitialScrollLayoutReady(ctx: StateContext) {
    if (!ctx.state.initialScroll) {
        return;
    }

    const runScroll = () => {
        setInitialScrollSessionPhase(ctx.state, "scrolling");
        continueInitialScroll(ctx, { forceScroll: true });
    };

    // Perform a second pass on the next frame to settle with measured sizes.
    runScroll();
    requestAnimationFrame(runScroll);

    if (shouldQueueAlignedInitialScrollCompletionCheck(ctx)) {
        checkFinishedScroll(ctx);
    }
}

export function initializeInitialScrollOnMount(
    ctx: StateContext,
    options: {
        dataLength: number;
        hasFooterComponent: boolean;
        initialContentOffset: number | undefined;
        initialScrollAtEnd: boolean;
        useBootstrapInitialScroll: boolean;
    },
) {
    const { dataLength, hasFooterComponent, initialContentOffset, initialScrollAtEnd, useBootstrapInitialScroll } =
        options;
    const state = ctx.state;
    const initialScroll = state.initialScroll;
    const resolvedInitialContentOffset = initialContentOffset ?? 0;
    const preserveForFooterLayout = useBootstrapInitialScroll && initialScrollAtEnd && hasFooterComponent;

    if (
        initialScroll &&
        (initialScroll.contentOffset === undefined ||
            (!!initialScroll.preserveForFooterLayout !== preserveForFooterLayout &&
                getInitialScrollSessionKind(state) !== "offset"))
    ) {
        setInitialScrollTarget(state, {
            ...initialScroll,
            contentOffset: resolvedInitialContentOffset,
            preserveForFooterLayout,
        });
    }

    if (useBootstrapInitialScroll && initialScroll && getInitialScrollSessionKind(state) !== "offset") {
        setInitialScrollSessionPhase(state, "measuring");
        startBootstrapInitialScrollOnMount(ctx, {
            initialScrollAtEnd,
            target: state.initialScroll!,
        });
        return;
    }

    const hasPendingDataDependentInitialScroll =
        !!initialScroll && dataLength === 0 && !(resolvedInitialContentOffset === 0 && !initialScrollAtEnd);
    if (!resolvedInitialContentOffset && !hasPendingDataDependentInitialScroll) {
        if (initialScroll && !initialScrollAtEnd) {
            finishInitialScroll(ctx, {
                resolvedOffset: resolvedInitialContentOffset,
            });
        } else {
            setInitialRenderState(ctx, { didInitialScroll: true });
        }
    }
}

export function handleInitialScrollDataChange(
    ctx: StateContext,
    options: {
        dataLength: number;
        didDataChange: boolean;
        initialScrollAtEnd: boolean;
        stylePaddingBottom: number;
        useBootstrapInitialScroll: boolean;
        waitForInitialLayout?: boolean;
    },
) {
    const {
        dataLength,
        didDataChange,
        initialScrollAtEnd,
        stylePaddingBottom,
        useBootstrapInitialScroll,
        waitForInitialLayout,
    } = options;
    const state = ctx.state;
    const previousDataLength = state.initialScrollSession?.previousDataLength ?? state.initialScrollPreviousDataLength;

    state.initialScrollPreviousDataLength = dataLength;
    syncInitialScrollSessionFromLegacyState(state);

    if (useBootstrapInitialScroll) {
        handleBootstrapInitialScrollDataChange(ctx, {
            dataLength,
            didDataChange,
            initialScrollAtEnd,
            stylePaddingBottom,
        });
        return;
    }

    const shouldReplayFinishedOffsetInitialScroll =
        previousDataLength === 0 &&
        dataLength > 0 &&
        !!state.initialScroll &&
        getInitialScrollSessionKind(state) === "offset" &&
        !!state.didFinishInitialScroll;

    if (
        previousDataLength !== 0 ||
        dataLength === 0 ||
        !state.initialScroll ||
        !state.queuedInitialLayout ||
        (state.didFinishInitialScroll && !shouldReplayFinishedOffsetInitialScroll)
    ) {
        return;
    }

    if (shouldReplayFinishedOffsetInitialScroll) {
        state.didFinishInitialScroll = false;
        setInitialScrollSessionPhase(state, "pending");
    }

    continueInitialScroll(ctx, {
        waitForInitialLayout,
    });
}

export function handleInitialScrollFooterLayout(
    ctx: StateContext,
    options: {
        dataLength: number;
        horizontal: boolean;
        initialScrollAtEnd: boolean;
        layout: LayoutRectangle;
        stylePaddingBottom: number;
        useBootstrapInitialScroll: boolean;
    },
) {
    const { dataLength, horizontal, initialScrollAtEnd, layout, stylePaddingBottom, useBootstrapInitialScroll } =
        options;
    if (!useBootstrapInitialScroll) {
        return;
    }

    handleBootstrapInitialScrollFooterLayout(ctx, {
        dataLength,
        footerSize: layout[horizontal ? "width" : "height"],
        initialScrollAtEnd,
        stylePaddingBottom,
    });
}
