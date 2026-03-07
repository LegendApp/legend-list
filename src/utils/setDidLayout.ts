import { scrollTo } from "@/core/scrollTo";
import { scrollToIndex } from "@/core/scrollToIndex";
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
            const target = state.initialScroll;
            if (!target) {
                return;
            }

            if (state.initialScrollUsesOffset) {
                scrollTo(ctx, {
                    animated: false,
                    forceScroll: true,
                    isInitialScroll: true,
                    offset: target.contentOffset ?? 0,
                });
                return;
            }

            if (target.index === undefined) {
                return;
            }

            scrollToIndex(ctx, {
                ...target,
                animated: false,
                forceScroll: true,
                isInitialScroll: true,
            });
        };

        // Perform a second pass on the next frame to settle with measured sizes.
        runScroll();
        requestAnimationFrame(runScroll);
    }

    setInitialRenderState(ctx, { didLayout: true });
}
