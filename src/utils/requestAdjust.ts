import { IsNewArchitecture } from "@/constants-platform";
import { scrollTo } from "@/core/scrollTo";
import { updateScroll } from "@/core/updateScroll";
import { Platform } from "@/platform/Platform";
import { peek$, type StateContext } from "@/state/state";
import { shouldUseSafariWebScrollIgnore } from "@/utils/shouldUseSafariWebScrollIgnore";

function shouldIgnoreFollowupScrollAfterAdjust(dataChanged?: boolean) {
    return Platform.OS !== "web" || (!!dataChanged && shouldUseSafariWebScrollIgnore());
}

export function requestAdjust(
    ctx: StateContext,
    positionDiff: number,
    dataChanged?: boolean,
    markNativeMVCPSettling?: boolean,
) {
    const state = ctx.state;
    const shouldMarkNativeMVCPSettling = !!markNativeMVCPSettling && Platform.OS !== "web";
    if (Math.abs(positionDiff) > 0.1) {
        if (shouldMarkNativeMVCPSettling) {
            state.nativeMVCPSettling = true;
        }
        const needsScrollWorkaround =
            Platform.OS === "android" && !IsNewArchitecture && dataChanged && state.scroll <= positionDiff;

        const doit = () => {
            if (needsScrollWorkaround) {
                scrollTo(ctx, {
                    noScrollingTo: true,
                    offset: state.scroll,
                });
            } else {
                state.scrollAdjustHandler.requestAdjust(positionDiff);

                if (state.adjustingFromInitialMount) {
                    state.adjustingFromInitialMount--;
                }
            }
        };
        state.scroll += positionDiff;
        state.scrollForNextCalculateItemsInView = undefined;

        const readyToRender = peek$(ctx, "readyToRender");

        if (readyToRender) {
            doit();

            if (shouldIgnoreFollowupScrollAfterAdjust(dataChanged)) {
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

                const delay = needsScrollWorkaround ? 250 : 100;
                state.ignoreScrollFromMVCPTimeout = setTimeout(() => {
                    state.ignoreScrollFromMVCP = undefined;
                    const shouldForceUpdate =
                        state.ignoreScrollFromMVCPIgnored && state.scrollProcessingEnabled !== false;

                    if (shouldForceUpdate) {
                        state.ignoreScrollFromMVCPIgnored = false;
                        state.scrollPending = state.scroll;
                        updateScroll(ctx, state.scroll, true);
                    } else if (
                        shouldMarkNativeMVCPSettling &&
                        !state.pendingNativeMVCPAdjust &&
                        !state.dataChangeNeedsScrollUpdate
                    ) {
                        state.nativeMVCPSettling = false;
                    }
                }, delay);
            }
        } else {
            state.adjustingFromInitialMount = (state.adjustingFromInitialMount || 0) + 1;
            requestAnimationFrame(doit);
        }
    }
}
