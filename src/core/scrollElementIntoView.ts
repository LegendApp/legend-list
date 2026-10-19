import { getObservedScrollOffset } from "@/core/emitMetrics";
import { scrollTo } from "@/core/scrollTo";
import type { StateContext } from "@/state/state";

export function scrollElementIntoView(ctx: StateContext, animated = false) {
    const { state } = ctx;
    const target = state.scrollElementTarget;
    const node = state.refScroller.current?.getScrollableNode() as Element | null | undefined;
    if (!target || !node?.getBoundingClientRect) return false;
    const ancestor =
        "commonAncestorContainer" in target.element ? target.element.commonAncestorContainer : target.element;
    if (!ancestor.isConnected) {
        state.scrollElementTarget = undefined;
        return false;
    }
    const rect = target.element.getBoundingClientRect();
    const viewport = node.getBoundingClientRect();
    const top = viewport.top + (target.viewportMargin?.top ?? 0);
    const bottom = viewport.bottom - (target.viewportMargin?.bottom ?? 0);
    const alignedDelta =
        target.viewPosition === undefined
            ? undefined
            : rect.top - top - target.viewPosition * (bottom - top - rect.height);
    const delta =
        alignedDelta ??
        (rect.top < top ? rect.top - top : rect.bottom > bottom ? Math.min(rect.top - top, rect.bottom - bottom) : 0);
    if (Math.abs(delta) <= 1) return false;
    scrollTo(ctx, { animated, offset: getObservedScrollOffset(ctx) + delta });
    return true;
}
