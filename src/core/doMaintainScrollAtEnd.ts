import { getContentSize } from "@/state/getContentSize";
import { peek$, type StateContext } from "@/state/state";
import { getLogicalHorizontalMaxOffset, isHorizontalRTL, toNativeHorizontalOffset } from "@/utils/rtl";

export function doMaintainScrollAtEnd(ctx: StateContext) {
    const state = ctx.state;
    const {
        didContainersLayout,
        pendingNativeMVCPAdjust,
        refScroller,
        props: { maintainScrollAtEnd },
    } = state;
    const isWithinMaintainScrollAtEndThreshold = peek$(ctx, "isWithinMaintainScrollAtEndThreshold");
    const shouldMaintainScrollAtEnd = !!(
        isWithinMaintainScrollAtEndThreshold &&
        maintainScrollAtEnd &&
        didContainersLayout
    );

    // Native MVCP can still be finishing its own clamp after data changes. Defer the end-anchor scroll
    // until that settles so maintainScrollAtEnd does not fight the platform's pending adjustment.
    if (pendingNativeMVCPAdjust) {
        state.pendingMaintainScrollAtEnd = shouldMaintainScrollAtEnd;
        return false;
    }

    state.pendingMaintainScrollAtEnd = false;

    // Run this only if scroll is at the bottom and after initial layout
    if (shouldMaintainScrollAtEnd) {
        // Set scroll to the bottom of the list so that checkAtTop/checkAtBottom is correct
        const contentSize = getContentSize(ctx);
        if (contentSize < state.scrollLength) {
            // If content fits within the viewport, we should be at scroll 0.
            state.scroll = 0;
        }

        if (!state.maintainingScrollAtEnd) {
            state.maintainingScrollAtEnd = true;

            requestAnimationFrame(() => {
                // Make sure we're still at the end after the animation frame, before scrolling to the end
                if (peek$(ctx, "isWithinMaintainScrollAtEndThreshold")) {
                    const scroller = refScroller.current;
                    if (state.props.horizontal && isHorizontalRTL(state)) {
                        const currentContentSize = getContentSize(ctx);
                        const logicalEndOffset = getLogicalHorizontalMaxOffset(state, currentContentSize);
                        const nativeOffset = toNativeHorizontalOffset(state, logicalEndOffset, currentContentSize);
                        scroller?.scrollTo({
                            animated: maintainScrollAtEnd.animated,
                            x: nativeOffset,
                            y: 0,
                        });
                    } else {
                        // Use the model-computed end offset instead of the native
                        // scrollToEnd command. The native command computes its target
                        // from the native contentSize + contentInset at execution time,
                        // which desyncs from the model when a contentInset update is
                        // still in flight (e.g. an inset animated via Reanimated on
                        // Fabric lands a frame or more later) — scrollToEnd then stops
                        // exactly insetEnd short of the model's end position.
                        const currentContentSize = getContentSize(ctx);
                        const endOffset = Math.max(0, currentContentSize - state.scrollLength);
                        scroller?.scrollTo({
                            animated: maintainScrollAtEnd.animated,
                            x: state.props.horizontal ? endOffset : 0,
                            y: state.props.horizontal ? 0 : endOffset,
                        });
                    }
                    setTimeout(
                        () => {
                            state.maintainingScrollAtEnd = false;
                        },
                        maintainScrollAtEnd.animated ? 500 : 0,
                    );
                } else {
                    state.maintainingScrollAtEnd = false;
                }
            });
        }

        return true;
    }

    return false;
}
