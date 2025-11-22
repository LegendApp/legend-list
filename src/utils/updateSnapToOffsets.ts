import { type StateContext, set$ } from "@/state/state";
import type { InternalState } from "@/types";
import { getId } from "@/utils/getId";

export function updateSnapToOffsets(ctx: StateContext, state: InternalState) {
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
