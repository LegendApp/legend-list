import { getContentSize } from "@/state/getContentSize";
import { peek$, type StateContext } from "@/state/state";
import type { LegendListMetrics } from "@/types.base";
import { toLogicalHorizontalOffset } from "@/utils/rtl";

export function getObservedScrollOffset(ctx: StateContext) {
    const { state } = ctx;
    const observed = state.refScroller.current?.getCurrentScrollOffset?.();
    if (observed === undefined) return state.lastNativeScroll ?? state.scroll;
    // The DOM reports raw RTL offsets; match the logical offsets onScroll records.
    return state.props.horizontal ? toLogicalHorizontalOffset(state, observed, getContentSize(ctx)) : observed;
}

export function getDistanceFromEnd(ctx: StateContext) {
    return Math.max(0, getContentSize(ctx) - getObservedScrollOffset(ctx) - ctx.state.scrollLength);
}

export function emitMetrics(ctx: StateContext) {
    const { state } = ctx;
    const { onMetricsChange, trackScrollMetrics } = state.props;
    if (!onMetricsChange) return;
    const footerSize = peek$(ctx, "footerSize") || 0;
    const headerSize = peek$(ctx, "headerSize") || 0;
    const previous = state.lastMetrics;
    // Other metrics can change every scroll frame, so only consumers that opt in are notified of them.
    if (!trackScrollMetrics && previous?.footerSize === footerSize && previous.headerSize === headerSize) return;
    const contentLength = getContentSize(ctx);
    const scroll = getObservedScrollOffset(ctx);
    const metrics: LegendListMetrics = {
        contentLength,
        distanceFromEnd: Math.max(0, contentLength - scroll - state.scrollLength),
        footerSize,
        headerSize,
        isAtEnd: !!peek$(ctx, "isAtEnd"),
        isFollowingEnd: !!peek$(ctx, "isFollowingEnd"),
        scroll,
        scrollLength: state.scrollLength,
    };
    let didChange = !previous;
    if (previous) {
        for (const key in metrics) {
            if (previous[key as keyof LegendListMetrics] !== metrics[key as keyof LegendListMetrics]) {
                didChange = true;
                break;
            }
        }
    }
    if (didChange) {
        state.lastMetrics = metrics;
        onMetricsChange(metrics);
    }
}
