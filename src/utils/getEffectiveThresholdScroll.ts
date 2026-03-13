import { peek$, type StateContext } from "@/state/state";

export function getEffectiveThresholdScroll(ctx: StateContext) {
    const deferredPositionVisualAdjust = peek$(ctx, "deferredPositionVisualAdjust") ?? 0;
    return ctx.state.scroll + deferredPositionVisualAdjust;
}
