import { getContentSize } from "@/state/getContentSize";
import { peek$, type StateContext } from "@/state/state";
import type { LegendListMetrics } from "@/types.base";

export function getObservedScrollOffset(ctx: StateContext) {
    const { state } = ctx;
    return state.refScroller.current?.getCurrentScrollOffset?.() ?? state.lastNativeScroll ?? state.scroll;
}

export function getDistanceFromEnd(ctx: StateContext) {
    return Math.max(0, getContentSize(ctx) - getObservedScrollOffset(ctx) - ctx.state.scrollLength);
}

export function emitMetrics(ctx: StateContext) {
    const { state } = ctx;
    if (!state.props.onMetricsChange) return;
    const contentLength = getContentSize(ctx);
    const metrics: LegendListMetrics = {
        contentLength,
        distanceFromEnd: getDistanceFromEnd(ctx),
        footerSize: peek$(ctx, "footerSize") || 0,
        headerSize: peek$(ctx, "headerSize") || 0,
        isAtEnd: !!peek$(ctx, "isAtEnd"),
        isFollowingEnd: !!peek$(ctx, "isFollowingEnd"),
        scroll: getObservedScrollOffset(ctx),
        scrollLength: state.scrollLength,
    };
    const previous = state.lastMetrics;
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
        state.props.onMetricsChange(metrics);
    }
}
