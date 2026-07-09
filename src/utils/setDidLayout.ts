import type { StateContext } from "@/state/state";
import { checkAtBottom } from "@/utils/checkAtBottom";
import { setInitialRenderState } from "@/utils/setInitialRenderState";

export function setDidLayout(ctx: StateContext) {
    const state = ctx.state;
    state.queuedInitialLayout = true;
    checkAtBottom(ctx);

    setInitialRenderState(ctx, { didLayout: true });
}
