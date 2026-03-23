import { calculateOffsetWithOffsetPosition } from "@/core/calculateOffsetWithOffsetPosition";
import { checkFinishedScroll } from "@/core/checkFinishedScroll";
import { clampScrollOffset } from "@/core/clampScrollOffset";
import { flushDeferredPositionStateBoundary } from "@/core/deferredPositionState";
import { doScrollTo } from "@/core/doScrollTo";
import { Platform } from "@/platform/Platform";
import type { StateContext } from "@/state/state";
import type { ScrollTarget } from "@/types.base";
import { debugInitialScroll } from "@/utils/debugInitialScroll";

type ScrollToParams = ScrollTarget & {
    forceScroll?: boolean;
    noScrollingTo?: boolean;
};

export function scrollTo(ctx: StateContext, params: ScrollToParams) {
    const state = ctx.state;
    const { noScrollingTo, forceScroll, ...scrollTarget } = params;
    const { animated, isInitialScroll, offset: scrollTargetOffset, precomputedWithViewOffset } = scrollTarget;
    const {
        props: { horizontal },
    } = state;

    // Clear out previous timeouts which would finishScrollTo
    if (state.animFrameCheckFinishedScroll) {
        cancelAnimationFrame(ctx.state.animFrameCheckFinishedScroll);
    }
    if (state.timeoutCheckFinishedScrollFallback) {
        clearTimeout(ctx.state.timeoutCheckFinishedScrollFallback);
    }

    flushDeferredPositionStateBoundary(ctx);

    const requestedLogicalOffset = precomputedWithViewOffset
        ? scrollTargetOffset
        : calculateOffsetWithOffsetPosition(ctx, scrollTargetOffset, scrollTarget);
    const offset = clampScrollOffset(ctx, requestedLogicalOffset, scrollTarget);
    const clampDelta = requestedLogicalOffset - offset;
    const nextLogicalTargetOffset =
        noScrollingTo && state.scrollingTo?.isInitialScroll
            ? (state.scrollingTo.logicalTargetOffset ?? state.scrollingTo.targetOffset ?? state.scrollingTo.offset)
            : requestedLogicalOffset;
    const shouldDeferClampedQueuedInitialScrollToBootstrap =
        !noScrollingTo &&
        !!forceScroll &&
        !!isInitialScroll &&
        !!precomputedWithViewOffset &&
        !!state.didDispatchNativeScroll &&
        !!state.scrollingTo?.isInitialScroll &&
        !!state.queuedInitialLayout &&
        !!state.initialBootstrap &&
        !state.initialScrollUsesOffset &&
        clampDelta > 1;

    if (isInitialScroll) {
        debugInitialScroll("scrollTo", {
            clampDelta,
            forceScroll,
            nextLogicalTargetOffset,
            noScrollingTo,
            offset,
            precomputedWithViewOffset,
            requestedLogicalOffset,
            scrollTargetIndex: scrollTarget.index,
            scrollTargetOffset,
            scrollTargetViewOffset: scrollTarget.viewOffset,
            scrollTargetViewPosition: scrollTarget.viewPosition,
            shouldDeferClampedQueuedInitialScrollToBootstrap,
        });
    }

    if (noScrollingTo && state.scrollingTo?.isInitialScroll) {
        state.scrollingTo = {
            ...state.scrollingTo,
            logicalTargetOffset: nextLogicalTargetOffset,
            offset,
        };
    }

    const activeInitialTargetOffset = state.scrollingTo?.isInitialScroll
        ? (state.scrollingTo.logicalTargetOffset ?? state.scrollingTo.targetOffset ?? state.scrollingTo.offset)
        : undefined;
    const shouldForceCorrectiveInitialNativeScroll =
        !!forceScroll && !!noScrollingTo && !!isInitialScroll && !!state.scrollingTo?.isInitialScroll;
    state.pendingCorrectiveInitialClamp = shouldForceCorrectiveInitialNativeScroll;
    const isDuplicateSettledInitialScroll =
        !state.didFinishInitialScroll &&
        !shouldForceCorrectiveInitialNativeScroll &&
        isInitialScroll &&
        activeInitialTargetOffset !== undefined &&
        Math.abs(activeInitialTargetOffset - offset) <= 1 &&
        Math.abs(state.scroll - offset) <= 1 &&
        Math.abs(state.scrollPending - offset) <= 1;
    if (isDuplicateSettledInitialScroll) {
        debugInitialScroll("scrollTo-skip-duplicate", {
            activeInitialTargetOffset,
            offset,
            scroll: state.scroll,
            scrollPending: state.scrollPending,
        });
        checkFinishedScroll(ctx);
        return;
    }

    // Disable scroll adjust while scrolling so that it doesn't do extra work affecting the target offset
    state.scrollHistory.length = 0;

    // noScrollingTo is used for the workaround in mvcp to fake it with scroll
    if (!noScrollingTo) {
        state.didRetrySilentInitialScroll = undefined;
        state.scrollingTo = {
            ...scrollTarget,
            logicalTargetOffset: nextLogicalTargetOffset,
            targetOffset: offset,
        };
    }

    if (shouldDeferClampedQueuedInitialScrollToBootstrap) {
        debugInitialScroll("scrollTo-defer-bootstrap", {
            clampDelta,
            didDispatchNativeScroll: !!state.didDispatchNativeScroll,
            offset,
            queuedInitialLayout: !!state.queuedInitialLayout,
        });
        return;
    }

    state.scrollPending = offset;

    if (forceScroll || !isInitialScroll || Platform.OS === "android") {
        if (isInitialScroll) {
            debugInitialScroll("scrollTo-doScrollTo", {
                forceScroll,
                horizontal,
                offset,
            });
        }
        doScrollTo(ctx, { animated, horizontal, isInitialScroll, offset });
    } else {
        state.scroll = offset;
        if (isInitialScroll) {
            debugInitialScroll("scrollTo-apply-local", {
                offset,
            });
        }
    }
}
