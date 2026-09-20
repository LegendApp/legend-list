import { cancelImperativeScroll } from "@/core/cancelImperativeScroll";
import { clampScrollOffset } from "@/core/clampScrollOffset";
import { getScrollRequestTracker } from "@/core/scrollRequestTracker";
import { getAlignItemsAtEndPadding } from "@/core/updateContentMetricsState";
import { updateScroll } from "@/core/updateScroll";
import { Platform } from "@/platform/Platform";
import { getContentSize } from "@/state/getContentSize";
import { peek$, type StateContext, set$ } from "@/state/state";
import { requestAdjust } from "@/utils/requestAdjust";

export function interruptMaintainScrollAtEnd(ctx: StateContext) {
    const { state } = ctx;
    const maintaining = state.maintainingScrollAtEnd;
    const cancelActiveScroll = !!(
        maintaining === "animated" ||
        maintaining === "instant" ||
        (maintaining && state.scrollingTo?.isScrollToEnd)
    );
    if (cancelActiveScroll) {
        cancelImperativeScroll(state);
    }
    if (maintaining || state.pendingMaintainScrollAtEnd) {
        finishMaintainScrollAtEnd(ctx);
    }
    return cancelActiveScroll;
}

export function finishMaintainScrollAtEnd(ctx: StateContext) {
    const { state } = ctx;
    const currentPadding = peek$(ctx, "alignItemsAtEndPadding") || 0;
    const nextPadding = getAlignItemsAtEndPadding(ctx);
    state.maintainingScrollAtEnd = undefined;
    state.pendingMaintainScrollAtEnd = false;
    if (currentPadding !== nextPadding) {
        set$(ctx, "alignItemsAtEndPadding", nextPadding);
        state.scrollForNextCalculateItemsInView = undefined;
        state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
        const nextScroll = clampScrollOffset(ctx, state.scroll + nextPadding - currentPadding);
        requestAdjust(ctx, nextScroll - state.scroll);
    }
}

