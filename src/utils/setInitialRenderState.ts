import { resetAdaptiveRender, setAdaptiveRender } from "@/core/adaptiveRender";
import { peek$, type StateContext, set$ } from "@/state/state";
import { INITIAL_DRAW_DISTANCE, scheduleFullDrawDistancePrewarm } from "@/utils/getEffectiveDrawDistance";

export function resetInitialRenderState(
    ctx: StateContext,
    {
        resetLayout,
        resetInitialScroll,
    }: {
        resetLayout?: boolean;
        resetInitialScroll?: boolean;
    },
) {
    const { state } = ctx;
    if (resetLayout) {
        state.didContainersLayout = false;
        state.queuedInitialLayout = false;
    }
    if (resetInitialScroll) {
        state.didFinishInitialScroll = false;
    }

    set$(ctx, "readyToRender", false);
    resetAdaptiveRender(ctx);
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

    const isReadyToRender = Boolean(state.didContainersLayout && state.didFinishInitialScroll);
    if (isReadyToRender && !peek$(ctx, "readyToRender")) {
        set$(ctx, "readyToRender", true);
        setAdaptiveRender(ctx, "normal", "ready");

        if (state.props.drawDistance > INITIAL_DRAW_DISTANCE) {
            scheduleFullDrawDistancePrewarm(ctx);
        }

        if (!state.didLoad) {
            state.didLoad = true;
            if (onLoad) {
                onLoad({ elapsedTimeInMs: Date.now() - loadStartTime });
            }
        }
    }
}
