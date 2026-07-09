import { peek$, type StateContext } from "@/state/state";

export const INITIAL_DRAW_DISTANCE = 50;

export type DrawDistanceMode = "full" | "visible-first";

export function getEffectiveDrawDistance(ctx: StateContext, mode?: DrawDistanceMode): number {
    const drawDistance = ctx.state.props.drawDistance;
    const initialScroll = ctx.state.initialScroll;
    const needsFullInitialDrawDistance = initialScroll !== undefined && (initialScroll.viewPosition ?? 0) > 0;
    const shouldCapDrawDistance =
        mode === "visible-first" || (mode !== "full" && !peek$(ctx, "readyToRender") && !needsFullInitialDrawDistance);

    return shouldCapDrawDistance ? Math.min(drawDistance, INITIAL_DRAW_DISTANCE) : drawDistance;
}

export function scheduleFullDrawDistancePrewarm(ctx: StateContext) {
    const { state } = ctx;
    if (state.props.drawDistance <= INITIAL_DRAW_DISTANCE || state.queuedFullDrawDistancePrewarm !== undefined) {
        return;
    }

    state.queuedFullDrawDistancePrewarm = requestAnimationFrame(() => {
        state.queuedFullDrawDistancePrewarm = undefined;
        state.triggerCalculateItemsInView?.();
    });
}
