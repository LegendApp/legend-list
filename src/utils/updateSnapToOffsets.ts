import { flushDeferredPositions } from "@/core/deferredPositions";
import { type StateContext, set$ } from "@/state/state";
import { getId } from "@/utils/getId";

export function updateSnapToOffsets(ctx: StateContext) {
    flushDeferredPositions(ctx, "exactOffsetRead");
    const state = ctx.state;
    const {
        props: { snapToIndices },
    } = state;

    const snapToOffsets: number[] = Array<number>(snapToIndices!.length);
    for (let i = 0; i < snapToIndices!.length; i++) {
        const idx = snapToIndices![i];
        getId(state, idx);
        snapToOffsets[i] = state.positions[idx]!;
    }

    set$(ctx, "snapToOffsets", snapToOffsets);
}
