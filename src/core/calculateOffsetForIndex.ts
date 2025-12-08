import { peek$, type StateContext } from "@/state/state";
import { getId } from "@/utils/getId";

export function calculateOffsetForIndex(ctx: StateContext, index: number | undefined) {
    const state = ctx.state!;
    let position = 0;

    if (index !== undefined) {
        position = state.positions.get(getId(state, index)) || 0;

        const paddingTop = peek$(ctx, "stylePaddingTop");
        if (paddingTop) {
            position += paddingTop;
        }

        const headerSize = peek$(ctx, "headerSize");
        if (headerSize) {
            position += headerSize;
        }
    }

    return position;
}
