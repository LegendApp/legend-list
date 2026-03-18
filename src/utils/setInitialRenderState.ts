import { logInitialScrollTrace } from "@/core/logInitialScrollTrace";
import { peek$, type StateContext, set$ } from "@/state/state";

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
    const readyToRenderBefore = peek$(ctx, "readyToRender");
    if (didLayout) {
        state.didContainersLayout = true;
    }
    if (didInitialScroll) {
        state.didFinishInitialScroll = true;
    }

    const isReadyToRender = Boolean(state.didContainersLayout && state.didFinishInitialScroll);
    logInitialScrollTrace(ctx, "setInitialRenderState", {
        didInitialScrollArg: didInitialScroll,
        didLayoutArg: didLayout,
        isReadyToRender,
        readyToRenderBefore,
    });
    if (isReadyToRender && !peek$(ctx, "readyToRender")) {
        set$(ctx, "readyToRender", true);
        logInitialScrollTrace(ctx, "setInitialRenderState:ready", {
            didInitialScrollArg: didInitialScroll,
            didLayoutArg: didLayout,
            isReadyToRender,
            readyToRender: true,
        });

        if (onLoad) {
            onLoad({ elapsedTimeInMs: Date.now() - loadStartTime });
        }
    }
}
