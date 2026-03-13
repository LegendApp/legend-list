import { IsNewArchitecture } from "@/constants-platform";
import { scrollTo } from "@/core/scrollTo";
import { updateScroll } from "@/core/updateScroll";
import { Platform } from "@/platform/Platform";
import { peek$, type StateContext } from "@/state/state";
import { logScrollControllerDebug } from "@/utils/debugScrollControllers";
import { shouldUseSafariWebScrollIgnore } from "@/utils/shouldUseSafariWebScrollIgnore";

export function requestAdjust(
    ctx: StateContext,
    positionDiff: number,
    dataChanged?: boolean,
    options?: { markNativeMVCPSettling?: boolean; source?: string },
) {
    const state = ctx.state;
    const shouldMarkNativeMVCPSettling = !!options?.markNativeMVCPSettling && Platform.OS !== "web";
    console.log("requestAdjust", positionDiff, {
        dataChanged: !!dataChanged,
        didFinishInitialScroll: state.didFinishInitialScroll,
        ignoreScrollFromMVCP: state.ignoreScrollFromMVCP,
        isAtEnd: state.isAtEnd,
        markNativeMVCPSettling: !!options?.markNativeMVCPSettling,
        nativeMVCPSettlingWillApply: shouldMarkNativeMVCPSettling,
        pendingNativeMVCPAdjust: state.pendingNativeMVCPAdjust,
        scroll: state.scroll,
        scrollingTo: state.scrollingTo
            ? {
                  isInitialScroll: !!state.scrollingTo.isInitialScroll,
                  offset: state.scrollingTo.offset,
                  targetOffset: state.scrollingTo.targetOffset,
              }
            : undefined,
        source: options?.source ?? "unknown",
    });
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
                const previousAdjust = state.scrollAdjustHandler.getAdjust();
                state.scrollAdjustHandler.requestAdjust(positionDiff);
                const nextAdjust = state.scrollAdjustHandler.getAdjust();

                if (Math.abs(nextAdjust - previousAdjust) > 0.1) {
                    logScrollControllerDebug("scrollAdjust:apply", {
                        dataChanged: !!dataChanged,
                        delta: nextAdjust - previousAdjust,
                        nextAdjust,
                        pendingAdjust: peek$(ctx, "scrollAdjustPending") ?? 0,
                        previousAdjust,
                        scroll: state.scroll,
                        source: options?.source ?? "unknown",
                    });
                }

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

            const shouldIgnoreFollowupScroll =
                Platform.OS !== "web" || (dataChanged && shouldUseSafariWebScrollIgnore());

            if (shouldIgnoreFollowupScroll) {
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
                    } else if (shouldMarkNativeMVCPSettling && !state.pendingNativeMVCPAdjust && !state.dataChangeNeedsScrollUpdate) {
                        state.nativeMVCPSettling = false;
                    }
                }, delay);
            }
        } else {
            state.adjustingFromInitialMount = (state.adjustingFromInitialMount || 0) + 1;
            logScrollControllerDebug("requestAdjust:defer-until-render", {
                adjustingFromInitialMount: state.adjustingFromInitialMount,
                positionDiff,
                source: options?.source ?? "unknown",
            });
            requestAnimationFrame(doit);
        }
    }
}
