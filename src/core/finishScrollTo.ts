import { type StateContext, set$ } from "@/state/state";
import type { InternalState } from "@/types";

export function finishScrollTo(ctx: StateContext, state: InternalState | null | undefined) {
    if (state) {
        set$(ctx, "scrollingTo", undefined);
        state.scrollHistory.length = 0;
    }
}
