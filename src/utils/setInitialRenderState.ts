import { setAdaptiveRender } from "@/core/adaptiveRender";
import { peek$, type StateContext, set$ } from "@/state/state";
import { INITIAL_DRAW_DISTANCE } from "@/utils/getEffectiveDrawDistance";

export function setInitialRenderState(
    ctx: StateContext,
    {
        didLayout,
        didInitialScroll,
    }: {
        didLayout?: boolean;
        didInitialScroll?: boolean;
    },
) {
    const { state } = ctx;
    const {
        loadStartTime,
        props: { onLoad },
    } = state;
    if (didLayout) {
        state.didContainersLayout = true;
    }
    if (didInitialScroll) {
        state.didFinishInitialScroll = true;
    }

    const isReadyToRender = Boolean(state.didContainersLayout && state.didFinishInitialScroll);
    if (isReadyToRender && !peek$(ctx, "readyToRender")) {
        set$(ctx, "readyToRender", true);
        setAdaptiveRender(ctx, "normal");

        if (state.props.drawDistance > INITIAL_DRAW_DISTANCE) {
            requestAnimationFrame(() => {
                state.triggerCalculateItemsInView?.();
            });
        }

        if (onLoad) {
            onLoad({ elapsedTimeInMs: Date.now() - loadStartTime });
        }
    }
}
