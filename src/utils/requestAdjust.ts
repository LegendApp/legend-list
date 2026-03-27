import { IsNewArchitecture } from "@/constants-platform";
import { runRuntimeUpdateScroll } from "@/core/runtimeCallbacks";
import { scrollTo } from "@/core/scrollTo";
import { Platform } from "@/platform/Platform";
import { peek$, type StateContext } from "@/state/state";
import type { RequestAdjustOptions } from "@/typesInternal";
import { shouldUseSafariWebScrollIgnore } from "@/utils/shouldUseSafariWebScrollIgnore";

function shouldIgnoreFollowupScrollAfterAdjust(
    ctx: StateContext,
    dataChanged?: boolean,
    options?: RequestAdjustOptions,
) {
    if (options?.mutateScrollState === false) {
        return false;
    }
    if (Platform.OS !== "web") {
        return true;
    }

    const state = ctx.state;
    return !!dataChanged && (shouldUseSafariWebScrollIgnore() || !!state.pendingPrependTransaction);
}

export function requestAdjust(
    ctx: StateContext,
    positionDiff: number,
    dataChanged?: boolean,
    source?: string,
    options?: RequestAdjustOptions,
) {
    const state = ctx.state;
    if (Math.abs(positionDiff) > 0.1) {
        const shouldMutateScrollState = options?.mutateScrollState !== false;
        const previousScroll = state.scroll;
        const needsScrollWorkaround =
            Platform.OS === "android" && !IsNewArchitecture && dataChanged && state.scroll <= positionDiff;

        const doit = () => {
            if (needsScrollWorkaround) {
                scrollTo(ctx, {
                    noScrollingTo: true,
                    offset: state.scroll,
                });
            } else {
                state.scrollAdjustHandler.requestAdjust(positionDiff, source);

                if (state.adjustingFromInitialMount) {
                    state.adjustingFromInitialMount--;
                }
            }
        };
        if (shouldMutateScrollState) {
            state.scroll += positionDiff;
            state.scrollForNextCalculateItemsInView = undefined;
        }
        const readyToRender = peek$(ctx, "readyToRender");

        if (readyToRender) {
            doit();

            if (shouldIgnoreFollowupScrollAfterAdjust(ctx, dataChanged, options)) {
                // Calculate a threshold to ignore scroll jumps for a short period of time
                // This is to avoid the case where a scroll event comes in that was relevant from before
                // the requestAdjust. So we ignore scroll events that are closer to the previous
                // scroll position than the target position.
                const threshold = previousScroll + positionDiff / 2;
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
                        runRuntimeUpdateScroll(ctx, state.scroll, true);
                    }
                }, delay);
            }
        } else {
            state.adjustingFromInitialMount = (state.adjustingFromInitialMount || 0) + 1;
            requestAnimationFrame(doit);
        }
    }
}
