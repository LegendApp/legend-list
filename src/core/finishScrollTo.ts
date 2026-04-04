import { addTotalSize } from "@/core/addTotalSize";
import { shouldPreserveInitialScrollTargetOnFinish } from "@/core/bootstrapInitialScroll";
import { finishInitialScroll } from "@/core/initialScroll";
import { getInitialScrollSessionKind } from "@/core/initialScrollSession";
import { PlatformAdjustBreaksScroll } from "@/platform/Platform";
import type { StateContext } from "@/state/state";

export function finishScrollTo(ctx: StateContext) {
    const state = ctx.state;
    if (state?.scrollingTo) {
        const resolvePendingScroll = state.pendingScrollResolve;
        state.pendingScrollResolve = undefined;

        // Save scrollingTo before clearing it so we can pass it to commitPendingAdjust
        const scrollingTo = state.scrollingTo;

        state.scrollHistory.length = 0;
        state.scrollingTo = undefined;

        if (state.pendingTotalSize !== undefined) {
            addTotalSize(ctx, null, state.pendingTotalSize);
        }

        if (PlatformAdjustBreaksScroll) {
            state.scrollAdjustHandler.commitPendingAdjust(scrollingTo);
        }

        if (scrollingTo.isInitialScroll || state.initialScroll) {
            const isOffsetSession = getInitialScrollSessionKind(state) === "offset";
            finishInitialScroll(ctx, {
                onFinished: resolvePendingScroll,
                preserveTarget:
                    (isOffsetSession && state.props.data.length === 0) ||
                    shouldPreserveInitialScrollTargetOnFinish(state, scrollingTo),
                recalculateItems: true,
                syncObservedOffset: isOffsetSession,
                waitForCompletionFrame: !!scrollingTo.waitForInitialScrollCompletionFrame,
            });
            return;
        }

        resolvePendingScroll?.();
    }
}
