import {
    handleBootstrapInitialScrollDataChange,
    schedulePreservedEndAnchorCorrection,
    startBootstrapInitialScrollOnMount,
} from "@/core/bootstrapInitialScroll";
import { cancelImperativeScroll } from "@/core/cancelImperativeScroll";
import { checkFinishedScroll } from "@/core/checkFinishedScroll";
import { resetColumnLayoutCaches } from "@/core/checkResetContainers";
import { clearPreservedInitialScrollTarget, finishInitialScroll } from "@/core/finishInitialScroll";
import { advanceCurrentInitialScrollSession, setInitialScrollTarget } from "@/core/initialScroll";
import { setInitialScrollSession } from "@/core/initialScrollSession";
import { resetLayoutCachesForDataChange } from "@/core/resetLayoutCachesForDataChange";
import { updateItemPositions } from "@/core/updateItemPositions";
import { type StateContext, set$ } from "@/state/state";
import { hasActiveInitialScroll } from "@/utils/hasActiveInitialScroll";
import { resetInitialRenderState, setInitialRenderState } from "@/utils/setInitialRenderState";

export function retargetActiveInitialScrollAtEnd(ctx: StateContext) {
    const state = ctx.state;
    const initialScroll = state.initialScroll;
    if (state.didFinishInitialScroll) {
        return schedulePreservedEndAnchorCorrection(ctx);
    }

    if (
        !initialScroll ||
        state.initialScrollSession?.kind === "offset" ||
        initialScroll.viewPosition !== 1 ||
        state.props.data.length === 0
    ) {
        return false;
    }

    return advanceCurrentInitialScrollSession(ctx, { forceScroll: true });
}

export function handleInitialScrollLayoutReady(ctx: StateContext) {
    if (!ctx.state.initialScroll) {
        return;
    }

    const runScroll = () => advanceCurrentInitialScrollSession(ctx, { forceScroll: true });

    // Perform a second pass on the next frame to settle with measured sizes.
    runScroll();
    if (ctx.state.initialScrollSession?.kind !== "offset") {
        requestAnimationFrame(runScroll);
    }

    checkFinishedScroll(ctx, { onlyIfAligned: true });
}

export function initializeInitialScrollOnMount(
    ctx: StateContext,
    options: {
        alwaysDispatchInitialScroll?: boolean;
        dataLength: number;
        hasFooterComponent: boolean;
        initialContentOffset: number | undefined;
        initialScrollAtEnd: boolean;
        useBootstrapInitialScroll: boolean;
    },
) {
    const {
        alwaysDispatchInitialScroll,
        dataLength,
        hasFooterComponent,
        initialContentOffset,
        initialScrollAtEnd,
        useBootstrapInitialScroll,
    } = options;
    const state = ctx.state;
    const initialScroll = state.initialScroll;
    const resolvedInitialContentOffset = initialContentOffset ?? 0;
    const preserveForFooterLayout = useBootstrapInitialScroll && initialScrollAtEnd && hasFooterComponent;

    if (
        initialScroll &&
        (initialScroll.contentOffset === undefined ||
            (!!initialScroll.preserveForFooterLayout !== preserveForFooterLayout &&
                state.initialScrollSession?.kind !== "offset"))
    ) {
        setInitialScrollTarget(ctx, {
            ...initialScroll,
            contentOffset: resolvedInitialContentOffset,
            preserveForFooterLayout,
        });
    }

    if (useBootstrapInitialScroll && initialScroll && state.initialScrollSession?.kind !== "offset") {
        startBootstrapInitialScrollOnMount(ctx, {
            initialScrollAtEnd,
            target: state.initialScroll!,
        });
        return;
    }

    const hasPendingDataDependentInitialScroll =
        !!initialScroll && dataLength === 0 && !(resolvedInitialContentOffset === 0 && !initialScrollAtEnd);
    if (!alwaysDispatchInitialScroll && !resolvedInitialContentOffset && !hasPendingDataDependentInitialScroll) {
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
        didStartFreshData?: boolean;
        initialScrollAtEnd: boolean;
        latestInitialScroll: StateContext["state"]["initialScroll"];
        latestInitialScrollSessionKind: "bootstrap" | "offset";
        stylePaddingEnd: number;
        useBootstrapInitialScroll: boolean;
    },
) {
    const {
        dataLength,
        didDataChange,
        didStartFreshData,
        initialScrollAtEnd,
        latestInitialScroll,
        latestInitialScrollSessionKind,
        stylePaddingEnd,
        useBootstrapInitialScroll,
    } = options;
    const state = ctx.state;
    const previousInitialScrollDataLength = state.initialScrollSession?.previousDataLength ?? 0;
    const shouldUseLatestInitialScroll = dataLength > 0 && (!state.hasHadNonEmptyData || didStartFreshData);

    if (didStartFreshData) {
        // The previous dataset's scroll must not block or finish the new bootstrap.
        cancelImperativeScroll(state);
        set$(ctx, "isScrollActive", !!state.isDragging || !!state.isMomentumScrolling);
        state.endFollowInterrupted = false;
        state.didDeferMaintainScrollAtEndForMomentum = false;
        state.momentumSuspendContentSize = undefined;
        state.momentumSuspendCompensated = false;
        state.visibleContentAnchor = undefined;
        state.pendingEndMeasurements = undefined;
        state.scrollElementTarget = undefined;
        set$(ctx, "isFollowingEnd", false);
        state.maintainingScrollAtEnd = undefined;
        state.pendingMaintainScrollAtEnd = false;
    }

    if (didStartFreshData || (didDataChange && hasActiveInitialScroll(state))) {
        // Bootstrap and container allocation must use the same destination geometry.
        set$(ctx, "numColumns", state.props.numColumns);
        if (state.didColumnsChange) {
            resetColumnLayoutCaches(state);
        }
        resetLayoutCachesForDataChange(state);
        updateItemPositions(ctx, true);
        state.preparedDataLayoutEpoch = state.dataChangeEpoch;
    }

    if (dataLength > 0) {
        state.hasHadNonEmptyData = true;
    }

    if (shouldUseLatestInitialScroll) {
        if (latestInitialScroll) {
            setInitialScrollTarget(ctx, latestInitialScroll);
            setInitialScrollSession(state, {
                kind: latestInitialScrollSessionKind,
                previousDataLength: previousInitialScrollDataLength,
            });
        } else {
            clearPreservedInitialScrollTarget(state);
        }
    }

    if (state.initialScrollSession) {
        state.initialScrollSession.previousDataLength = dataLength;
    }
    setInitialScrollSession(state);

    if (useBootstrapInitialScroll) {
        handleBootstrapInitialScrollDataChange(ctx, {
            dataLength,
            didDataChange,
            initialScrollAtEnd,
            previousDataLength: previousInitialScrollDataLength,
            stylePaddingEnd,
        });
        return;
    }

    const shouldReplayFinishedOffsetInitialScroll =
        previousInitialScrollDataLength === 0 &&
        dataLength > 0 &&
        !!state.initialScroll &&
        ctx.state.initialScrollSession?.kind === "offset" &&
        !!state.didFinishInitialScroll;

    if (
        previousInitialScrollDataLength !== 0 ||
        dataLength === 0 ||
        !state.initialScroll ||
        !state.queuedInitialLayout ||
        (state.didFinishInitialScroll && !shouldReplayFinishedOffsetInitialScroll)
    ) {
        return;
    }

    if (shouldReplayFinishedOffsetInitialScroll) {
        resetInitialRenderState(ctx, { resetInitialScroll: true });
    }

    advanceCurrentInitialScrollSession(ctx);
}
