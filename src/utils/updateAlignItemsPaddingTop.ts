import { getContentSize } from "@/state/getContentSize";
import type { StateContext } from "@/state/state";
import { setPaddingTop } from "@/utils/setPaddingTop";

export function updateAlignItemsPaddingTop(ctx: StateContext) {
    const state = ctx.state!;
    const {
        scrollLength,
        props: { alignItemsAtEnd, data },
    } = state;
    if (alignItemsAtEnd) {
        let alignItemsPaddingTop = 0;
        if (data?.length > 0) {
            const contentSize = getContentSize(ctx);
            alignItemsPaddingTop = Math.max(0, Math.floor(scrollLength - contentSize));
        }
        setPaddingTop(ctx, { alignItemsPaddingTop });
    }
}
