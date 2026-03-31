import { Platform } from "@/platform/Platform";
import { peek$, type StateContext, set$ } from "@/state/state";

function debugInitialEnd(event: string, payload: Record<string, unknown>) {
    if (Platform.OS !== "web") {
        return;
    }

    const debugState = ((globalThis as any).__legendInitialEndDebug ??= { seq: 0 }) as { seq: number };
    console.log(`${Date.now()} [debug-log bidirectional-initial-end initial-end-v2] ${event}`, {
        seq: ++debugState.seq,
        ...payload,
    });
}

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

    const wasReadyToRender = peek$(ctx, "readyToRender");
    const isReadyToRender = Boolean(state.didContainersLayout && state.didFinishInitialScroll);
    debugInitialEnd("initial-render-state", {
        didContainersLayout: state.didContainersLayout,
        didFinishInitialScroll: state.didFinishInitialScroll,
        didInitialScroll,
        didLayout,
        isReadyToRender,
        wasReadyToRender,
    });
    if (isReadyToRender && !peek$(ctx, "readyToRender")) {
        set$(ctx, "readyToRender", true);

        if (onLoad) {
            onLoad({ elapsedTimeInMs: Date.now() - loadStartTime });
        }
    }
}
