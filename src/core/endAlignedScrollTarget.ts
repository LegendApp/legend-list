import { calculateOffsetForIndex } from "@/core/calculateOffsetForIndex";
import { calculateOffsetWithOffsetPosition } from "@/core/calculateOffsetWithOffsetPosition";
import { clampScrollOffset } from "@/core/clampScrollOffset";
import type { StateContext } from "@/state/state";

type ActiveScrollTarget = NonNullable<StateContext["state"]["scrollingTo"]>;

// End-aligned targets move while content grows (pendingTotalSize keeps them
// ~one commit ahead of the reachable native range), so completion and
// re-dispatch share this slack: sessions finish within it, and re-dispatched
// remainders beyond it glide while smaller ones snap imperceptibly.
export const END_ALIGNED_COMPLETION_EPSILON = 30;

export function isEndAlignedLastItemTarget(ctx: StateContext, scrollingTo: ActiveScrollTarget) {
    return scrollingTo.index === ctx.state.props.data.length - 1 && scrollingTo.viewPosition === 1;
}

export function getCurrentTargetOffset(ctx: StateContext, scrollingTo: ActiveScrollTarget) {
    const index = scrollingTo.index;
    const shouldRecomputeEndTarget = isEndAlignedLastItemTarget(ctx, scrollingTo);
    const requestedTargetOffset =
        shouldRecomputeEndTarget && index !== undefined
            ? calculateOffsetWithOffsetPosition(ctx, calculateOffsetForIndex(ctx, index), scrollingTo)
            : (scrollingTo.targetOffset ??
              clampScrollOffset(ctx, scrollingTo.offset - (scrollingTo.viewOffset || 0), scrollingTo));

    return clampScrollOffset(ctx, requestedTargetOffset, scrollingTo);
}

export function scrollToFallbackOffset(ctx: StateContext, offset: number) {
    dispatchScrollTo(ctx, offset, false);
}

// Re-dispatch an end-aligned session at its recomputed target. An animated
// dispatch gets clamped short when the target sits beyond the natively
// committed range (uncommitted total size or end inset), so an animated
// session with a remainder beyond the completion slack glides the rest of
// the way instead of teleporting; smaller remainders snap imperceptibly.
export function redispatchEndAlignedTarget(ctx: StateContext, scrollingTo: ActiveScrollTarget, target: number) {
    const animated = !!scrollingTo.animated && target - ctx.state.scroll > END_ALIGNED_COMPLETION_EPSILON;
    dispatchScrollTo(ctx, target, animated);
}

function dispatchScrollTo(ctx: StateContext, offset: number, animated: boolean) {
    ctx.state.refScroller.current?.scrollTo({
        animated,
        x: ctx.state.props.horizontal ? offset : 0,
        y: ctx.state.props.horizontal ? 0 : offset,
    });
}

// Committing pendingTotalSize in finishScrollTo can grow the content after an
// end-aligned scroll already settled: while the scroll was active the native
// container still had the previous committed size, so the dispatched target sat
// beyond the reachable range and retries could not move past it. Once the
// committed size lands natively (two frames), re-dispatch a single correction
// toward the end. One-shot and end-directed, so it cannot loop or fight the
// user.
export function maybeCorrectEndAlignedScrollAfterCommit(ctx: StateContext, scrollingTo: ActiveScrollTarget) {
    const state = ctx.state;
    if (!isEndAlignedLastItemTarget(ctx, scrollingTo)) {
        return;
    }

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            if (state.scrollingTo) {
                return;
            }
            const correctedTarget = getCurrentTargetOffset(ctx, scrollingTo);
            if (correctedTarget > state.scroll + 1) {
                redispatchEndAlignedTarget(ctx, scrollingTo, correctedTarget);
            }
        });
    });
}
