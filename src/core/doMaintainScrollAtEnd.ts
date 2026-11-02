import { clampScrollOffset } from "@/core/clampScrollOffset";
import { getNativeScrollPoint } from "@/core/doScrollParams";
import { isEndOfContentTarget } from "@/core/endOfContentTarget";
import { finishMaintainScrollAtEnd } from "@/core/finishMaintainScrollAtEnd";
import { getCurrentTargetOffset } from "@/core/getCurrentTargetOffset";
import { getScrollRequestTracker } from "@/core/scrollRequestTracker";
import { updateScroll } from "@/core/updateScroll";
import { Platform } from "@/platform/Platform";
import { getContentSize } from "@/state/getContentSize";
import { peek$, type StateContext, set$ } from "@/state/state";
import { areKnownOrFixedItemSizesAvailable } from "@/utils/getItemSize";

// Native clamps an instant scroll to the content it has mounted, and a clamped scroll that cannot
// move emits no event. Reissue the current measured end when the mounted content size changes.
export function reissueClampedNativeEndScroll(ctx: StateContext) {
    const state = ctx.state;
    const target = state.scrollingTo;
    if (target?.isScrollToEnd && !target.animated && !ctx.scrollRequestTracker?.isWaitingToRun()) {
        const targetOffset = getCurrentTargetOffset(ctx, target);
        // Shrinking content clamps natively. A backward retry can arrive after that
        // clamp and undo it when native layout extends beyond the modeled end.
        const distanceToTarget = targetOffset - (state.lastNativeScroll ?? state.scroll);
        if (distanceToTarget > 1 || (state.lastNativeScroll === undefined && distanceToTarget < -1)) {
            state.refScroller.current?.scrollTo({ animated: false, ...getNativeScrollPoint(ctx, targetOffset) });
        }
    }
}

