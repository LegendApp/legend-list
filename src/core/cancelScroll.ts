import { cancelImperativeScroll } from "@/core/cancelImperativeScroll";
import { interruptMaintainScrollAtEnd } from "@/core/doMaintainScrollAtEnd";
import { getObservedScrollOffset } from "@/core/emitMetrics";
import { clearPreservedInitialScrollTarget, supersedeInitialScroll } from "@/core/finishInitialScroll";
import { updateScroll } from "@/core/updateScroll";
import { Platform } from "@/platform/Platform";
import { getContentSize } from "@/state/getContentSize";
import { type StateContext, set$ } from "@/state/state";
import { toNativeHorizontalOffset } from "@/utils/rtl";

export function cancelScroll(ctx: StateContext, stopAnimation = true) {
    const { state } = ctx;
    const wasAnimating = !!state.scrollingTo?.animated;
    const scroller = state.refScroller.current;
    const observed = getObservedScrollOffset(ctx);
    ctx.scrollRequestTracker?.cancel();
    interruptMaintainScrollAtEnd(ctx);
    cancelImperativeScroll(state);
    supersedeInitialScroll(ctx);
    clearPreservedInitialScrollTarget(state);
    state.pendingEndMeasurements = undefined;
    state.visibleContentAnchor = undefined;
    state.scrollElementTarget = undefined;
    set$(ctx, "isScrollActive", !!state.isDragging || !!state.isMomentumScrolling);
    state.scrollPending = observed;
    updateScroll(ctx, observed, true, { markHasScrolled: false });
    if (wasAnimating && stopAnimation) {
        // Stop at the scroller's own raw offset when it reports one, avoiding an RTL round trip.
        const x = state.props.horizontal
            ? (scroller?.getCurrentScrollOffset?.() ?? toNativeHorizontalOffset(state, observed, getContentSize(ctx)))
            : 0;
        scroller?.scrollTo({ animated: false, x, y: state.props.horizontal ? 0 : observed });
    }
    // Apply MVCP adjustments deferred during the cancelled animation now; otherwise
    // the next request's finishScrollTo would apply them to its own target.
    state.scrollAdjustHandler.commitPendingAdjust();
}

export function interruptUserScroll(ctx: StateContext) {
    if (ctx.state.scrollingTo || (ctx.state.initialScroll && !ctx.state.didFinishInitialScroll)) {
        cancelScroll(ctx, Platform.OS === "web");
    } else {
        ctx.scrollRequestTracker?.cancel();
        interruptMaintainScrollAtEnd(ctx);
        cancelImperativeScroll(ctx.state);
        ctx.state.pendingEndMeasurements = undefined;
        ctx.state.visibleContentAnchor = undefined;
        ctx.state.scrollElementTarget = undefined;
        set$(ctx, "isScrollActive", !!ctx.state.isDragging || !!ctx.state.isMomentumScrolling);
    }
    ctx.state.props.onUserScroll?.();
}
