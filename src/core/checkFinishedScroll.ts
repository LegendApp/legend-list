import { clampScrollOffset } from "@/core/clampScrollOffset";
import { finishScrollTo } from "@/core/finishScrollTo";
import { getContentSize } from "@/state/getContentSize";
import type { StateContext } from "@/state/state";

const INITIAL_SCROLL_MIN_TARGET_OFFSET = 1;
const INITIAL_SCROLL_MAX_FALLBACK_CHECKS = 20;
const INITIAL_SCROLL_ZERO_TARGET_EPSILON = 1;

// Schedules a frame-delayed scroll-target completion check so requestAdjust work
// from the same tick can settle before we decide the scrollTo is done.
export function checkFinishedScroll(ctx: StateContext) {
    // Wait a frame because there may be some requestAdjust after this which
    // change things so it would need to wait longer
    ctx.state.animFrameCheckFinishedScroll = requestAnimationFrame(() => checkFinishedScrollFrame(ctx));
}

// Verifies that the current scroll position has reached the resolved target or clamp
// before finishing the active scrollTo lifecycle.
function checkFinishedScrollFrame(ctx: StateContext) {
    const scrollingTo = ctx.state.scrollingTo;

    if (scrollingTo) {
        const { state } = ctx;
        state.animFrameCheckFinishedScroll = undefined;

        const scroll = state.scrollPending;
        const adjust = state.scrollAdjustHandler.getAdjust();
        const clampedTargetOffset =
            scrollingTo.targetOffset ??
            clampScrollOffset(ctx, scrollingTo.offset - (scrollingTo.viewOffset || 0), scrollingTo);
        const maxOffset = clampScrollOffset(ctx, scroll, scrollingTo);

        // Check both with adjust and without because each possibility
        // can happen in different scenarios
        const diff1 = Math.abs(scroll - clampedTargetOffset);
        const diff2 = Math.abs(diff1 - adjust);
        const isNotOverscrolled = Math.abs(scroll - maxOffset) < 1;
        // Non-animated scrollTo may include an immediate adjust offset, so accept either distance.
        const isAtTarget = diff1 < 1 || (!scrollingTo.animated && diff2 < 1);

        if (isNotOverscrolled && isAtTarget) {
            finishScrollTo(ctx);
        }
    }
}

// In case checkFinishedScroll does not work correctly, set a maximum timeout
// to make sure it does eventually get cleared, just waiting for scroll to end
// Fallback path for platforms where scroll completion is delayed or never observed.
export function checkFinishedScrollFallback(ctx: StateContext) {
    const state = ctx.state;
    const scrollingTo = state.scrollingTo;
    const shouldFinishInitialZeroTarget = shouldFinishInitialZeroTargetScroll(ctx);
    const slowTimeout = (scrollingTo?.isInitialScroll && !shouldFinishInitialZeroTarget) || !state.didContainersLayout;

    state.timeoutCheckFinishedScrollFallback = setTimeout(
        () => {
            let numChecks = 0;
            const checkHasScrolled = () => {
                state.timeoutCheckFinishedScrollFallback = undefined;

                const isStillScrollingTo = state.scrollingTo;
                if (isStillScrollingTo) {
                    numChecks++;
                    const isNativeInitialPending = isNativeInitialNonZeroTarget(state) && !state.hasScrolled;
                    const maxChecks = isNativeInitialPending ? INITIAL_SCROLL_MAX_FALLBACK_CHECKS : 5;
                    const shouldFinishZeroTarget = shouldFinishInitialZeroTargetScroll(ctx);

                    if (shouldFinishZeroTarget || state.hasScrolled || numChecks > maxChecks) {
                        finishScrollTo(ctx);
                    } else if (isNativeInitialPending && numChecks <= maxChecks) {
                        const targetOffset = state.initialNativeScrollWatchdog?.targetOffset ?? state.scrollPending;
                        const scroller = state.refScroller.current;
                        if (scroller) {
                            scroller.scrollTo({
                                animated: false,
                                x: state.props.horizontal ? targetOffset : 0,
                                y: state.props.horizontal ? 0 : targetOffset,
                            });
                        }
                        state.timeoutCheckFinishedScrollFallback = setTimeout(checkHasScrolled, 100);
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

// Identifies the native initial-scroll case where we still expect a non-zero target
// but have not yet seen the scroll position move toward it.
function isNativeInitialNonZeroTarget(state: StateContext["state"]) {
    return (
        !state.didFinishInitialScroll &&
        !!state.initialNativeScrollWatchdog &&
        state.initialNativeScrollWatchdog.targetOffset > INITIAL_SCROLL_MIN_TARGET_OFFSET
    );
}

// Detects the degenerate initial-scroll case where content fits immediately and
// the target should be treated as settled at zero.
function shouldFinishInitialZeroTargetScroll(ctx: StateContext) {
    const { state } = ctx;
    return (
        !!state.scrollingTo?.isInitialScroll &&
        state.props.data.length > 0 &&
        getContentSize(ctx) <= state.scrollLength &&
        state.scrollPending <= INITIAL_SCROLL_ZERO_TARGET_EPSILON
    );
}
