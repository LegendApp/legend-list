import { type StateContext, set$ } from "@/state/state";
import { getId } from "@/utils/getId";

export function updateSnapToOffsets(ctx: StateContext) {
    const state = ctx.state!;
    const {
        positions,
        props: { snapToIndices },
    } = state;

    const snapToOffsets: number[] = Array<number>(snapToIndices!.length);
    for (let i = 0; i < snapToIndices!.length; i++) {
        const idx = snapToIndices![i];
        const key = getId(state, idx);
        snapToOffsets[i] = positions.get(key)!;
    }

    set$(ctx, "snapToOffsets", snapToOffsets);
}
