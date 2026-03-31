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
type ScrollEventTarget = {
    addEventListener(type: string, listener: (...args: any[]) => void): void;
    removeEventListener(type: string, listener: (...args: any[]) => void): void;
};

type ScrollNodeLike = {
    scrollLeft?: number;
    scrollTop?: number;
};

export function doScrollTo(ctx: StateContext, params: DoScrollToParams) {
    const state = ctx.state;
    const { animated, horizontal, offset } = params;
    const scroller = state.refScroller.current as
        | ({
              getCurrentScrollOffset?: () => number;
              getScrollEventTarget?: () => ScrollEventTarget | null;
              getScrollableNode?: () => ScrollNodeLike | null;
              scrollTo: (options: { animated?: boolean; x?: number; y?: number }) => void;
          } & ScrollNodeLike)
        | null;
    const node = typeof scroller?.getScrollableNode === "function" ? scroller.getScrollableNode() : scroller;
    if (!scroller || !node) {
        return;
    }

    const isAnimated = !!animated;
    const isHorizontal = !!horizontal;
    const left = isHorizontal ? offset : 0;
    const top = isHorizontal ? 0 : offset;
    scroller.scrollTo({ animated: isAnimated, x: left, y: top });

    if (isAnimated) {
        const target =
            typeof scroller.getScrollEventTarget === "function"
                ? scroller.getScrollEventTarget()
                : typeof (node as ScrollEventTarget).addEventListener === "function" &&
                    typeof (node as ScrollEventTarget).removeEventListener === "function"
                  ? (node as ScrollEventTarget)
                  : undefined;
        listenForScrollEnd(ctx, {
            readOffset: () =>
                typeof scroller.getCurrentScrollOffset === "function"
                    ? scroller.getCurrentScrollOffset()
                    : ((horizontal ? node.scrollLeft : node.scrollTop) ?? offset),
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
        const targetToken = ctx.state.scrollingTo;
        setTimeout(() => {
            if (targetToken === ctx.state.scrollingTo) {
                finishScrollTo(ctx);
            }
        }, SMOOTH_SCROLL_DURATION_MS);
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
}
