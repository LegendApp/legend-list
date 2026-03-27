import { ownsInitialScrollWithBootstrap } from "@/core/initialBootstrap";
import { markStartupLayoutCheckpoint } from "@/core/startupState";
import { getActiveInitialScrollTargetOffset } from "@/core/scrollTarget";
import type { StateContext } from "@/state/state";
import { checkAtBottom } from "@/utils/checkAtBottom";
import { performInitialScroll } from "@/utils/performInitialScroll";
import { setInitialRenderState } from "@/utils/setInitialRenderState";

export function setDidLayout(ctx: StateContext) {
    const state = ctx.state;
    const { initialScroll } = state;
    markStartupLayoutCheckpoint(state);
    checkAtBottom(ctx);

    if (initialScroll) {
        if (ownsInitialScrollWithBootstrap(state)) {
            setInitialRenderState(ctx, { didLayout: true });
            return;
        }

        const runScroll = () => {
            const target = state.initialScroll;
            if (!target) {
                return;
            }

            const activeInitialTargetOffset = getActiveInitialScrollTargetOffset(state);
            const desiredInitialTargetOffset = state.initialScrollUsesOffset
                ? target.contentOffset
                : activeInitialTargetOffset;
            const isAlreadyAtDesiredInitialTarget =
                desiredInitialTargetOffset !== undefined &&
                Math.abs(state.scroll - desiredInitialTargetOffset) <= 1 &&
                Math.abs(state.scrollPending - desiredInitialTargetOffset) <= 1;
            if (!isAlreadyAtDesiredInitialTarget) {
                performInitialScroll(ctx, {
                    forceScroll: true,
                    initialScrollUsesOffset: state.initialScrollUsesOffset,
                    // Offset-based initial scrolls do not need item lookup, so they can run even before data exists.
                    // Re-run on the next frame to pick up measured viewport size without waiting for index resolution.
                    resolvedOffset: state.initialScrollUsesOffset ? undefined : activeInitialTargetOffset,
                    target,
                });
            }
        };

        // Perform a second pass on the next frame to settle with measured sizes.
        runScroll();
        requestAnimationFrame(runScroll);
    }

    setInitialRenderState(ctx, { didLayout: true });
}
