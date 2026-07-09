import { retargetActiveInitialScrollAtEnd } from "@/core/initialScrollLifecycle";
import { updateScroll } from "@/core/updateScroll";
import { Platform } from "@/platform/Platform";
import { getContentInsetEnd } from "@/state/getContentInsetEnd";
import { peek$, type StateContext } from "@/state/state";
import { requestAdjust } from "@/utils/requestAdjust";

export function updateContentInsetEndAdjustment(ctx: StateContext, previousContentInsetEndAdjustment?: number) {
    const state = ctx.state;
    const previousContentInsetEnd = getContentInsetEnd(ctx, previousContentInsetEndAdjustment);
    const nextContentInsetEnd = getContentInsetEnd(ctx);
    const insetDiff = nextContentInsetEnd - previousContentInsetEnd;

    if (insetDiff !== 0) {
        const wasWithinEndThreshold = !!peek$(ctx, "isWithinMaintainScrollAtEndThreshold");

        updateScroll(ctx, state.scroll, true, { markHasScrolled: false });

        const didRetargetInitialScroll = retargetActiveInitialScrollAtEnd(ctx);
        if (!didRetargetInitialScroll && wasWithinEndThreshold && (Platform.OS !== "web" || insetDiff > 0)) {
            requestAdjust(ctx, insetDiff);
        }
    }
}
