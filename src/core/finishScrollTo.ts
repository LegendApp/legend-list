import { type StateContext, set$ } from "@/state/state";
import type { InternalState } from "@/types";

export function finishScrollTo(ctx: StateContext, state: InternalState | null | undefined) {
    if (state) {
        state.scrollHistory.length = 0;
        state.initialScroll = undefined;
        set$(ctx, "scrollingTo", undefined);
    }
}
