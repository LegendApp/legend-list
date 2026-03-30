import { IsNewArchitecture } from "@/constants-platform";
import {
    getDebugDeferredInteraction,
    logDebugDeferredInteraction,
    recordDebugDeferredInteractionBurstAdjust,
    updateDebugDeferredInteraction,
} from "@/core/debugDeferredInteraction";
import { scrollTo } from "@/core/scrollTo";
import { updateScroll } from "@/core/updateScroll";
import { Platform } from "@/platform/Platform";
import { peek$, type StateContext } from "@/state/state";

export function requestAdjust(ctx: StateContext, positionDiff: number, dataChanged?: boolean) {
    const state = ctx.state;
    if (Math.abs(positionDiff) > 0.1) {
        const trace = getDebugDeferredInteraction(state);
        const needsScrollWorkaround =
            Platform.OS === "android" && !IsNewArchitecture && dataChanged && state.scroll <= positionDiff;

        if (trace) {
            logDebugDeferredInteraction(state, "requestAdjust:start", {
                dataChanged,
                needsScrollWorkaround,
                nextScroll: state.scroll + positionDiff,
                positionDiff,
                prevScroll: state.scroll,
                readyToRender: peek$(ctx, "readyToRender"),
            });
        }

        const doit = () => {
            if (needsScrollWorkaround) {
                updateDebugDeferredInteraction(state, { phase: "requestAdjust:scrollTo-workaround" });
                logDebugDeferredInteraction(state, "requestAdjust:scrollTo-workaround", {
                    offset: state.scroll,
                    positionDiff,
                });
                scrollTo(ctx, {
                    noScrollingTo: true,
                    offset: state.scroll,
                });
            } else {
                updateDebugDeferredInteraction(state, { phase: "requestAdjust:handler" });
                state.scrollAdjustHandler.requestAdjust(positionDiff);
                logDebugDeferredInteraction(state, "requestAdjust:handler-called", {
                    positionDiff,
                    scrollAfterHandler: state.scroll,
                });

                if (state.adjustingFromInitialMount) {
                    state.adjustingFromInitialMount--;
                }
            }
        };
        state.scroll += positionDiff;
        state.scrollForNextCalculateItemsInView = undefined;
        recordDebugDeferredInteractionBurstAdjust(state, positionDiff, state.scroll);

        const readyToRender = peek$(ctx, "readyToRender");
        if (trace) {
            logDebugDeferredInteraction(state, "requestAdjust:state-scroll-updated", {
                dataChanged,
                nextScroll: state.scroll,
                positionDiff,
                readyToRender,
            });
        }

        if (readyToRender) {
            doit();
            logDebugDeferredInteraction(state, "requestAdjust:after-doit", {
                ignoreScrollFromMVCP: state.ignoreScrollFromMVCP,
                positionDiff,
                scrollAfterDoit: state.scroll,
            });

            if (Platform.OS !== "web") {
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
                    }
                }, delay);
            }
        } else {
            state.adjustingFromInitialMount = (state.adjustingFromInitialMount || 0) + 1;
            updateDebugDeferredInteraction(state, { phase: "requestAdjust:raf" });
            logDebugDeferredInteraction(state, "requestAdjust:scheduled-raf", {
                adjustingFromInitialMount: state.adjustingFromInitialMount,
                positionDiff,
            });
            requestAnimationFrame(() => {
                logDebugDeferredInteraction(state, "requestAdjust:raf-fired", {
                    positionDiff,
                    scrollBeforeDoit: state.scroll,
                });
                doit();
            });
        }
    }
}
