import { isDeferredInitialScrollSession } from "@/core/deferredPositions";
import { Platform, PlatformAdjustBreaksScroll } from "@/platform/Platform";
import { peek$, type StateContext, set$ } from "@/state/state";
import { checkThresholds } from "@/utils/checkThresholds";
import { setInitialRenderState } from "@/utils/setInitialRenderState";

function debugInitialEnd(event: string, payload: Record<string, unknown>) {
    if (Platform.OS !== "web") {
        return;
    }

    const debugState = ((globalThis as any).__legendInitialEndDebug ??= { seq: 0 }) as { seq: number };
    console.log(`${Date.now()} [debug-log bidirectional-initial-end initial-end-v2] ${event}`, {
        seq: ++debugState.seq,
        ...payload,
    });
}

export function finishScrollTo(ctx: StateContext) {
    const state = ctx.state;
    if (state?.scrollingTo) {
        const resolvePendingScroll = state.pendingScrollResolve;
        state.pendingScrollResolve = undefined;

        // Save scrollingTo before clearing it so we can pass it to commitPendingAdjust
        const scrollingTo = state.scrollingTo;
        const shouldKeepDeferredInitialScrollActive =
            !!scrollingTo.isInitialScroll && isDeferredInitialScrollSession(state.deferredPositions);

        if (scrollingTo.isInitialScroll || isDeferredInitialScrollSession(state.deferredPositions)) {
            debugInitialEnd("finish-scroll-to", {
                didFinishInitialScroll: state.didFinishInitialScroll,
                offset: scrollingTo.offset,
                scroll: state.scroll,
                shouldKeepDeferredInitialScrollActive,
                targetOffset: scrollingTo.targetOffset,
            });
        }

        state.scrollHistory.length = 0;
        state.initialNativeScrollWatchdog = undefined;
        state.scrollingTo = undefined;
        if (state.timeoutUserScrollActive) {
            clearTimeout(state.timeoutUserScrollActive);
            state.timeoutUserScrollActive = undefined;
        }
        state.userScrollActive = false;

        if (shouldKeepDeferredInitialScrollActive) {
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
            resolvePendingScroll?.();
            return;
        }

        state.initialScroll = undefined;
        state.initialScrollUsesOffset = false;
        state.initialAnchor = undefined;

        const publishedTotalSize = peek$(ctx, "totalSize");
        if (publishedTotalSize !== state.totalSizeExact) {
            set$(ctx, "totalSize", state.totalSizeExact);
        }

        if (state.props?.data) {
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
        }

        if (PlatformAdjustBreaksScroll) {
            state.scrollAdjustHandler.commitPendingAdjust(scrollingTo);
        }

        setInitialRenderState(ctx, { didInitialScroll: true });

        checkThresholds(ctx);

        resolvePendingScroll?.();
    }
}
