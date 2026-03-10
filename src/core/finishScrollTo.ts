import { addTotalSize } from "@/core/addTotalSize";
import { INTERNAL_PERF_CONFIG } from "@/core/internalPerfConfig";
import { PlatformAdjustBreaksScroll } from "@/platform/Platform";
import type { StateContext } from "@/state/state";
import { checkThresholds } from "@/utils/checkThresholds";
import { setInitialRenderState } from "@/utils/setInitialRenderState";

export function finishScrollTo(ctx: StateContext) {
    const state = ctx.state;
    if (state?.scrollingTo) {
        const resolvePendingScroll = state.pendingScrollResolve;
        state.pendingScrollResolve = undefined;

        // Save scrollingTo before clearing it so we can pass it to commitPendingAdjust
        const scrollingTo = state.scrollingTo;
        const shouldDelayVisualAdjustUntilStable = !!scrollingTo.isInitialScroll;

        if (INTERNAL_PERF_CONFIG.log) {
            console.log(
                "[legend-list][perf]",
                JSON.stringify({
                    event: "finishScrollTo",
                    pendingTotalSize: state.pendingTotalSize,
                    scroll: state.scroll,
                    scrollAdjustPending: state.scrollAdjustHandler.getAdjust(),
                    scrollingTo: {
                        animated: !!scrollingTo.animated,
                        index: scrollingTo.index,
                        isInitialScroll: !!scrollingTo.isInitialScroll,
                        offset: scrollingTo.offset,
                        targetOffset: scrollingTo.targetOffset,
                        viewPosition: scrollingTo.viewPosition,
                    },
                }),
            );
        }

        state.scrollHistory.length = 0;
        state.initialScroll = undefined;
        state.initialScrollUsesOffset = false;
        state.initialAnchor = undefined;
        state.initialNativeScrollWatchdog = undefined;
        state.postInitialScrollTarget = shouldDelayVisualAdjustUntilStable ? { ...scrollingTo } : undefined;
        state.postInitialVisualAdjustNeedsStablePass = shouldDelayVisualAdjustUntilStable;
        state.scrollingTo = undefined;

        if (state.pendingTotalSize !== undefined) {
            addTotalSize(ctx, null, state.pendingTotalSize);
        }

        if (state.props?.data) {
            state.triggerCalculateItemsInView?.({
                doMVCP: shouldDelayVisualAdjustUntilStable,
                forceFullItemPositions: true,
            });
        }

        if (PlatformAdjustBreaksScroll) {
            state.scrollAdjustHandler.commitPendingAdjust(scrollingTo);
        }

        setInitialRenderState(ctx, { didInitialScroll: true });

        checkThresholds(ctx);

        resolvePendingScroll?.();
    }
}
