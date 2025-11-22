import { peek$, type StateContext } from "@/state/state";
import type { InternalState } from "@/types";
import { getId } from "@/utils/getId";

export function calculateOffsetForIndex(ctx: StateContext, state: InternalState, index: number | undefined) {
    let position = 0;

    if (index !== undefined) {
        position = state?.positions.get(getId(state, index)) || 0;

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
