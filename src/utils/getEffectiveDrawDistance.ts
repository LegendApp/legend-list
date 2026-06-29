import { peek$, type StateContext } from "@/state/state";

export const INITIAL_DRAW_DISTANCE = 100;

export function getEffectiveDrawDistance(ctx: StateContext): number {
    const drawDistance = ctx.state.props.drawDistance;
    const initialScroll = ctx.state.initialScroll;
    const needsFullInitialDrawDistance = initialScroll !== undefined && (initialScroll.viewPosition ?? 0) > 0;

    return peek$(ctx, "readyToRender") || needsFullInitialDrawDistance
        ? drawDistance
        : Math.min(drawDistance, INITIAL_DRAW_DISTANCE);
}
