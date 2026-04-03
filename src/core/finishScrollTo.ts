import { addTotalSize } from "@/core/addTotalSize";
import { finishInitialScroll } from "@/core/initialScroll";
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
            finishInitialScroll(ctx, {
                onFinished: resolvePendingScroll,
                preserveTarget: state.initialScrollUsesOffset && state.props.data.length === 0,
                recalculateItems: true,
                syncObservedOffset: state.initialScrollUsesOffset,
                waitForCompletionFrame: !!scrollingTo.waitForInitialScrollCompletionFrame,
            });
            return;
        }

        resolvePendingScroll?.();
    }
}
