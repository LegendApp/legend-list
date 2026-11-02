import type { StateContext } from "@/state/state";
import { peekLogicalHorizontalOffset } from "@/utils/rtl";

export function getObservedScrollOffset(ctx: StateContext, fallbackOffset = ctx.state.scroll) {
    const { state } = ctx;
    const scroller = state.refScroller.current;
    const observed = scroller?.getCurrentScrollOffset?.();
    if (observed === undefined) return state.lastNativeScroll ?? fallbackOffset;
    // The DOM reports raw RTL offsets; match the logical offsets onScroll records.
    return state.props.horizontal
        ? peekLogicalHorizontalOffset(state, observed, scroller!.getMaxScrollOffset?.())
        : observed;
}
