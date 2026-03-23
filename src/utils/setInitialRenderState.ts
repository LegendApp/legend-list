import { peek$, type StateContext, set$ } from "@/state/state";
import { debugInitialScroll, shouldDebugInitialScrollState } from "@/utils/debugInitialScroll";

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
    if (shouldDebugInitialScrollState(state)) {
        debugInitialScroll("setInitialRenderState", {
            didFinishInitialScroll: !!state.didFinishInitialScroll,
            didInitialScroll: !!didInitialScroll,
            didLayout: !!didLayout,
            didContainersLayout: !!state.didContainersLayout,
            isReadyToRender,
            readyToRender: !!peek$(ctx, "readyToRender"),
        });
    }
    if (isReadyToRender && !peek$(ctx, "readyToRender")) {
        set$(ctx, "readyToRender", true);
        if (state.pendingSilentInitialRepaint) {
            const nextEpoch = (peek$(ctx, "contentRenderEpoch") ?? 0) + 1;
            state.pendingSilentInitialRepaint = false;
            set$(ctx, "contentRenderEpoch", nextEpoch);
            if (shouldDebugInitialScrollState(state)) {
                debugInitialScroll("setInitialRenderState-repaint", {
                    contentRenderEpoch: nextEpoch,
                });
            }
        }
        if (shouldDebugInitialScrollState(state)) {
            debugInitialScroll("setInitialRenderState-ready", {
                contentRenderEpoch: peek$(ctx, "contentRenderEpoch") ?? 0,
                didContainersLayout: !!state.didContainersLayout,
                didFinishInitialScroll: !!state.didFinishInitialScroll,
                readyToRender: true,
            });
        }

        if (onLoad) {
            onLoad({ elapsedTimeInMs: Date.now() - loadStartTime });
        }
    }
}
