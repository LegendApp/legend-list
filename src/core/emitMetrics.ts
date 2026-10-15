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
    const { onMetricsChange, trackScrollMetrics } = state.props;
    if (!onMetricsChange) return;
    const footerSize = peek$(ctx, "footerSize") || 0;
    const headerSize = peek$(ctx, "headerSize") || 0;
    const previous = state.lastMetrics;
    // Other metrics can change every scroll frame, so only consumers that opt in are notified of them.
    if (!trackScrollMetrics && previous?.footerSize === footerSize && previous.headerSize === headerSize) return;
    const metrics: LegendListMetrics = {
        contentLength: getContentSize(ctx),
        distanceFromEnd: getDistanceFromEnd(ctx),
        footerSize,
        headerSize,
        isAtEnd: !!peek$(ctx, "isAtEnd"),
        isFollowingEnd: !!peek$(ctx, "isFollowingEnd"),
        scroll: getObservedScrollOffset(ctx),
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
