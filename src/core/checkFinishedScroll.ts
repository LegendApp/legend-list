import { clampScrollOffset } from "@/core/clampScrollOffset";
import { finishScrollTo } from "@/core/finishScrollTo";
import type { StateContext } from "@/state/state";

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
        const adjust = state.scrollAdjustHandler.getAdjust();
        const clampedTargetOffset = clampScrollOffset(ctx, scrollingTo.offset - (scrollingTo.viewOffset || 0));
        const maxOffset = clampScrollOffset(ctx, scroll);

        // Check both with adjust and without because each possibility
        // can happen in different scenarios
        const diff1 = Math.abs(scroll - clampedTargetOffset);
        const diff2 = Math.abs(diff1 - adjust);
        const isNotOverscrolled = Math.abs(scroll - maxOffset) < 1;

        if (isNotOverscrolled && (diff1 < 1 || diff2 < 1)) {
            finishScrollTo(ctx);
        }
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