export function doMaintainScrollAtEnd(ctx: StateContext, options?: { immediate?: boolean }) {
    const state = ctx.state;
    if (state.isUnmounted) return false;
    // Measurements can arrive after drag start canceled the previous follow.
    // Suspend following during a drag or while a shared owner is scrolled outside this list.
    if (
        state.isDragging ||
        state.userScrollContentSize !== undefined ||
        state.refScroller.current?.isScrollInRange?.() === false
    ) {
        finishMaintainScrollAtEnd(ctx);
        return false;
    }
    const {
        didContainersLayout,
        didFinishInitialScroll,
        pendingNativeMVCPAdjust,
        props: { maintainScrollAtEnd },
    } = state;
    const initialEndScrollOwnsViewport =
        state.scrollingTo?.isInitialScroll ||
        (Platform.OS === "web" &&
            !didFinishInitialScroll &&
            !state.scrollingTo &&
            didContainersLayout &&
            state.initialScrollSession?.kind === "bootstrap" &&
            !state.initialScrollSession.bootstrap &&
            state.initialScrollSession.completion);
    if (
        initialEndScrollOwnsViewport &&
        maintainScrollAtEnd &&
        !state.endFollowInterrupted &&
        !ctx.scrollRequestTracker?.isWaitingToRun() &&
        isEndOfContentTarget(state.initialScroll, state.props.data.length)
    ) {
        state.pendingMaintainScrollAtEnd = true;
        return false;
    }
    // ResizeObserver runs after DOM layout and before paint. Instant web
    // layout following can commit now; data changes still wait for RAF.
    const immediate = options?.immediate && Platform.OS === "web" && !maintainScrollAtEnd?.animated;
    const isWithinMaintainScrollAtEndThreshold = peek$(ctx, "isWithinMaintainScrollAtEndThreshold");
    const isReplayingPendingMaintain = !!state.pendingMaintainScrollAtEnd;
    // A waiting request owns the next target, even if scrollingTo still describes an older end scroll.
    // A waiting scrollToEnd will calculate the latest end when it runs; only active end targets need replay.
    const shouldMaintainScrollAtEnd = !!(
        !ctx.scrollRequestTracker?.isWaitingToRun() &&
        (!state.scrollingTo || state.scrollingTo.isScrollToEnd) &&
        !state.endFollowInterrupted &&
        (peek$(ctx, "isFollowingEnd") ||
            isWithinMaintainScrollAtEndThreshold ||
            isReplayingPendingMaintain ||
            state.scrollingTo?.isScrollToEnd) &&
        maintainScrollAtEnd &&
        didFinishInitialScroll
    );

    if (!shouldMaintainScrollAtEnd) {
        if (pendingNativeMVCPAdjust) state.pendingMaintainScrollAtEnd = false;
        else finishMaintainScrollAtEnd(ctx);
        return false;
    }
    set$(ctx, "isFollowingEnd", true);

    if (!state.scrollingTo) {
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

    const anchorIndex = state.props.anchoredEndSpace?.anchorIndex;
    const dataLength = state.props.data.length;
    if (
        !didContainersLayout ||
        // Wait for the anchored tail to be measured.
        (anchorIndex !== undefined &&
            anchorIndex >= 0 &&
            anchorIndex < dataLength &&
            !areKnownOrFixedItemSizesAvailable(ctx, anchorIndex, dataLength - 1)) ||
        // Native MVCP must finish its clamp before end following takes ownership.
        pendingNativeMVCPAdjust
    ) {
        state.pendingMaintainScrollAtEnd = true;
        return false;
    }
    if (state.scrollingTo || state.pendingScrollResolve) {
        // A content change during scrollToEnd belongs to the same end-follow intent.
        // Wait for the active request instead of letting runNowIfIdle discard it.
        // Native layout and item measurements retarget too: an instant end target that moved
        // would otherwise wait for its completion fallback before following.
        if (
            options?.immediate &&
            !maintainScrollAtEnd.animated &&
            state.scrollingTo?.isScrollToEnd &&
            !state.scrollingTo.animated
        ) {
            // Retarget the same end request without replacing its promise.
            state.pendingMaintainScrollAtEnd = false;
            ctx.scrollToEnd!({ animated: false });
            return true;
        }
        state.pendingMaintainScrollAtEnd = true;
        return false;
    }

    state.pendingMaintainScrollAtEnd = false;
    // Set scroll to the bottom of the list so that checkAtTop/checkAtBottom is correct
    const contentSize = getContentSize(ctx);
    if (contentSize < state.scrollLength) {
        // Keep short content at its reachable end, including the negative iOS inset range.
        state.scroll = clampScrollOffset(ctx, 0);
    }

    if (
        !state.maintainingScrollAtEnd ||
        (immediate &&
            (state.maintainingScrollAtEnd === "pending-instant" || state.maintainingScrollAtEnd === "instant"))
    ) {
        const pendingState = maintainScrollAtEnd.animated ? "pending-animated" : "pending-instant";
        const activeState = maintainScrollAtEnd.animated ? "animated" : "instant";
        const scrollAtRequest = state.scroll;
        state.maintainingScrollAtEnd = pendingState;
        const run = () => {
            if (state.maintainingScrollAtEnd !== pendingState) return;
            if (
                state.isDragging ||
                state.userScrollContentSize !== undefined ||
                state.refScroller.current?.isScrollInRange?.() === false ||
                // Layout may move the end beyond the threshold. Only web offset changes
                // cancel here; native user input is canceled by its drag handler.
                (!isReplayingPendingMaintain &&
                    !peek$(ctx, "isWithinMaintainScrollAtEndThreshold") &&
                    Platform.OS === "web" &&
                    state.scroll !== scrollAtRequest)
            ) {
                finishMaintainScrollAtEnd(ctx);
            } else if (state.scrollingTo || state.pendingScrollResolve) {
                state.pendingMaintainScrollAtEnd = true;
                state.maintainingScrollAtEnd = undefined;
            } else {
                state.maintainingScrollAtEnd = activeState;
                const scrollPromise = getScrollRequestTracker(ctx).runNowIfIdle(() =>
                    ctx.scrollToEnd!({ animated: maintainScrollAtEnd.animated }),
                );

                void scrollPromise.then(() => {
                    if (
                        state.maintainingScrollAtEnd === activeState &&
                        !state.scrollingTo &&
                        !state.pendingScrollResolve
                    ) {
                        if (state.pendingMaintainScrollAtEnd) {
                            state.maintainingScrollAtEnd = undefined;
                            doMaintainScrollAtEnd(ctx);
                        } else {
                            finishMaintainScrollAtEnd(ctx);
                        }
                    }
                });
            }
        };
        if (immediate) {
            run();
        } else {
            state.scheduledWork.frame(run, "maintainScrollAtEnd");
        }
    } else if (
        state.maintainingScrollAtEnd === "animated" ||
        state.maintainingScrollAtEnd === "instant" ||
        // Android clamps an instant command to the extent it has laid out, which can still be the
        // pre-append one; replay the coalesced follow once the first command lands.
        (Platform.OS === "android" && state.maintainingScrollAtEnd === "pending-instant")
    ) {
        // A queued frame already targets the latest end. Only work arriving
        // after its command starts needs a follow-up pass.
        state.pendingMaintainScrollAtEnd = true;
    }

    return true;
}
