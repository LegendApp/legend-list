import { checkFinishedScroll } from "@/core/checkFinishedScroll";
import { advanceInitialScroll } from "@/core/initialScroll";
import type { StateContext } from "@/state/state";
import { checkAtBottom } from "@/utils/checkAtBottom";
import { setInitialRenderState } from "@/utils/setInitialRenderState";

export function setDidLayout(ctx: StateContext) {
    const state = ctx.state;
    const { initialScroll } = state;
    state.queuedInitialLayout = true;
    checkAtBottom(ctx);

    if (initialScroll) {
        const runScroll = () => {
            advanceInitialScroll(ctx, { forceScroll: true });
        };

        // Perform a second pass on the next frame to settle with measured sizes.
        runScroll();
        requestAnimationFrame(runScroll);
    }

    setInitialRenderState(ctx, { didLayout: true });

    const scrollingTo = state.scrollingTo;
    const targetOffset = scrollingTo?.targetOffset ?? scrollingTo?.offset;
    if (
        scrollingTo?.isInitialScroll &&
        !scrollingTo.animated &&
        targetOffset !== undefined &&
        Math.abs(state.scroll - targetOffset) <= 1 &&
        Math.abs(state.scrollPending - targetOffset) <= 1
    ) {
        checkFinishedScroll(ctx);
    }
}
