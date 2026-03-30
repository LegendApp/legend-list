import { peek$, type StateContext, set$ } from "@/state/state";
import { debugRuntimeLog } from "@/utils/debugLogging";

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
    debugRuntimeLog(`${Date.now()} [debug initial-blank] setInitialRenderState`, {
        didContainersLayout: state.didContainersLayout,
        didFinishInitialScroll: state.didFinishInitialScroll,
        didInitialScrollArg: didInitialScroll,
        didLayoutArg: didLayout,
        isReadyToRender,
        readyToRender: peek$(ctx, "readyToRender"),
    });
    if (isReadyToRender && !peek$(ctx, "readyToRender")) {
        set$(ctx, "readyToRender", true);
        debugRuntimeLog(`${Date.now()} [debug initial-blank] readyToRender=true`, {
            didContainersLayout: state.didContainersLayout,
            didFinishInitialScroll: state.didFinishInitialScroll,
        });

        if (onLoad) {
            onLoad({ elapsedTimeInMs: Date.now() - loadStartTime });
        }
    }
}
