import { IsNewArchitecture } from "@/constants-platform";
import { hasNativeScrollToStart } from "@/core/nativeScrollToStart";
import { getObservedScrollOffset } from "@/core/observedScroll";
import { Platform } from "@/platform/Platform";
import { peek$, type StateContext } from "@/state/state";
import type { ScrollAdjustmentSource } from "@/types.internal";

function preservesOffsetTarget(ctx: StateContext, source: ScrollAdjustmentSource | undefined) {
    const state = ctx.state;
    const target = state.scrollingTo;
    if (Platform.OS === "web") {
        if (hasNativeScrollToStart(ctx)) return true;
        // Settled start geometry belongs to the boundary, including row-0/1
        // measurements delivered after the browser has released Home.
        if (
            source !== "data" &&
            !target &&
            !state.pendingScrollResolve &&
            !state.isDragging &&
            !state.isMomentumScrolling &&
            state.didFinishInitialScroll &&
            peek$(ctx, "readyToRender") &&
            state.refScroller.current?.isScrollInRange?.() !== false &&
            state.refScroller.current?.getCurrentScrollOffset?.() === 0
        )
            return true;
    }
    return source === "item-size" && target && target.index === undefined && !target.isScrollToEnd;
}

export function requestAdjust(ctx: StateContext, positionDiff: number, source?: ScrollAdjustmentSource) {
    const state = ctx.state;
    // Measurements update layout, but must not replace an absolute offset or native Home destination.
    if (preservesOffsetTarget(ctx, source)) return;
    let scroll = state.scroll;
    let scrollCorrection = positionDiff;
    let modelCorrection = positionDiff;
    if (Math.abs(positionDiff) > 0.1 && Platform.OS === "web") {
        const observed = getObservedScrollOffset(ctx);
        const remainder = state.scrollAdjustHandler.getWebAdjustRemainder?.(observed) ?? 0;
        const max = state.refScroller.current?.getMaxScrollOffset?.();
        // A geometry clamp can consume the correction before JS observes it.
        if (max !== undefined && observed !== state.scroll && observed === Math.max(0, Math.min(state.scroll, max))) {
            scrollCorrection -= observed + remainder - state.scroll;
        }
        if (state.refScroller.current?.isScrollInRange?.() !== false && observed !== state.lastNativeScroll) {
            scroll = observed + remainder;
            modelCorrection = scrollCorrection;
        }
    }
    if (Math.abs(positionDiff) > 0.1) {
        state.layoutAdjustmentEpoch = (state.layoutAdjustmentEpoch ?? 0) + 1;
        const dataChanged = source === "data";
        const needsScrollWorkaround =
            Platform.OS === "android" && !IsNewArchitecture && dataChanged && state.scroll <= positionDiff;

        const doit = () => {
            if (preservesOffsetTarget(ctx, source)) {
                if (state.adjustingFromInitialMount) state.adjustingFromInitialMount--;
                return;
            }
            if (needsScrollWorkaround) {
                ctx.doScrollTo!({ horizontal: state.props.horizontal, isAdjustment: true, offset: state.scroll });
            } else {
                state.scrollAdjustHandler.requestAdjust(scrollCorrection);

                if (state.adjustingFromInitialMount) {
                    state.adjustingFromInitialMount--;
                }
            }
        };
        state.scroll = scroll + modelCorrection;
        // Growth already served by MVCP must not also count as end-follow credit.
        if (state.userScrollContentSize !== undefined) {
            state.userScrollContentSize += positionDiff;
        }
        state.scrollForNextCalculateItemsInView = undefined;

        const readyToRender = peek$(ctx, "readyToRender");

        if (readyToRender) {
            doit();

            // Item-size MVCP corrections preserve the native coordinate space and can arrive during
            // real momentum, so suppressing their events can mute legitimate scrolling. Other callers
            // keep the existing protection because they may temporarily expose a stale native offset.
            if (Platform.OS !== "web" && source !== "item-size") {
                // Calculate a threshold to ignore scroll jumps for a short period of time
                // This is to avoid the case where a scroll event comes in that was relevant from before
                // the requestAdjust. So we ignore scroll events that are closer to the previous
                // scroll position than the target position.
                const threshold = state.scroll - positionDiff / 2;
                if (!state.ignoreScrollFromMVCP) {
                    state.ignoreScrollFromMVCP = {};
                }
                if (positionDiff > 0) {
                    state.ignoreScrollFromMVCP.lt = threshold;
                } else {
                    state.ignoreScrollFromMVCP.gt = threshold;
                }

                const delay = needsScrollWorkaround ? 250 : 100;
                state.scheduledWork.timeout(
                    () => {
                        state.ignoreScrollFromMVCP = undefined;
                        const shouldForceUpdate =
                            state.ignoreScrollFromMVCPIgnored && state.scrollProcessingEnabled !== false;

                        if (shouldForceUpdate) {
                            state.ignoreScrollFromMVCPIgnored = false;
                            state.scrollPending = state.scroll;
                            state.reprocessCurrentScroll?.();
                        }
                    },
                    delay,
                    "ignoreScrollFromMVCP",
                );
            }
        } else {
            state.adjustingFromInitialMount = (state.adjustingFromInitialMount || 0) + 1;
            requestAnimationFrame(doit);
        }
    }
}
