import { getLayoutOffset } from "@/core/layoutAccessors";
import { getSnapOffsetsForLayout } from "@/core/layoutSnapOffsets";
import { type StateContext, set$ } from "@/state/state";

export function updateSnapToOffsets(ctx: StateContext) {
    const state = ctx.state;
    const {
        props: { snapToIndices },
    } = state;

    set$(
        ctx,
        "snapToOffsets",
        getSnapOffsetsForLayout(ctx, snapToIndices!, (index) => getLayoutOffset(ctx, index)),
    );
}
