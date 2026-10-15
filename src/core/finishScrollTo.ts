import { addTotalSize } from "@/core/addTotalSize";
import { cancelScrollCompletionChecks } from "@/core/cancelImperativeScroll";
import { doMaintainScrollAtEnd, finishMaintainScrollAtEnd } from "@/core/doMaintainScrollAtEnd";
import { finishInitialScroll } from "@/core/finishInitialScroll";
import { recalculateSettledScroll } from "@/core/recalculateSettledScroll";
import { PlatformAdjustBreaksScroll } from "@/platform/Platform";
import { type StateContext, set$ } from "@/state/state";
import type { LegendListScrollResult } from "@/types.base";
import type { LegendListScrollResult } from "@/types.base";

export function finishScrollTo(ctx: StateContext, result?: LegendListScrollResult) {
    const state = ctx.state;
    if (state?.scrollingTo) {
        cancelScrollCompletionChecks(state);
        // An older active scroll can finish while its replacement still waits for layout.
        // Its completion must not settle or release the newer request's ownership.
        const resolvePendingScroll = ctx.scrollRequestTracker?.isWaitingToRun()
            ? undefined
            : state.pendingScrollResolve;
        if (resolvePendingScroll) {
            state.pendingScrollResolve = undefined;
        }

        // Save scrollingTo before clearing it so we can pass it to commitPendingAdjust
        const scrollingTo = state.scrollingTo;

        if (result?.reason === "interrupted" && (state.maintainingScrollAtEnd || state.pendingMaintainScrollAtEnd)) {
            finishMaintainScrollAtEnd(ctx);
        }

        state.scrollHistory.length = 0;
        state.scrollingTo = undefined;
        state.scrollTargetPinnedRange = undefined;
        set$(ctx, "isScrollActive", !!state.isDragging || !!state.isMomentumScrolling || !!state.pendingScrollResolve);

        if (state.pendingTotalSize !== undefined) {
            addTotalSize(ctx, null, state.pendingTotalSize);
        }

        if (PlatformAdjustBreaksScroll) {
            // After user input, keep the deferred adjustment relative to where the user is instead of
            // retargeting the abandoned index.
            state.scrollAdjustHandler.commitPendingAdjust(
                result?.reason === "interrupted" ? { ...scrollingTo, index: undefined } : scrollingTo,
            );
        }

        const complete = () => {
            resolvePendingScroll?.(result);
            if (state.pendingMaintainScrollAtEnd) {
                state.maintainingScrollAtEnd = undefined;
                doMaintainScrollAtEnd(ctx, { immediate: !!scrollingTo.isInitialScroll });
            }
        };

        if (scrollingTo.isInitialScroll || state.initialScroll) {
            const isOffsetSession = state.initialScrollSession?.kind === "offset";
            const shouldPreserveResizeTarget =
                !!scrollingTo.isInitialScroll &&
                !state.clearPreservedInitialScrollOnNextFinish &&
                state.props.data.length > 0 &&
                state.initialScroll?.viewPosition === 1;
            finishInitialScroll(ctx, {
                onFinished: complete,
                preserveTarget: (isOffsetSession && state.props.data.length === 0) || shouldPreserveResizeTarget,
                recalculateItems: true,
                schedulePreservedTargetClear: shouldPreserveResizeTarget,
                syncObservedOffset: isOffsetSession,
                waitForCompletionFrame: !!scrollingTo.waitForInitialScrollCompletionFrame,
            });
            return;
        }

        recalculateSettledScroll(ctx);
        complete();
    }
}
