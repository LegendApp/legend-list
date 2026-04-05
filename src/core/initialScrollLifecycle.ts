import {
    handleBootstrapInitialScrollDataChange,
    startBootstrapInitialScrollOnMount,
} from "@/core/bootstrapInitialScroll";
import { checkFinishedScroll } from "@/core/checkFinishedScroll";
import { advanceCurrentInitialScrollSession, finishInitialScroll, setInitialScrollTarget } from "@/core/initialScroll";
import { getInitialScrollSessionKind, setInitialScrollSession } from "@/core/initialScrollSession";
import { getResolvedScrollCompletionState } from "@/core/resolvedScrollCompletion";
import type { StateContext } from "@/state/state";
import { setInitialRenderState } from "@/utils/setInitialRenderState";

function shouldQueueAlignedInitialScrollCompletionCheck(ctx: StateContext) {
    const { state } = ctx;
    const scrollingTo = state.scrollingTo;
    if (!scrollingTo?.isInitialScroll || scrollingTo.animated) {
        return false;
    }

    return getResolvedScrollCompletionState(ctx, scrollingTo).isAtResolvedTarget;
}

export function handleInitialScrollLayoutReady(ctx: StateContext) {
    if (!ctx.state.initialScroll) {
        return;
    }

    const runScroll = () => advanceCurrentInitialScrollSession(ctx, { forceScroll: true });

    // Perform a second pass on the next frame to settle with measured sizes.
    runScroll();
    if (getInitialScrollSessionKind(ctx.state) !== "offset") {
        requestAnimationFrame(runScroll);
    }

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
    const previousDataLength = state.initialScrollSession?.previousDataLength ?? 0;

    if (state.initialScrollSession) {
        state.initialScrollSession.previousDataLength = dataLength;
    }
    setInitialScrollSession(state);

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
        ctx.state.initialScrollSession?.kind === "offset" &&
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

    advanceCurrentInitialScrollSession(ctx, {
        waitForInitialLayout,
    });
}
