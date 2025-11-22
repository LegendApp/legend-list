import { peek$, type StateContext, set$ } from "@/state/state";
import type { InternalState } from "@/types";

export function setPaddingTop(
    ctx: StateContext,
    state: InternalState,
    { stylePaddingTop, alignItemsPaddingTop }: { stylePaddingTop?: number; alignItemsPaddingTop?: number },
) {
    if (stylePaddingTop !== undefined) {
        const prevStylePaddingTop = peek$(ctx, "stylePaddingTop") || 0;
        if (stylePaddingTop < prevStylePaddingTop) {
            // If reducing top padding then we need to make sure the ScrollView doesn't
            // scroll itself because the height reduced.
            // First add the padding to the total size so that the total height in the ScrollView
            // doesn't change
            let prevTotalSize = peek$(ctx, "totalSize") || 0;
            set$(ctx, "totalSize", prevTotalSize + prevStylePaddingTop);
            state.timeoutSetPaddingTop = setTimeout(() => {
                prevTotalSize = peek$(ctx, "totalSize") || 0;
                set$(ctx, "totalSize", prevTotalSize - prevStylePaddingTop);
            }, 16);
        }

        // Now set the padding
        set$(ctx, "stylePaddingTop", stylePaddingTop);
    }
    if (alignItemsPaddingTop !== undefined) {
        set$(ctx, "alignItemsPaddingTop", alignItemsPaddingTop);
    }
}
