import { getContentInsetEnd } from "@/state/getContentInsetEnd";
import { peek$, type StateContext, set$ } from "@/state/state";

function getRawContentLength(ctx: StateContext) {
    const { state, values } = ctx;
    return (
        (values.get("headerSize") || 0) +
        (values.get("footerSize") || 0) +
        (state.pendingTotalSize ?? state.totalSize ?? values.get("totalSize") ?? 0) +
        (state.props.stylePaddingTop || 0) +
        (state.props.stylePaddingBottom || 0)
    );
}

function getAlignItemsAtEndPadding(ctx: StateContext) {
    const { state } = ctx;
    const shouldPad =
        !!state.props.alignItemsAtEndPaddingEnabled &&
        !state.props.horizontal &&
        state.props.data.length > 0 &&
        state.scrollLength > 0;

    return shouldPad ? Math.max(0, state.scrollLength - getRawContentLength(ctx) - getContentInsetEnd(ctx)) : 0;
}

export function updateContentMetricsState(ctx: StateContext) {
    const previousPadding = peek$(ctx, "alignItemsAtEndPadding") || 0;
    const nextPadding = getAlignItemsAtEndPadding(ctx);
    if (previousPadding !== nextPadding) {
        set$(ctx, "alignItemsAtEndPadding", nextPadding);
    }
}
