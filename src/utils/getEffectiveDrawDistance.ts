import { peek$, type StateContext } from "@/state/state";
import { hasActiveInitialScroll } from "@/utils/hasActiveInitialScroll";
import { toLogicalHorizontalOffset } from "@/utils/rtl";

export const INITIAL_DRAW_DISTANCE = 50;

export type DrawDistanceMode = "full" | "visible-first";

export function getEffectiveDrawDistance(ctx: StateContext, mode?: DrawDistanceMode): number {
    const drawDistance = ctx.state.props.drawDistance;
    const initialScroll = ctx.state.initialScroll;
    const needsFullInitialDrawDistance = initialScroll !== undefined && (initialScroll.viewPosition ?? 0) > 0;
    const shouldCapDrawDistance =
        mode === "visible-first" || (mode !== "full" && !peek$(ctx, "readyToRender") && !needsFullInitialDrawDistance);

    return shouldCapDrawDistance ? Math.min(drawDistance, INITIAL_DRAW_DISTANCE) : drawDistance;
}

export function scheduleFullDrawDistancePrewarm(ctx: StateContext) {
    const { state } = ctx;
    if (state.props.drawDistance <= INITIAL_DRAW_DISTANCE || state.scheduledWork.has("fullDrawDistancePrewarm")) {
        return;
    }

    state.scheduledWork.frame(() => {
        if (
            state.props.hasExternalScroll &&
            !hasActiveInitialScroll(state) &&
            !state.scrollingTo &&
            !state.pendingNativeMVCPAdjust
        ) {
            // A preceding list can grow after allocation, before ResizeObserver delivers
            // its new position. Expand the buffer against the current owner viewport.
            const offset = state.refScroller.current?.getRawScrollOffset?.();
            if (offset !== undefined) {
                state.scroll = state.scrollPending = state.props.horizontal
                    ? toLogicalHorizontalOffset(state, offset, state.totalSize)
                    : offset;
            }
        }
        state.triggerCalculateItemsInView?.();
    }, "fullDrawDistancePrewarm");
}
