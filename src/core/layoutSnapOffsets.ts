import { getContentSize } from "@/state/getContentSize";
import { type StateContext, set$ } from "@/state/state";
import { getId } from "@/utils/getId";
import { toNativeHorizontalOffset } from "@/utils/rtl";

type LayoutOffsetGetter = (index: number) => number | undefined;

export function getSnapOffsetsForLayout(ctx: StateContext, snapToIndices: number[], getOffset: LayoutOffsetGetter) {
    const state = ctx.state;
    const contentSize = state.props.horizontal ? getContentSize(ctx) : undefined;
    const snapToOffsets: number[] = Array<number>(snapToIndices.length);

    for (let i = 0; i < snapToIndices.length; i++) {
        const index = snapToIndices[i];
        getId(state, index);
        const logicalOffset = getOffset(index);
        snapToOffsets[i] =
            logicalOffset === undefined
                ? (undefined as unknown as number)
                : toNativeHorizontalOffset(state, logicalOffset, contentSize);
    }

    return snapToOffsets;
}

export function syncSnapOffsetsForLayout(ctx: StateContext, snapToIndices: number[], getOffset: LayoutOffsetGetter) {
    set$(ctx, "snapToOffsets", getSnapOffsetsForLayout(ctx, snapToIndices, getOffset));
}
