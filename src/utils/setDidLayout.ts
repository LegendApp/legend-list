import { scrollToIndex } from "@/core/scrollToIndex";
import type { StateContext } from "@/state/state";
import { checkAtBottom } from "@/utils/checkAtBottom";
import { setInitialRenderState } from "@/utils/setInitialRenderState";

export function setDidLayout(ctx: StateContext) {
    const state = ctx.state;
    const {
        loadStartTime,
        initialScroll,
        props: { onLoad },
    } = state;
    state.queuedInitialLayout = true;
    checkAtBottom(ctx);

    const setIt = () => {
        setInitialRenderState(ctx, { didLayout: true });

        if (onLoad) {
            onLoad({ elapsedTimeInMs: Date.now() - loadStartTime });
        }
    };

    if (initialScroll?.index !== undefined) {
        const target = initialScroll;
        const runScroll = () => scrollToIndex(ctx, { ...target, animated: false });

        // Perform a second pass on the next frame to settle with measured sizes.
        runScroll();
        requestAnimationFrame(runScroll);
    }

    setIt();
}
