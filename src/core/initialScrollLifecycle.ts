import {
    handleBootstrapInitialScrollDataChange,
    handleBootstrapInitialScrollFooterLayout,
    shouldUseBootstrapInitialScroll,
    startBootstrapInitialScrollOnMount,
} from "@/core/bootstrapInitialScroll";
import { checkFinishedScroll, shouldQueueAlignedInitialScrollCompletionCheck } from "@/core/checkFinishedScroll";
import {
    advanceMeasuredInitialScroll,
    advanceOffsetInitialScroll,
    finishInitialScroll,
    getInitialContentOffsetForMount,
    setInitialScrollTarget,
} from "@/core/initialScroll";
import {
    getInitialScrollSessionKind,
    getInitialScrollSessionPreviousDataLength,
    setInitialScrollSessionPreviousDataLength,
    syncInitialScrollSessionFromLegacyState,
} from "@/core/initialScrollSession";
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

    const runScroll = () => continueInitialScroll(ctx, { forceScroll: true });

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
    const previousDataLength = getInitialScrollSessionPreviousDataLength(state);

    setInitialScrollSessionPreviousDataLength(state, dataLength);
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
