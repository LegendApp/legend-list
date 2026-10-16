import { EDGE_POSITION_EPSILON } from "@/constants";
import { calculateOffsetForIndex } from "@/core/calculateOffsetForIndex";
import { getCurrentTargetOffset } from "@/core/checkFinishedScroll";
import type { DoScrollToParams } from "@/core/doScrollParams";
import { finishScrollTo } from "@/core/finishScrollTo";
import { scrollTo } from "@/core/scrollTo";
import { clampScrollIndex } from "@/core/scrollToIndex";
import { getContentSize } from "@/state/getContentSize";
import type { StateContext } from "@/state/state";
import { getItemSizeAtIndex } from "@/utils/getItemSize";
import { peekLogicalHorizontalOffset, toNativeHorizontalOffset } from "@/utils/rtl";

const SCROLL_END_IDLE_MS = 80;
const SCROLL_END_MAX_MS = 1500;
const SMOOTH_SCROLL_DURATION_MS = 320;
// Reissues allowed when an animated scroll settles short of its target; the last one is instant.
const SCROLL_LANDING_MAX_RETRIES = 3;
// Remaining distances at or below this land with an instant scroll instead of another animation.
const SCROLL_LANDING_SNAP_DISTANCE = 50;
type ActiveScrollTarget = NonNullable<StateContext["state"]["scrollingTo"]>;
type ScrollEventTarget = {
    addEventListener(type: string, listener: (...args: any[]) => void): void;
    removeEventListener(type: string, listener: (...args: any[]) => void): void;
};

export function doScrollTo(ctx: StateContext, params: DoScrollToParams) {
    const state = ctx.state;
    const { animated, horizontal, offset } = params;
    state.scheduledWork.cancel("platformScrollCompletion");

    const scroller = state.refScroller.current;
    const node = scroller?.getScrollableNode();
    if (!scroller || !node) {
        return;
    }

    const isAnimated = !!animated;
    const isHorizontal = !!horizontal;
    const contentSize = isHorizontal ? getContentSize(ctx) : undefined;
    const left = isHorizontal ? toNativeHorizontalOffset(state, offset, contentSize) : 0;
    const top = isHorizontal ? 0 : offset;
    scroller.scrollTo({ animated: isAnimated, x: left, y: top });

    const readOffset = () => {
        const observed = scroller.getCurrentScrollOffset?.() ?? Number.NaN;
        return isHorizontal ? peekLogicalHorizontalOffset(state, observed, scroller.getMaxScrollOffset?.()) : observed;
    };

    if (isAnimated) {
        // The DOM clamps the request to its current content size. An already
        // aligned request emits no scroll/scrollend events.
        const targetOffset = Math.max(0, Math.min(offset, scroller.getMaxScrollOffset?.() ?? offset));
        if (!(Math.abs(readOffset() - targetOffset) <= EDGE_POSITION_EPSILON)) {
            const target = scroller.getScrollEventTarget?.() ?? null;
            listenForScrollEnd(ctx, {
                readMaxOffset: () => scroller.getMaxScrollOffset?.() ?? Number.POSITIVE_INFINITY,
                readOffset,
                target,
                targetOffset,
            });
            return;
        }
    } else {
        state.scroll = offset;
    }

    // Verify aligned requests and instant retries after queued layout measurements.
    const targetToken = state.scrollingTo;
    state.scheduledWork.frame(() => {
        if (targetToken === state.scrollingTo) {
            const currentOffset = readOffset();
            const landingOffset = targetToken
                ? Math.min(
                      getCurrentTargetOffset(ctx, targetToken),
                      scroller.getMaxScrollOffset?.() ?? Number.POSITIVE_INFINITY,
                  )
                : offset;
            if (
                targetToken &&
                !targetToken.isInitialScroll &&
                (isAnimated || targetToken.landingRetries) &&
                Math.abs(currentOffset - landingOffset) > EDGE_POSITION_EPSILON
            ) {
                retryLanding(ctx, targetToken, currentOffset, landingOffset);
            } else {
                finishScrollTo(ctx);
            }
        }
    }, "platformScrollCompletion");
}

