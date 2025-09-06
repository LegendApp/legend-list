import { type StateContext, set$ } from "@/state/state";
import type { InternalState } from "@/types";
import { getPositionByIndex } from "@/utils/getPosition";

export function updateSnapToOffsets(ctx: StateContext, state: InternalState) {
    const {
        props: { snapToIndices },
    } = state;

    const snapToOffsets: number[] = Array<number>(snapToIndices!.length);
    for (let i = 0; i < snapToIndices!.length; i++) {
        const idx = snapToIndices![i];
        snapToOffsets[i] = getPositionByIndex(ctx, state, idx) || 0;
    }

    set$(ctx, "snapToOffsets", snapToOffsets);
}
