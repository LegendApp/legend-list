import type { StateContext } from "@/state/state";
import { checkAtBottom } from "@/utils/checkAtBottom";
import { performInitialScroll } from "@/utils/performInitialScroll";
import { setInitialRenderState } from "@/utils/setInitialRenderState";

export function setDidLayout(ctx: StateContext) {
    const state = ctx.state;
    const { initialScroll } = state;
    state.queuedInitialLayout = true;
    checkAtBottom(ctx);

    if (initialScroll) {
        const runScroll = () => {
            const target = state.initialScroll;
            if (!target) {
                return;
            }

            const activeInitialTargetOffset = state.scrollingTo?.isInitialScroll
                ? (state.scrollingTo.targetOffset ?? state.scrollingTo.offset)
                : undefined;
            const isAlreadyAtActiveInitialTarget =
                activeInitialTargetOffset !== undefined &&
                Math.abs(state.scroll - activeInitialTargetOffset) <= 1 &&
                Math.abs(state.scrollPending - activeInitialTargetOffset) <= 1;
            if (!isAlreadyAtActiveInitialTarget) {
                performInitialScroll(ctx, {
                    forceScroll: true,
                    initialScrollUsesOffset: state.initialScrollUsesOffset,
                    // Offset-based initial scrolls do not need item lookup, so they can run even before data exists.
                    // Re-run on the next frame to pick up measured viewport size without waiting for index resolution.
                    target,
                });
            }
        };

        // Perform a second pass on the next frame to settle with measured sizes.
        runScroll();
        requestAnimationFrame(runScroll);
    }

    setInitialRenderState(ctx, { didLayout: true });
}
