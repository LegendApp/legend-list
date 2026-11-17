import { getObservedScrollOffset } from "@/core/observedScroll";
import type { StateContext } from "@/state/state";

const NATIVE_SCROLL_IDLE_MS = 200;

export function hasNativeScrollToStart(ctx: StateContext) {
    return ctx.state.scheduledWork.has("nativeScrollToStart");
}

export function cancelNativeScrollToStart(ctx: StateContext) {
    ctx.state.scheduledWork.cancel("nativeScrollToStart");
}

/** Home owns its boundary through arrival, late measurements and the browser's final frames. */
export function beginNativeScrollToStart(ctx: StateContext) {
    cancelNativeScrollToStart(ctx);
    const { state } = ctx;
    const scroller = state.refScroller.current;
    const target = scroller?.getScrollEventTarget?.() ?? scroller?.getScrollableNode?.();
    if (!target || !("addEventListener" in target)) return;
    let active = true;
    let idle: ReturnType<typeof setTimeout> | undefined;
    let frame: number | undefined;
    const cancelFrame = () => {
        if (frame !== undefined) cancelAnimationFrame(frame);
        frame = undefined;
    };
    const settle = () => {
        if (!active) return;
        cancelFrame();
        const offset = getObservedScrollOffset(ctx);
        const totalSize = state.totalSize;
        const epoch = state.layoutAdjustmentEpoch;
        // scrollend can precede a final motion or measurement frame. A new scroll
        // invalidates this settlement; geometry changes require two quiet frames.
        frame = requestAnimationFrame(() => {
            if (!active) return;
            frame = requestAnimationFrame(() => {
                if (!active) return;
                if (
                    offset !== getObservedScrollOffset(ctx) ||
                    totalSize !== state.totalSize ||
                    epoch !== state.layoutAdjustmentEpoch
                ) {
                    onScroll();
                } else {
                    cancelNativeScrollToStart(ctx);
                }
            });
        });
    };
    const onScroll = () => {
        if (!active) return;
        clearTimeout(idle);
        cancelFrame();
        idle = setTimeout(settle, NATIVE_SCROLL_IDLE_MS);
    };
    const onScrollEnd = () => {
        onScroll();
        // An old scrollend can arrive after Home was accepted but before it moved.
        if (getObservedScrollOffset(ctx) <= 1) settle();
    };
    state.scheduledWork.register("nativeScrollToStart", () => {
        active = false;
        clearTimeout(idle);
        cancelFrame();
        target.removeEventListener("scroll", onScroll);
        target.removeEventListener("scrollend", onScrollEnd);
    });
    target.addEventListener("scroll", onScroll);
    target.addEventListener("scrollend", onScrollEnd);
    onScroll();
}
