import {
    handleBootstrapInitialScrollDataChange,
    startBootstrapInitialScrollOnMount,
} from "@/core/bootstrapInitialScroll";
import { cancelImperativeScroll, syncScrollActive } from "@/core/cancelImperativeScroll";
import { checkFinishedScroll } from "@/core/checkFinishedScroll";
import { clearPreservedInitialScrollTarget, finishInitialScroll } from "@/core/finishInitialScroll";
import { getDataLength, getIndexedData } from "@/core/IndexedData";
import { advanceCurrentInitialScrollSession, setInitialScrollTarget } from "@/core/initialScroll";
import { schedulePreservedEndAnchorCorrection } from "@/core/initialScrollAnchor";
import { rebuildLayoutStoreExact, syncLayoutStoreState } from "@/core/layoutStoreLifecycle";
import { resetLayoutCachesForDataChange } from "@/core/resetLayoutCachesForDataChange";
import { type StateContext, set$ } from "@/state/state";
import { resetInitialRenderState, setInitialRenderState } from "@/utils/setInitialRenderState";

export function retargetActiveInitialScrollAtEnd(ctx: StateContext) {
    const state = ctx.state;
    const initialScroll = state.initialScroll;
    if (state.didFinishInitialScroll) {
        return schedulePreservedEndAnchorCorrection(ctx);
    }

    if (
        !initialScroll ||
        state.initialScroll?.kind === "offset" ||
        initialScroll.viewPosition !== 1 ||
        getDataLength(state) === 0
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
    if (ctx.state.initialScroll?.kind !== "offset") {
        ctx.state.scheduledWork.frame(runScroll, "initialScrollLayout");
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
                state.initialScroll?.kind !== "offset"))
    ) {
        setInitialScrollTarget(ctx, {
            ...initialScroll,
            contentOffset: resolvedInitialContentOffset,
            preserveForFooterLayout,
        });
    }

    if (useBootstrapInitialScroll && initialScroll && state.initialScroll?.kind !== "offset") {
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
        latestInitialScrollSessionKind: "index" | "end" | "offset";
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
    const previousInitialScrollDataLength = state.initialScroll?.previousDataLength ?? 0;
    const shouldUseLatestInitialScroll = dataLength > 0 && (!state.hasHadNonEmptyData || didStartFreshData);

    if (didStartFreshData) {
        // The previous dataset's scroll must not block or finish the new bootstrap.
        cancelImperativeScroll(state);
        syncScrollActive(ctx);
        state.endFollowInterrupted = false;
        state.userScrollContentSize = undefined;
        state.visibleContentAnchor = undefined;
        state.pendingEndMeasurements = undefined;
        set$(ctx, "isFollowingEnd", false);
        state.maintainingScrollAtEnd = undefined;
        state.pendingMaintainScrollAtEnd = false;
    }

    if (dataLength > 0) {
        state.hasHadNonEmptyData = true;
    }

    if (shouldUseLatestInitialScroll) {
        if (latestInitialScroll) {
            setInitialScrollTarget(ctx, {
                ...latestInitialScroll,
                kind: latestInitialScrollSessionKind,
                previousDataLength: previousInitialScrollDataLength,
            });
        } else {
            clearPreservedInitialScrollTarget(state);
        }
    }

    if (state.initialScroll) {
        state.initialScroll.previousDataLength = dataLength;
    }

    if (useBootstrapInitialScroll) {
        if (didStartFreshData && !state.didColumnsChange) {
            resetLayoutCachesForDataChange(state);
            if (!state.props.dataSource && (state.sizesKnown.size || state.sizes.size)) {
                // A dataKey can return to an earlier array while retaining its measured keys.
                const data = getIndexedData(state);
                for (let index = 0; index < dataLength; index++) {
                    const key = data.getKey(index);
                    if (state.sizesKnown.has(key) || state.sizes.has(key)) {
                        state.idCache[index] = key;
                        state.indexByKey.set(key, index);
                    }
                }
            }
            rebuildLayoutStoreExact(ctx);
            syncLayoutStoreState(ctx);
        }
        handleBootstrapInitialScrollDataChange(ctx, {
            dataLength,
            didDataChange,
            initialScrollAtEnd,
            // A new dataset reuses the empty-to-non-empty bootstrap handoff.
            previousDataLength: didStartFreshData ? 0 : previousInitialScrollDataLength,
            stylePaddingEnd,
        });
        return;
    }

    const shouldReplayFinishedOffsetInitialScroll =
        previousInitialScrollDataLength === 0 &&
        dataLength > 0 &&
        !!state.initialScroll &&
        ctx.state.initialScroll?.kind === "offset" &&
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