export function doMaintainScrollAtEnd(ctx: StateContext, options?: { immediate?: boolean }) {
    const state = ctx.state;
    let didMaintain = false;
    // Measurements can arrive after drag start canceled the previous follow.
    // Keep automatic scrolling suspended until the user releases the drag.
    if (state.isDragging) {
        finishMaintainScrollAtEnd(ctx);
    } else {
        const {
            didContainersLayout,
            didFinishInitialScroll,
            pendingNativeMVCPAdjust,
            props: { maintainScrollAtEnd },
        } = state;
        // ResizeObserver runs after DOM layout and before paint. Instant web
        // viewport following can commit now; data/item changes still wait for RAF.
        const immediate = options?.immediate && Platform.OS === "web" && !maintainScrollAtEnd?.animated;
        const isWithinMaintainScrollAtEndThreshold = peek$(ctx, "isWithinMaintainScrollAtEndThreshold");
        const isReplayingPendingMaintain = !!state.pendingMaintainScrollAtEnd;
        // A waiting request owns the next target, even if scrollingTo still describes an older end scroll.
        // A waiting scrollToEnd will calculate the latest end when it runs; only active end targets need replay.
        const shouldMaintainScrollAtEnd = !!(
            !ctx.scrollRequestTracker?.isWaitingToRun() &&
            (!state.scrollingTo || state.scrollingTo.isScrollToEnd) &&
            (isWithinMaintainScrollAtEndThreshold || isReplayingPendingMaintain || state.scrollingTo?.isScrollToEnd) &&
            maintainScrollAtEnd &&
            didFinishInitialScroll
        );

        if (shouldMaintainScrollAtEnd && !state.scrollingTo) {
            const scroller = state.refScroller.current;
            const nativeMax = scroller?.getMaxScrollOffset?.();
            const observed = scroller?.getCurrentScrollOffset?.();
            // Removing a footer can clamp the DOM before its ResizeObserver fires.
            // Account for that layout movement now; its delayed scroll event must
            // not look like the reader scrolled upward and cancel the queued follow.
            if (
                nativeMax !== undefined &&
                observed !== undefined &&
                nativeMax < state.scroll - 1 &&
                Math.abs(observed - nativeMax) <= 1
            ) {
                state.pendingMaintainScrollAtEnd = true;
                state.scrollPending = observed;
                updateScroll(ctx, observed, true, { markHasScrolled: false });
            }
        }

        if (shouldMaintainScrollAtEnd && !didContainersLayout) {
            state.pendingMaintainScrollAtEnd = true;
        } else if (pendingNativeMVCPAdjust) {
            // Native MVCP can still be finishing its own clamp after data changes. Defer the end-anchor scroll
            // until that settles so maintainScrollAtEnd does not fight the platform's pending adjustment.
            state.pendingMaintainScrollAtEnd = shouldMaintainScrollAtEnd;
        } else if (shouldMaintainScrollAtEnd && (state.scrollingTo || state.pendingScrollResolve)) {
            // A content change during scrollToEnd belongs to the same end-follow intent.
            // Wait for the active request instead of letting runNowIfIdle discard it.
            if (immediate && state.scrollingTo?.isScrollToEnd && !state.scrollingTo.animated) {
                // Retarget the same end request without replacing its promise.
                state.pendingMaintainScrollAtEnd = false;
                ctx.scrollToEnd!({ animated: false });
                didMaintain = true;
            } else {
                state.pendingMaintainScrollAtEnd = true;
                state.maintainingScrollAtEnd ??= maintainScrollAtEnd.animated ? "pending-animated" : "pending-instant";
            }
        } else if (shouldMaintainScrollAtEnd && didContainersLayout) {
            // Run this only if scroll is at the bottom and after initial layout
            state.pendingMaintainScrollAtEnd = false;
            // Set scroll to the bottom of the list so that checkAtTop/checkAtBottom is correct
            const contentSize = getContentSize(ctx);
            if (contentSize < state.scrollLength) {
                // If content fits within the viewport, we should be at scroll 0.
                state.scroll = 0;
            }

            if (!state.maintainingScrollAtEnd || (immediate && state.maintainingScrollAtEnd === "pending-instant")) {
                const pendingState = maintainScrollAtEnd.animated ? "pending-animated" : "pending-instant";
                const activeState = maintainScrollAtEnd.animated ? "animated" : "instant";
                const scrollAtRequest = state.scroll;
                state.maintainingScrollAtEnd = pendingState;
                const run = () => {
                    if (state.maintainingScrollAtEnd === pendingState) {
                        if (state.isDragging) {
                            finishMaintainScrollAtEnd(ctx);
                        } else {
                            const isStillWithinThreshold = peek$(ctx, "isWithinMaintainScrollAtEndThreshold");
                            const didScrollSinceRequest = Platform.OS === "web" && state.scroll !== scrollAtRequest;
                            // Layout and content changes can move the end beyond the threshold while this request is pending.
                            // Native layout can also move the offset; its drag handler cancels actual user input.
                            // On web, retain offset-based cancellation for scrollbar and keyboard scrolling.
                            if (isReplayingPendingMaintain || isStillWithinThreshold || !didScrollSinceRequest) {
                                if (state.scrollingTo || state.pendingScrollResolve) {
                                    state.pendingMaintainScrollAtEnd = true;
                                } else {
                                    state.maintainingScrollAtEnd = activeState;
                                    const scrollPromise = getScrollRequestTracker(ctx).runNowIfIdle(() =>
                                        ctx.scrollToEnd!({ animated: maintainScrollAtEnd.animated }),
                                    );

                                    void scrollPromise.then(() => {
                                        if (state.maintainingScrollAtEnd === activeState) {
                                            if (state.pendingMaintainScrollAtEnd) {
                                                state.maintainingScrollAtEnd = undefined;
                                                doMaintainScrollAtEnd(ctx);
                                            } else {
                                                finishMaintainScrollAtEnd(ctx);
                                            }
                                        }
                                    });
                                }
                            } else if (state.maintainingScrollAtEnd === pendingState) {
                                finishMaintainScrollAtEnd(ctx);
                            }
                        }
                    }
                };
                if (immediate) {
                    run();
                } else {
                    requestAnimationFrame(run);
                }
            } else {
                // Coalesce follow-up requests while the current maintain pass is still settling.
                state.pendingMaintainScrollAtEnd = true;
            }

            didMaintain = true;
        } else {
            finishMaintainScrollAtEnd(ctx);
        }
    }
    return didMaintain;
}
