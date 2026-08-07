import { calculateOffsetForIndex } from "@/core/calculateOffsetForIndex";
import { calculateOffsetWithOffsetPosition } from "@/core/calculateOffsetWithOffsetPosition";
import { clampScrollOffset } from "@/core/clampScrollOffset";
import type { StateContext } from "@/state/state";

type ActiveScrollTarget = NonNullable<StateContext["state"]["scrollingTo"]>;

const ANIMATED_CORRECTION_MIN_DISTANCE = 40;

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

export function scrollToFallbackOffset(ctx: StateContext, offset: number, animated = false) {
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
// user. A large remainder on an animated session means the original dispatch
// was clamped short (uncommitted size or end inset), so the correction glides
// instead of teleporting; small residue snaps instantly to keep the settle
// imperceptible.
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
                const animated =
                    !!scrollingTo.animated && correctedTarget - state.scroll > ANIMATED_CORRECTION_MIN_DISTANCE;
                scrollToFallbackOffset(ctx, correctedTarget, animated);
            }
        });
    });
}