function retryLanding(
    ctx: StateContext,
    scrollingTo: ActiveScrollTarget,
    currentOffset: number,
    landingOffset: number,
) {
    const retries = (scrollingTo.landingRetries ?? 0) + 1;
    const madeProgress =
        scrollingTo.landingRetryFrom === undefined ||
        Math.abs(currentOffset - scrollingTo.landingRetryFrom) > EDGE_POSITION_EPSILON;
    // Bound animated retries; instant corrections still verify the current target next frame.
    const isLastRetry = retries >= SCROLL_LANDING_MAX_RETRIES || !madeProgress;
    const { averageSizeSnapshot: _averageSizeSnapshot, targetOffset: _targetOffset, ...target } = scrollingTo;
    const index = target.index === undefined ? undefined : clampScrollIndex(target.index, ctx.state.props.data.length);

    scrollTo(ctx, {
        ...target,
        animated: !isLastRetry && Math.abs(landingOffset - currentOffset) > SCROLL_LANDING_SNAP_DISTANCE,
        landingRetries: retries,
        landingRetryFrom: currentOffset,
        ...(index !== undefined
            ? {
                  index,
                  itemSize: getItemSizeAtIndex(ctx, index),
                  offset: calculateOffsetForIndex(ctx, index),
                  precomputedWithViewOffset: false,
              }
            : {}),
    });
}

function listenForScrollEnd(
    ctx: StateContext,
    params: {
        target: ScrollEventTarget | null | undefined;
        readMaxOffset: () => number;
        readOffset: () => number;
        targetOffset: number;
    },
): void {
    const { readMaxOffset, readOffset, target, targetOffset } = params;
    // Bind completion to the current scroll target so stale listeners cannot finish a newer scrollTo.
    const { scheduledWork, scrollingTo: targetToken } = ctx.state;
    // Scrolls without a target (noScrollingTo) have nothing to land or resolve.
    if (!target || !targetToken) {
        finishScrollTo(ctx);
        return;
    }
    const supportsScrollEnd = "onscrollend" in target;
    let idleTimeout: ReturnType<typeof setTimeout> | undefined;
    let settled = false;
    // Fallback in case scrollend fires late or never fires in this browser.
    const maxTimeout = setTimeout(() => finish("max"), SCROLL_END_MAX_MS);

    const cleanup = () => {
        target.removeEventListener("scroll", onScroll);

        if (supportsScrollEnd) {
            target.removeEventListener("scrollend", onScrollEnd);
        }

        if (idleTimeout !== undefined) {
            clearTimeout(idleTimeout);
        }
        clearTimeout(maxTimeout);
    };

    const cancel = () => {
        if (!settled) {
            settled = true;
            cleanup();
        }
    };

    const isCurrent = () => {
        if (settled) return false;
        if (targetToken !== ctx.state.scrollingTo) {
            scheduledWork.cancel("platformScrollCompletion");
            return false;
        }
        return true;
    };

    const finish = (reason: "scrollend" | "idle" | "max") => {
        if (!isCurrent()) return;
        const currentOffset = readOffset();
        // Rows that measure during the scroll move an index target, so compare against where it is now.
        const landingOffset = Math.min(getCurrentTargetOffset(ctx, targetToken), readMaxOffset());
        const isNearTarget = Math.abs(currentOffset - landingOffset) <= EDGE_POSITION_EPSILON;
        // Initial scrolls keep their own completion path; scrollTo does not dispatch them on web.
        if (
            (isNearTarget && Math.abs(targetOffset - landingOffset) <= EDGE_POSITION_EPSILON) ||
            targetToken.isInitialScroll
        ) {
            scheduledWork.cancel("platformScrollCompletion");
            finishScrollTo(ctx);
            return;
        }
        // Some browsers emit scrollend before smooth scrolling actually settles.
        // Ignore early scrollend and rely on subsequent scroll/idle events.
        if (reason === "scrollend" && !isNearTarget && Math.abs(currentOffset - targetOffset) > EDGE_POSITION_EPSILON) {
            return;
        }

        // Settled or stalled short of the target: reissue toward the recomputed offset.
        retryLanding(ctx, targetToken, currentOffset, landingOffset);
    };

    const onScroll = () => {
        if (idleTimeout !== undefined) {
            clearTimeout(idleTimeout);
        }
        idleTimeout = setTimeout(() => finish("idle"), SCROLL_END_IDLE_MS);
    };

    const onScrollEnd = () => finish("scrollend");

    target.addEventListener("scroll", onScroll);

    if (supportsScrollEnd) {
        target.addEventListener("scrollend", onScrollEnd);
    } else {
        idleTimeout = setTimeout(() => finish("idle"), SMOOTH_SCROLL_DURATION_MS);
    }
    scheduledWork.register("platformScrollCompletion", cancel);
}
