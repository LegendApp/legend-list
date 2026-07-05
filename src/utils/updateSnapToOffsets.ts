import { getLayoutSnapOffsets } from "@/core/layoutAccessors";
import { type StateContext, set$ } from "@/state/state";

export function updateSnapToOffsets(ctx: StateContext) {
    const state = ctx.state;
    const {
        props: { snapToIndices },
    } = state;

    set$(ctx, "snapToOffsets", getLayoutSnapOffsets(ctx, snapToIndices!));
}
