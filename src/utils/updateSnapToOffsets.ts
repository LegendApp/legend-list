import { getContentSize } from "@/state/getContentSize";
import { type StateContext, set$ } from "@/state/state";
import { getId } from "@/utils/getId";
import { toNativeHorizontalOffset } from "@/utils/rtl";

export function updateSnapToOffsets(ctx: StateContext) {
    const state = ctx.state;
    const {
        props: { snapToIndices },
    } = state;

    const contentSize = state.props.horizontal ? getContentSize(ctx) : undefined;
    const snapToOffsets: number[] = Array<number>(snapToIndices!.length);
    for (let i = 0; i < snapToIndices!.length; i++) {
        const idx = snapToIndices![i];
        getId(state, idx);
        const logicalOffset = state.positions[idx]!;
        snapToOffsets[i] = toNativeHorizontalOffset(state, logicalOffset, contentSize);
    }

    set$(ctx, "snapToOffsets", snapToOffsets);
}
