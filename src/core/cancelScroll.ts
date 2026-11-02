import { cancelImperativeScroll, syncScrollActive } from "@/core/cancelImperativeScroll";
import { clampScrollOffset } from "@/core/clampScrollOffset";
import { getNativeScrollPoint } from "@/core/doScrollParams";
import { clearPreservedInitialScrollTarget, supersedeInitialScroll } from "@/core/finishInitialScroll";
import { interruptMaintainScrollAtEnd } from "@/core/finishMaintainScrollAtEnd";
import { getObservedScrollOffset } from "@/core/observedScroll";
import { updateScroll } from "@/core/updateScroll";
import { Platform } from "@/platform/Platform";
import { peek$, type StateContext } from "@/state/state";

/** Returns whether it stopped a running animation with an instant write. */
export function cancelScroll(
    ctx: StateContext,
    stopAnimation = true,
    commitAdjust = true,
    inputDelta = 0,
    cancelledAnimationOffset?: number,
) {
    const { state } = ctx;
    // Without a native observation, scrollPending has not yet absorbed deferred adjustments.
    const observed =
        cancelledAnimationOffset ??
        getObservedScrollOffset(ctx, peek$(ctx, "scrollAdjustPending") ? state.scrollPending : undefined);
    // A superseded animation keeps running natively while its replacement waits to dispatch.
    const wasAnimating =
        cancelledAnimationOffset !== undefined || !!state.scrollingTo?.animated || !!ctx.scrollRequestTracker?.cancel();
    const stopped = wasAnimating && stopAnimation;
    const stopOffset = stopped && inputDelta ? clampScrollOffset(ctx, observed + inputDelta) : observed;
    releaseScrollOwners(ctx, true);
    state.scrollPending = stopOffset;
    // Deferred adjustments are not applied natively yet, so the observed offset is current even
    // inside their MVCP ignore window; dropping it would count them twice in the commit below.
    const ignoreScrollFromMVCP = state.ignoreScrollFromMVCP;
    if (peek$(ctx, "scrollAdjustPending")) state.ignoreScrollFromMVCP = undefined;
    updateScroll(ctx, stopOffset, true, { markHasScrolled: false });
    state.ignoreScrollFromMVCP = ignoreScrollFromMVCP;
    if (stopped) stopScrollAnimation(ctx, observed, inputDelta);
    // Apply MVCP adjustments deferred during the cancelled animation now, or mark them superseded
    // so the replacement's finishScrollTo does not add them to its own offset target.
    if (commitAdjust) state.scrollAdjustHandler.commitPendingAdjust();
    else state.scrollAdjustHandler.supersedePendingAdjust();
    return stopped;
}

// The web wheel listener cancels the native wheel scroll when this stop write includes its delta,
// so the observed offset predates the wheel and inputDelta applies it exactly once.
export function stopScrollAnimation(ctx: StateContext, observed = getObservedScrollOffset(ctx), inputDelta = 0) {
    const { state } = ctx;
    const scroller = state.refScroller.current;
    const offset = observed + inputDelta;
    // Stop at the scroller's own raw offset when it reports one, avoiding an RTL round trip.
    const x = !state.props.horizontal
        ? 0
        : inputDelta
          ? getNativeScrollPoint(ctx, offset).x
          : (scroller?.getCurrentScrollOffset?.() ?? getNativeScrollPoint(ctx, observed).x);
    scroller?.scrollTo({ animated: false, x, y: state.props.horizontal ? 0 : offset });
}

function releaseScrollOwners(ctx: StateContext, supersedeInitial: boolean) {
    const { state } = ctx;
    ctx.scrollRequestTracker?.cancel();
    interruptMaintainScrollAtEnd(ctx);
    cancelImperativeScroll(state);
    // Before supersedeInitialScroll, whose released onScroll may set a new anchor re-entrantly.
    state.pendingEndMeasurements = undefined;
    state.visibleContentAnchor = undefined;
    if (supersedeInitial) supersedeInitialScroll(ctx);
    clearPreservedInitialScrollTarget(state);
    // After supersedeInitialScroll, so a scroll started re-entrantly from its onScroll stays active.
    syncScrollActive(ctx);
}

/** Returns whether the stop write applied inputDelta, so the caller must cancel the native scroll. */
export function interruptUserScroll(ctx: StateContext, inputDelta = 0, cancelledAnimationOffset?: number) {
    if (
        cancelledAnimationOffset !== undefined ||
        ctx.state.scrollingTo ||
        ctx.scrollRequestTracker?.isWaitingToRun() ||
        (ctx.state.initialScroll && !ctx.state.didFinishInitialScroll)
    ) {
        return cancelScroll(ctx, Platform.OS === "web", true, inputDelta, cancelledAnimationOffset) && inputDelta !== 0;
    }
    releaseScrollOwners(ctx, false);
    return false;
}
