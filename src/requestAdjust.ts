import { type StateContext, peek$ } from "./state";
import type { InternalState } from "./types";

export function requestAdjust(ctx: StateContext, state: InternalState, positionDiff: number) {
    if (Math.abs(positionDiff) > 0.1) {
        const doit = () => {
            state.scrollAdjustHandler.requestAdjust(positionDiff);
        };
        state.scroll += positionDiff;
        state.scrollForNextCalculateItemsInView = undefined;

        if (peek$(ctx, "containersDidLayout")) {
            doit();
        } else {
            requestAnimationFrame(doit);
        }

        // Calculate a threshold to ignore scroll jumps for a short period of time
        // This is to avoid the case where a scroll event comes in that was relevant from before
        // the requestAdjust. So we ignore scroll events that are closer to the previous
        // scroll position than the target position.
        const threshold = state.scroll - positionDiff / 2;
        if (!state.ignoreScrollFromMVCP) {
            state.ignoreScrollFromMVCP = {};
        }
        if (positionDiff > 0) {
            state.ignoreScrollFromMVCP.lt = threshold;
        } else {
            state.ignoreScrollFromMVCP.gt = threshold;
        }

        if (state.ignoreScrollFromMVCPTimeout) {
            clearTimeout(state.ignoreScrollFromMVCPTimeout);
        }
        state.ignoreScrollFromMVCPTimeout = setTimeout(() => {
            state.ignoreScrollFromMVCP = undefined;
        }, 100);
    }
}
