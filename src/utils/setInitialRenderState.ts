import {
    isStartupReadyToRender,
    markFinishedStartupScroll,
    markStartupLayoutComplete,
} from "@/core/startupState";
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
    if (didLayout) {
        markStartupLayoutComplete(state);
    }
    if (didInitialScroll) {
        markFinishedStartupScroll(state);
    }

    const isReadyToRender = isStartupReadyToRender(state);
    if (isReadyToRender && !peek$(ctx, "readyToRender")) {
        set$(ctx, "readyToRender", true);
        if (state.pendingSilentInitialRepaint) {
            const nextEpoch = (peek$(ctx, "contentRenderEpoch") ?? 0) + 1;
            state.pendingSilentInitialRepaint = false;
            set$(ctx, "contentRenderEpoch", nextEpoch);
        }

        if (onLoad) {
            onLoad({ elapsedTimeInMs: Date.now() - loadStartTime });
        }
    }
}
