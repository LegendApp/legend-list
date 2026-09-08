import { addTotalSize } from "@/core/addTotalSize";
import { cancelScrollCompletionChecks } from "@/core/cancelImperativeScroll";
import { doMaintainScrollAtEnd } from "@/core/doMaintainScrollAtEnd";
import { finishInitialScroll } from "@/core/finishInitialScroll";
import { recalculateSettledScroll } from "@/core/recalculateSettledScroll";
import { PlatformAdjustBreaksScroll } from "@/platform/Platform";
import type { StateContext } from "@/state/state";

export function finishScrollTo(ctx: StateContext) {
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

        state.scrollHistory.length = 0;
        state.scrollingTo = undefined;
        state.scrollTargetPinnedRange = undefined;

        if (state.pendingTotalSize !== undefined) {
            addTotalSize(ctx, null, state.pendingTotalSize);
        }

        if (PlatformAdjustBreaksScroll) {
            state.scrollAdjustHandler.commitPendingAdjust(scrollingTo);
        }

        if (scrollingTo.isInitialScroll || state.initialScroll) {
            const isOffsetSession = state.initialScrollSession?.kind === "offset";
            const shouldPreserveResizeTarget =
                !!scrollingTo.isInitialScroll &&
                !state.clearPreservedInitialScrollOnNextFinish &&
                state.props.data.length > 0 &&
                state.initialScroll?.viewPosition === 1;
            finishInitialScroll(ctx, {
                onFinished: () => {
                    resolvePendingScroll?.();
                },
                preserveTarget: (isOffsetSession && state.props.data.length === 0) || shouldPreserveResizeTarget,
                recalculateItems: true,
                schedulePreservedTargetClear: shouldPreserveResizeTarget,
                syncObservedOffset: isOffsetSession,
                waitForCompletionFrame: !!scrollingTo.waitForInitialScrollCompletionFrame,
            });
            return;
        }

        recalculateSettledScroll(ctx);
        resolvePendingScroll?.();
        if (state.pendingMaintainScrollAtEnd) {
            state.maintainingScrollAtEnd = undefined;
            doMaintainScrollAtEnd(ctx);
        }
    }
}
