import { finishScrollTo } from "@/core/finishScrollTo";
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

type ScrollEventTarget = Pick<Window, "addEventListener" | "removeEventListener">;

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
    node.scrollTo({ behavior: isAnimated ? "smooth" : "auto", left, top });

    if (isAnimated) {
        const target = scroller.getScrollEventTarget?.() ?? node;
        listenForScrollEnd(ctx, {
            readOffset: () => {
                if (typeof scroller.getCurrentScrollOffset === "function") {
                    return scroller.getCurrentScrollOffset();
                }
                return isHorizontal ? node.scrollLeft : node.scrollTop;
            },
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
    let maxTimeout: ReturnType<typeof setTimeout> | undefined;
    let settled = false;
    // Bind completion to the current scroll target so stale listeners cannot finish a newer scrollTo.
    const targetToken = ctx.state.scrollingTo;

    const cleanup = () => {
        target.removeEventListener("scroll", onScroll);

        if (supportsScrollEnd) {
            target.removeEventListener("scrollend", onScrollEnd);
        }

        if (idleTimeout) {
            clearTimeout(idleTimeout);
        }
        if (maxTimeout) {
            clearTimeout(maxTimeout);
        }
    };

    const finish = (reason: "scrollend" | "idle" | "max") => {
        if (settled) return;
        if (targetToken !== ctx.state.scrollingTo) {
            settled = true;
            cleanup();
            return;
        }
        const currentOffset = readOffset();
        const isNearTarget = Math.abs(currentOffset - targetOffset) <= SCROLL_END_TARGET_EPSILON;
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
    // Fallback in case scrollend fires late or never fires in this browser.
    maxTimeout = setTimeout(() => finish("max"), SCROLL_END_MAX_MS);
}
