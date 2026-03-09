import { finishScrollTo } from "@/core/finishScrollTo";
import { INTERNAL_PERF_CONFIG } from "@/core/internalPerfConfig";
import type { StateContext } from "@/state/state";

export interface DoScrollToParams {
    animated?: boolean;
    horizontal?: boolean;
    isInitialScroll?: boolean;
    offset: number;
}

const SCROLL_END_IDLE_MS = 80;
const SCROLL_END_MAX_MS = 1500;
const SMOOTH_SCROLL_DURATION_MS = 320;
const SCROLL_END_TARGET_EPSILON = 1;
type ScrollEventTarget = {
    addEventListener(type: string, listener: (...args: any[]) => void): void;
    removeEventListener(type: string, listener: (...args: any[]) => void): void;
};

export function doScrollTo(ctx: StateContext, params: DoScrollToParams) {
    const state = ctx.state;
    const { animated, horizontal, offset } = params;
    const scroller = state.refScroller.current;
    const node = scroller?.getScrollableNode();
    if (!scroller || !node) {
        return;
    }

    const isAnimated = !!animated;
    const isHorizontal = !!horizontal;
    const left = isHorizontal ? offset : 0;
    const top = isHorizontal ? 0 : offset;

    if (INTERNAL_PERF_CONFIG.log) {
        console.log(
            "[legend-list][perf]",
            JSON.stringify({
                animated: isAnimated,
                event: "doScrollTo-start",
                horizontal: isHorizontal,
                offset,
                scrollingTo: state.scrollingTo
                    ? {
                          index: state.scrollingTo.index,
                          isInitialScroll: !!state.scrollingTo.isInitialScroll,
                          offset: state.scrollingTo.offset,
                          targetOffset: state.scrollingTo.targetOffset,
                      }
                    : undefined,
            }),
        );
    }

    scroller.scrollTo({ animated: isAnimated, x: left, y: top });

    if (isAnimated) {
        const target = scroller.getScrollEventTarget();
        listenForScrollEnd(ctx, {
            readOffset: () => scroller.getCurrentScrollOffset!(),
            target,
            targetOffset: offset,
        });
    } else {
        state.scroll = offset;
        setTimeout(() => {
            finishScrollTo(ctx);
        }, 100);
    }
}

function listenForScrollEnd(
    ctx: StateContext,
    params: {
        target: ScrollEventTarget | null | undefined;
        readOffset: () => number;
        targetOffset: number;
    },
): void {
    const { readOffset, target, targetOffset } = params;
    if (!target) {
        finishScrollTo(ctx);
        return;
    }
    const supportsScrollEnd = "onscrollend" in target;
    let idleTimeout: ReturnType<typeof setTimeout> | undefined;
    let settled = false;
    // Bind completion to the current scroll target so stale listeners cannot finish a newer scrollTo.
    const targetToken = ctx.state.scrollingTo;
    // Fallback in case scrollend fires late or never fires in this browser.
    const maxTimeout = setTimeout(() => finish("max"), SCROLL_END_MAX_MS);

    const cleanup = () => {
        target.removeEventListener("scroll", onScroll);

        if (supportsScrollEnd) {
            target.removeEventListener("scrollend", onScrollEnd);
        }

        if (idleTimeout) {
            clearTimeout(idleTimeout);
        }
        clearTimeout(maxTimeout);
    };

    const finish = (reason: "scrollend" | "idle" | "max") => {
        if (settled) return;
        if (targetToken !== ctx.state.scrollingTo) {
            if (INTERNAL_PERF_CONFIG.log) {
                console.log(
                    "[legend-list][perf]",
                    JSON.stringify({
                        event: "doScrollTo-finish-ignored",
                        reason,
                    }),
                );
            }
            settled = true;
            cleanup();
            return;
        }
        const currentOffset = readOffset();
        const isNearTarget = Math.abs(currentOffset - targetOffset) <= SCROLL_END_TARGET_EPSILON;
        if (INTERNAL_PERF_CONFIG.log) {
            console.log(
                "[legend-list][perf]",
                JSON.stringify({
                    currentOffset,
                    diff: currentOffset - targetOffset,
                    event: "doScrollTo-finish-candidate",
                    isNearTarget,
                    reason,
                    scrollingTo: ctx.state.scrollingTo
                        ? {
                              index: ctx.state.scrollingTo.index,
                              offset: ctx.state.scrollingTo.offset,
                              targetOffset: ctx.state.scrollingTo.targetOffset,
                          }
                        : undefined,
                    targetOffset,
                }),
            );
        }
        // Some browsers emit scrollend before smooth scrolling actually settles.
        // Ignore early scrollend and rely on subsequent scroll/idle events.
        if (reason === "scrollend" && !isNearTarget) {
            return;
        }

        settled = true;
        cleanup();
        finishScrollTo(ctx);
    };

    const onScroll = () => {
        if (idleTimeout) {
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
}
