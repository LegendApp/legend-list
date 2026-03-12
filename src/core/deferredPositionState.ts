import { peek$, type StateContext } from "@/state/state";
import type { InternalState } from "@/types.base";
import { IS_DEV } from "@/utils/devEnvironment";
import { requestAdjust } from "@/utils/requestAdjust";

const DEFERRED_POSITION_FLUSH_HARD_CAP_PX = 800;
const DEFERRED_POSITION_FLUSH_SAFETY_THRESHOLD_PX = 400;

export function resetDeferredPositionState(state: InternalState) {
    state.deferredPositionDelta = 0;
    state.pendingDeferredSizeShift = 0;
    state.pendingDeferredSizeShiftMinIndex = Infinity;
}

function logDeferredPositionEvent(event: string, details: Record<string, unknown>) {
    if (!IS_DEV) {
        return;
    }

    console.log(`[legend-list][deferred-position] ${event}`, details);
}

export function hasDeferredPositionState(state: InternalState) {
    return Math.abs(state.deferredPositionDelta) > 0.1 || state.pendingDeferredSizeShift !== 0;
}

export function rebaseDeferredPositionState(ctx: StateContext, reason: string) {
    const state = ctx.state;
    const didHaveDeferredState = hasDeferredPositionState(state);
    const pendingDeferredSizeShift = state.pendingDeferredSizeShift;
    const pendingDeferredSizeShiftMinIndex = state.pendingDeferredSizeShiftMinIndex;
    const deferredPositionDelta = state.deferredPositionDelta;
    const anchorId = state.idsInView.find((id) => state.indexByKey.get(id) !== undefined);
    const anchorIndex = anchorId !== undefined ? state.indexByKey.get(anchorId) : undefined;
    const anchorAbsolutePosition = anchorIndex !== undefined ? state.positions[anchorIndex] : undefined;
    const anchorContainerIndex = anchorId !== undefined ? state.containerItemKeys.get(anchorId) : undefined;
    const anchorContainerPosition =
        anchorContainerIndex !== undefined ? peek$(ctx, `containerPosition${anchorContainerIndex}`) : undefined;
    const scrollAdjust = state.scrollAdjustHandler.getAdjust();
    const scrollAdjustPending = peek$(ctx, "scrollAdjustPending") ?? 0;
    const visualProbeSeq = (state.deferredPositionDebugVisualSequence ?? 0) + 1;

    resetDeferredPositionState(state);
    if (didHaveDeferredState) {
        state.deferredPositionDebugVisualSequence = visualProbeSeq;
        state.deferredPositionDebugVisualProbe = {
            anchorContainerPositionAfter: undefined,
            anchorContainerPositionBefore: anchorContainerPosition,
            anchorId,
            createdAt: Date.now(),
            reason,
            scrollAdjustAfter: undefined,
            scrollAdjustAfterExpected: scrollAdjust + deferredPositionDelta,
            scrollAdjustBefore: scrollAdjust,
            seq: visualProbeSeq,
        };
        if (IS_DEV) {
            state.deferredPositionDebugPendingRebase = {
                anchorAbsolutePosition,
                anchorContainerPosition,
                anchorId,
                deferredPositionDelta,
                reason,
                scrollAdjust,
                scrollAdjustPending,
            };
        }
        logDeferredPositionEvent("rebase", {
            anchorAbsolutePosition,
            anchorContainerPosition,
            anchorId,
            deferredPositionDelta,
            pendingDeferredSizeShift,
            pendingDeferredSizeShiftMinIndex,
            reason,
            scroll: state.scroll,
            scrollAdjust,
            scrollAdjustPending,
        });
    }
    if (deferredPositionDelta !== 0) {
        requestAdjust(ctx, deferredPositionDelta);
    }

    return didHaveDeferredState;
}

export function flushDeferredPositionStateBoundary(ctx: StateContext, reason: string) {
    if (!rebaseDeferredPositionState(ctx, reason)) {
        return false;
    }

    ctx.state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
    return true;
}

export function flushDeferredPositionStateBeforeScroll(ctx: StateContext) {
    if (!flushDeferredPositionStateBoundary(ctx, "scrollTo")) {
        return false;
    }

    return true;
}

export function shouldFlushDeferredPositionForCap(params: {
    deferredPositionDelta: number;
    scrollLength: number;
    scrollState: number;
}) {
    const { deferredPositionDelta, scrollLength, scrollState } = params;
    const absDeferredPositionDelta = Math.abs(deferredPositionDelta);
    const hardCapPx = Math.max(scrollLength, DEFERRED_POSITION_FLUSH_HARD_CAP_PX);
    const relativeCapPx = Math.max(0, scrollState - DEFERRED_POSITION_FLUSH_SAFETY_THRESHOLD_PX);

    if (absDeferredPositionDelta >= hardCapPx) {
        return true;
    }
    if (absDeferredPositionDelta > relativeCapPx) {
        return true;
    }
    return false;
}
