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

export function doScrollTo(ctx: StateContext, params: DoScrollToParams) {
    const state = ctx.state;
    const { animated, horizontal, offset } = params;
    const scroller = state.refScroller.current as any;
    const node: HTMLElement | null =
        typeof scroller?.getScrollableNode === "function" ? scroller.getScrollableNode() : scroller;

    if (node) {
        const left = horizontal ? offset : 0;
        const top = horizontal ? 0 : offset;

        node.scrollTo({ behavior: animated ? "smooth" : "auto", left, top });

        if (animated) {
            listenForScrollEnd(ctx, node, {
                horizontal: !!horizontal,
                targetOffset: offset,
            });
        } else {
            state.scroll = offset;
            setTimeout(() => {
                finishScrollTo(ctx);
            }, 100);
        }
    }
}

function listenForScrollEnd(
    ctx: StateContext,
    node: HTMLElement,
    params: { horizontal: boolean; targetOffset: number },
): void {
    const { horizontal, targetOffset } = params;
    const supportsScrollEnd = "onscrollend" in node;
    let idleTimeout: ReturnType<typeof setTimeout> | undefined;
    let maxTimeout: ReturnType<typeof setTimeout> | undefined;
    let settled = false;
    // Bind completion to the current scroll target so stale listeners cannot finish a newer scrollTo.
    const targetToken = ctx.state.scrollingTo;

    const cleanup = () => {
        node.removeEventListener("scroll", onScroll);

        if (supportsScrollEnd) {
            node.removeEventListener("scrollend", onScrollEnd);
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
        const currentOffset = horizontal ? node.scrollLeft : node.scrollTop;
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

    node.addEventListener("scroll", onScroll);

    if (supportsScrollEnd) {
        node.addEventListener("scrollend", onScrollEnd);
        // Fallback in case scrollend fires late or never fires in this browser.
        maxTimeout = setTimeout(() => finish("max"), SCROLL_END_MAX_MS);
    } else {
        idleTimeout = setTimeout(() => finish("idle"), SMOOTH_SCROLL_DURATION_MS);
        maxTimeout = setTimeout(() => finish("max"), SCROLL_END_MAX_MS);
    }
}
