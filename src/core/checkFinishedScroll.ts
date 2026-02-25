import { calculateOffsetForIndex } from "@/core/calculateOffsetForIndex";
import { calculateOffsetWithOffsetPosition } from "@/core/calculateOffsetWithOffsetPosition";
import { clampScrollOffset } from "@/core/clampScrollOffset";
import { finishScrollTo } from "@/core/finishScrollTo";
import type { StateContext } from "@/state/state";
import type { ScrollTarget } from "@/types.base";

function getCurrentTargetOffset(ctx: StateContext, scrollingTo: ScrollTarget) {
    if (scrollingTo.index !== undefined) {
        const baseOffset = calculateOffsetForIndex(ctx, scrollingTo.index);
        const resolvedOffset = calculateOffsetWithOffsetPosition(ctx, baseOffset, scrollingTo);
        return clampScrollOffset(ctx, resolvedOffset, scrollingTo);
    }

    return clampScrollOffset(ctx, scrollingTo.offset, scrollingTo);
}

export function checkFinishedScroll(ctx: StateContext) {
    // Wait a frame because there may be some requestAdjust after this which
    // change things so it would need to wait longer
    ctx.state.animFrameCheckFinishedScroll = requestAnimationFrame(() => checkFinishedScrollFrame(ctx));
}

function checkFinishedScrollFrame(ctx: StateContext) {
    const scrollingTo = ctx.state.scrollingTo;

    if (scrollingTo) {
        const { state } = ctx;
        state.animFrameCheckFinishedScroll = undefined;

        const scroll = state.scrollPending;
        const clampedTargetOffset = getCurrentTargetOffset(ctx, scrollingTo);
        if (Math.abs(scrollingTo.offset - clampedTargetOffset) >= 1) {
            state.scrollingTo = { ...scrollingTo, offset: clampedTargetOffset };
        }
        const maxOffset = clampScrollOffset(ctx, scroll, scrollingTo);

        // Check both with adjust and without because each possibility
        // can happen in different scenarios
        const diff1 = Math.abs(scroll - clampedTargetOffset);
        const isNotOverscrolled = Math.abs(scroll - maxOffset) < 1;
        const isAtTarget = diff1 < 1;
        // During initial layout, item measurements can still arrive after a scrollTo starts.
        // Those updates can shift the computed target offset between frames (for example via MVCP),
        // so a single "at target" frame can still be transient. We require one stable frame where
        // both scroll and target match consecutively before finishing to avoid completing early and
        // then jumping when the target settles on the next frame.
        const previousStableTarget = state.stableTarget;
        const hasStableTargetFrame =
            !!previousStableTarget &&
            Math.abs(previousStableTarget.target - clampedTargetOffset) < 1 &&
            Math.abs(previousStableTarget.scroll - scroll) < 1;

        if (isAtTarget && !hasStableTargetFrame) {
            state.stableTarget = { scroll, target: clampedTargetOffset };
            state.animFrameCheckFinishedScroll = requestAnimationFrame(() => checkFinishedScrollFrame(ctx));
            return;
        }

        if (!isAtTarget) {
            state.stableTarget = undefined;
        }

        if (isNotOverscrolled && isAtTarget) {
            state.stableTarget = undefined;
            finishScrollTo(ctx);
        }
    } else {
        ctx.state.stableTarget = undefined;
    }
}

// In case checkFinishedScroll does not work correctly, set a maximum timeout
// to make sure it does eventually get cleared, just waiting for scroll to end
export function checkFinishedScrollFallback(ctx: StateContext) {
    const state = ctx.state;
    const scrollingTo = state.scrollingTo;
    const slowTimeout = scrollingTo?.isInitialScroll || !state.didContainersLayout;

    state.timeoutCheckFinishedScrollFallback = setTimeout(
        () => {
            let numChecks = 0;
            const checkHasScrolled = () => {
                state.timeoutCheckFinishedScrollFallback = undefined;

                const isStillScrollingTo = state.scrollingTo;
                if (isStillScrollingTo) {
                    numChecks++;
                    if (state.hasScrolled || numChecks > 5) {
                        finishScrollTo(ctx);
                    } else {
                        state.timeoutCheckFinishedScrollFallback = setTimeout(checkHasScrolled, 100);
                    }
                }
            };
            checkHasScrolled();
        },
        slowTimeout ? 500 : 100,
    );
}
