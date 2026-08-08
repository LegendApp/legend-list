import type { DoScrollToParams } from "@/core/doScrollParams";
import { finishScrollTo } from "@/core/finishScrollTo";
import { getContentSize } from "@/state/getContentSize";
import type { StateContext } from "@/state/state";
import { toNativeHorizontalOffset } from "@/utils/rtl";

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

    if (isAnimated) {
        const target = scroller.getScrollEventTarget?.() ?? null;
        listenForScrollEnd(ctx, {
            readOffset: () => scroller.getCurrentScrollOffset!(),
            target,
            targetOffset: offset,
        });
    } else {
        state.scroll = offset;
        const targetToken = state.scrollingTo;
        state.scheduledWork.timeout(
            () => {
                if (targetToken === state.scrollingTo) {
                    finishScrollTo(ctx);
                }
            },
            100,
            "platformScrollCompletion",
        );
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
    const { scheduledWork, scrollingTo: targetToken } = ctx.state;
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

    const finish = (reason: "scrollend" | "idle" | "max") => {
        if (settled) return;
        if (targetToken !== ctx.state.scrollingTo) {
            scheduledWork.cancel("platformScrollCompletion");
            return;
        }
        const currentOffset = readOffset();
        const isNearTarget = Math.abs(currentOffset - targetOffset) <= SCROLL_END_TARGET_EPSILON;
        // Some browsers emit scrollend before smooth scrolling actually settles.
        // Ignore early scrollend and rely on subsequent scroll/idle events.
        if (reason === "scrollend" && !isNearTarget) {
            return;
        }

        scheduledWork.cancel("platformScrollCompletion");
        finishScrollTo(ctx);
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
