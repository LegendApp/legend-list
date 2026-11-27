import { addTotalSize } from "@/core/addTotalSize";
import { cancelScrollCompletionChecks, syncScrollActive } from "@/core/cancelImperativeScroll";
import { doMaintainScrollAtEnd } from "@/core/doMaintainScrollAtEnd";
import { finishInitialScroll } from "@/core/finishInitialScroll";
import { getDataLength } from "@/core/IndexedData";
import { recalculateSettledScroll } from "@/core/recalculateSettledScroll";
import { Platform, PlatformAdjustBreaksScroll } from "@/platform/Platform";
import type { StateContext } from "@/state/state";

export function finishScrollTo(ctx: StateContext) {
    const state = ctx.state;
    if (state?.scrollingTo) {
        // A silent-dispatch retry nudged the native offset away and returns on the next frame; return now instead.
        state.scheduledWork.flush("checkFinishedScrollRetryFrame");
        cancelScrollCompletionChecks(state);
        // An older active scroll must not settle a replacement still waiting for layout.
        const resolvePendingScroll = ctx.scrollRequestTracker?.isWaitingToRun()
            ? undefined
            : state.pendingScrollResolve;

        // Save scrollingTo before clearing it so we can pass it to commitPendingAdjust
        const scrollingTo = state.scrollingTo;
        const finishesInitialScroll = scrollingTo.isInitialScroll || state.initialScroll !== undefined;
        const waitForCompletionFrame = finishesInitialScroll && !!scrollingTo.waitForInitialScrollCompletionFrame;
        // A deferred reveal still owns its promise. Unmount or supersession can settle it.
        if (!waitForCompletionFrame && resolvePendingScroll) state.pendingScrollResolve = undefined;

        state.scrollHistory.length = 0;
        state.scrollingTo = undefined;
        state.scrollTargetPinnedRange = undefined;
        syncScrollActive(ctx);

        if (state.pendingTotalSize !== undefined) {
            addTotalSize(ctx, null, state.pendingTotalSize);
        }

        if (PlatformAdjustBreaksScroll || Platform.OS === "macos") {
            state.scrollAdjustHandler.commitPendingAdjust(scrollingTo);
        }

        const complete = () => {
            if (!waitForCompletionFrame) {
                resolvePendingScroll?.();
            } else if (resolvePendingScroll && state.pendingScrollResolve === resolvePendingScroll) {
                state.pendingScrollResolve = undefined;
                resolvePendingScroll();
                syncScrollActive(ctx);
            }
            if (state.pendingMaintainScrollAtEnd) {
                state.maintainingScrollAtEnd = undefined;
                doMaintainScrollAtEnd(ctx, { immediate: !!scrollingTo.isInitialScroll });
            }
        };

        if (finishesInitialScroll) {
            const isOffsetSession = state.initialScroll?.kind === "offset";
            const shouldPreserveResizeTarget =
                !!scrollingTo.isInitialScroll && getDataLength(state) > 0 && state.initialScroll?.viewPosition === 1;
            finishInitialScroll(ctx, {
                onFinished: complete,
                preserveTarget: (isOffsetSession && getDataLength(state) === 0) || shouldPreserveResizeTarget,
                recalculateItems: true,
                syncObservedOffset: isOffsetSession,
                waitForCompletionFrame,
            });
            return;
        }

        recalculateSettledScroll(ctx);
        complete();
    }
}
