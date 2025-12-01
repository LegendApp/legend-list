import { finishScrollTo } from "@/core/finishScrollTo";
import { listen$, peek$, type StateContext } from "@/state/state";
import type { InternalState } from "@/types";

export interface DoScrollToParams {
    animated?: boolean;
    horizontal?: boolean;
    isInitialScroll?: boolean;
    offset: number;
}

const SCROLL_END_IDLE_MS = 80;
const SCROLL_END_MAX_MS = 1500;
const SMOOTH_SCROLL_DURATION_MS = 320;

export function doScrollTo(ctx: StateContext, state: InternalState, params: DoScrollToParams) {
    const { animated, horizontal, offset } = params;
    const scroller = state.refScroller.current as any;
    const node: HTMLElement | null =
        typeof scroller?.getScrollableNode === "function" ? scroller.getScrollableNode() : scroller;

    if (node) {
        const left = horizontal ? offset : 0;
        const top = horizontal ? 0 : offset;

        node.scrollTo({ behavior: animated ? "smooth" : "auto", left, top });

        if (animated) {
            listenForScrollEnd(ctx, state, node);
        } else {
            state.scroll = offset;
            setTimeout(() => {
                finishScrollTo(ctx, state);
            }, 100);
        }
    }
}

function listenForScrollEnd(ctx: StateContext, state: InternalState, node: HTMLElement): () => void {
    const supportsScrollEnd = "onscrollend" in node;
    let idleTimeout: ReturnType<typeof setTimeout> | undefined;
    let maxTimeout: ReturnType<typeof setTimeout> | undefined;
    let settled = false;
    const targetToken = peek$(ctx, "scrollingTo");

    const finish = () => {
        if (settled) return;
        settled = true;

        cleanup();

        // If another scrollTo wasn't triggered since this started, finish the scrollTo
        if (targetToken === peek$(ctx, "scrollingTo")) {
            finishScrollTo(ctx, state);
        }
    };

    const onScroll = () => {
        if (idleTimeout) {
            clearTimeout(idleTimeout);
        }
        idleTimeout = setTimeout(finish, SCROLL_END_IDLE_MS);
    };

    const cleanup = () => {
        if (supportsScrollEnd) {
            node.removeEventListener("scrollend", finish);
        } else {
            (node as HTMLElement).removeEventListener("scroll", onScroll);
        }

        if (idleTimeout) {
            clearTimeout(idleTimeout);
        }
        if (maxTimeout) {
            clearTimeout(maxTimeout);
        }
    };

    if (supportsScrollEnd) {
        node.addEventListener("scrollend", finish, { once: true });
    } else {
        (node as HTMLElement).addEventListener("scroll", onScroll);
        idleTimeout = setTimeout(finish, SMOOTH_SCROLL_DURATION_MS);
        maxTimeout = setTimeout(finish, SCROLL_END_MAX_MS);
    }

    return cleanup;
}
