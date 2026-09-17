import { addTotalSize } from "@/core/addTotalSize";
import { cancelScrollCompletionChecks } from "@/core/cancelImperativeScroll";
import { doMaintainScrollAtEnd } from "@/core/doMaintainScrollAtEnd";
import { finishInitialScroll } from "@/core/finishInitialScroll";
import { getDataLength } from "@/core/IndexedData";
import { recalculateSettledScroll } from "@/core/recalculateSettledScroll";
import { PlatformAdjustBreaksScroll } from "@/platform/Platform";
import type { StateContext } from "@/state/state";

export function finishScrollTo(ctx: StateContext) {
    const state = ctx.state;
    if (state?.scrollingTo) {
        cancelScrollCompletionChecks(state);
        // An older active scroll must not settle a replacement still waiting for layout.
        const pendingResolve = ctx.scrollRequestTracker?.isWaitingToRun() ? undefined : state.pendingScrollResolve;
        const resolvePendingScroll = () => {
            if (state.pendingScrollResolve === pendingResolve) state.pendingScrollResolve = undefined;
            pendingResolve?.();
        };

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
            const isOffsetSession = state.initialScroll?.kind === "offset";
            const shouldPreserveResizeTarget =
                !!scrollingTo.isInitialScroll && getDataLength(state) > 0 && state.initialScroll?.viewPosition === 1;
            finishInitialScroll(ctx, {
                onFinished: () => {
                    resolvePendingScroll?.();
                },
                preserveTarget: (isOffsetSession && getDataLength(state) === 0) || shouldPreserveResizeTarget,
                recalculateItems: true,
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
