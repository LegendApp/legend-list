import {
    handleBootstrapInitialScrollDataChange,
    handleBootstrapInitialScrollFooterLayout,
    shouldUseBootstrapInitialScroll,
    startBootstrapInitialScrollOnMount,
} from "@/core/bootstrapInitialScroll";
import {
    advanceMeasuredInitialScroll,
    advanceOffsetInitialScroll,
    finishInitialScroll,
    getInitialContentOffsetForMount,
    setInitialScrollTarget,
} from "@/core/initialScroll";
import { checkFinishedScroll, shouldQueueAlignedInitialScrollCompletionCheck } from "@/core/checkFinishedScroll";
import type { LayoutRectangle } from "@/platform/platform-types";
import type { StateContext } from "@/state/state";
import { setInitialRenderState } from "@/utils/setInitialRenderState";

export { getInitialContentOffsetForMount, shouldUseBootstrapInitialScroll };

export function continueInitialScroll(
    ctx: StateContext,
    options?: {
        forceScroll?: boolean;
        waitForInitialLayout?: boolean;
    },
) {
    return ctx.state.initialScrollUsesOffset
        ? advanceOffsetInitialScroll(ctx, {
              forceScroll: options?.forceScroll,
          })
        : advanceMeasuredInitialScroll(ctx, options);
}

export function handleInitialScrollLayoutReady(ctx: StateContext) {
    if (!ctx.state.initialScroll) {
        return;
    }

    const runScroll = () => {
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
            (!!initialScroll.preserveForFooterLayout !== preserveForFooterLayout && !state.initialScrollUsesOffset))
    ) {
        setInitialScrollTarget(state, {
            ...initialScroll,
            contentOffset: resolvedInitialContentOffset,
            preserveForFooterLayout,
        });
    }

    if (useBootstrapInitialScroll && initialScroll && !state.initialScrollUsesOffset) {
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
        previousDataLength: number;
        stylePaddingBottom: number;
        useBootstrapInitialScroll: boolean;
        waitForInitialLayout?: boolean;
    },
) {
    const {
        dataLength,
        didDataChange,
        initialScrollAtEnd,
        previousDataLength,
        stylePaddingBottom,
        useBootstrapInitialScroll,
        waitForInitialLayout,
    } = options;
    const state = ctx.state;

    state.initialScrollPreviousDataLength = dataLength;

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
        state.initialScrollUsesOffset &&
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
