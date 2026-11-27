import { getDataLength } from "@/core/IndexedData";
import { peek$, type StateContext, set$ } from "@/state/state";
import type { InternalState } from "@/types.internal";
import { getInitialContainerPoolSize } from "@/utils/containerPool";
import { hasActiveInitialScroll } from "@/utils/hasActiveInitialScroll";
import { toLogicalHorizontalOffset } from "@/utils/rtl";

export const INITIAL_DRAW_DISTANCE = 50;
// requestAnimationFrame runs before the next paint on web and is a zero-delay timer on React Native's
// bridgeless runtime, so widening there can join the first rows' paint. Wait until they have painted.
const FULL_DRAW_DISTANCE_PREWARM_DELAY = 100;
// Later steps each add about one viewport of rows, so a large drawDistance mounts across frames.
const DRAW_DISTANCE_STEP_DELAY = 16;

export type DrawDistanceMode = "visible-first";

export function getEffectiveDrawDistance(ctx: StateContext, mode?: DrawDistanceMode): number {
    const drawDistance = ctx.state.props.drawDistance;
    const initialScroll = ctx.state.initialScroll;
    const needsFullInitialDrawDistance = initialScroll !== undefined && (initialScroll.viewPosition ?? 0) > 0;
    const shouldCapDrawDistance =
        mode === "visible-first" || (!needsFullInitialDrawDistance && !peek$(ctx, "readyToRender"));

    if (shouldCapDrawDistance) {
        return Math.min(drawDistance, INITIAL_DRAW_DISTANCE);
    }
    return needsFullInitialDrawDistance
        ? drawDistance
        : Math.min(drawDistance, ctx.state.drawDistanceLimit ?? drawDistance);
}

// Until the first post-paint widen runs, the pool holds only the containers in use; the widen adds the spare.
export function isSparePoolPending(state: InternalState) {
    return !state.didFullDrawDistancePrewarm && state.props.drawDistance > INITIAL_DRAW_DISTANCE;
}

export function scheduleFullDrawDistancePrewarm(ctx: StateContext) {
    const { state } = ctx;
    if (state.props.drawDistance <= INITIAL_DRAW_DISTANCE || state.scheduledWork.has("fullDrawDistancePrewarm")) {
        return;
    }

    const widen = () => {
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
        if (isSparePoolPending(state)) {
            const pooled = getInitialContainerPoolSize(getDataLength(state), peek$(ctx, "numContainers"));
            if (pooled > peek$(ctx, "numContainersPooled")) {
                set$(ctx, "numContainersPooled", pooled);
            }
        }
        state.didFullDrawDistancePrewarm = peek$(ctx, "readyToRender");
        if (state.drawDistanceLimit !== undefined) {
            state.drawDistanceLimit += Math.max(1, state.scrollLength / 2);
            if (state.drawDistanceLimit >= state.props.drawDistance) {
                state.drawDistanceLimit = undefined;
            } else {
                state.scheduledWork.timeout(widen, DRAW_DISTANCE_STEP_DELAY, "fullDrawDistancePrewarm");
            }
        }
        state.triggerCalculateItemsInView?.();
    };
    state.scheduledWork.timeout(widen, FULL_DRAW_DISTANCE_PREWARM_DELAY, "fullDrawDistancePrewarm");
}
