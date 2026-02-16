import { type StateContext, set$ } from "@/state/state";

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

    if (state.didContainersLayout && state.didFinishInitialScroll) {
        set$(ctx, "readyToRender", true);

        if (onLoad) {
            onLoad({ elapsedTimeInMs: Date.now() - loadStartTime });
        }
    }
}
