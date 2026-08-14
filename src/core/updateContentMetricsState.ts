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

export function getAlignItemsAtEndPadding(ctx: StateContext) {
    const { state } = ctx;
    const shouldPad =
        !!state.props.alignItemsAtEndPaddingEnabled &&
        !state.props.horizontal &&
        state.props.data.length > 0 &&
        state.scrollLength > 0;

    return shouldPad ? Math.max(0, state.scrollLength - getRawContentLength(ctx) - getContentInsetEnd(ctx)) : 0;
}

export function updateContentMetricsState(ctx: StateContext) {
    const { state } = ctx;
    const previousPadding = peek$(ctx, "alignItemsAtEndPadding") || 0;
    const nextPadding = getAlignItemsAtEndPadding(ctx);

    if (previousPadding !== nextPadding) {
        const isAnimatedMaintainActive =
            state.maintainingScrollAtEnd === "pending-animated" || state.maintainingScrollAtEnd === "animated";
        const isMaintainExpected =
            state.didContainersLayout &&
            state.props.maintainScrollAtEnd?.animated &&
            (isAnimatedMaintainActive ||
                (previousPadding > nextPadding && peek$(ctx, "isWithinMaintainScrollAtEndThreshold")));

        if (isMaintainExpected && !isAnimatedMaintainActive && !state.pendingMaintainScrollAtEnd) {
            // Keep the current padding only when a synchronous maintain pass claims it as animation runway.
            queueMicrotask(() => {
                if (!state.maintainingScrollAtEnd && !state.pendingMaintainScrollAtEnd) {
                    set$(ctx, "alignItemsAtEndPadding", getAlignItemsAtEndPadding(ctx));
                }
            });
        } else if (!isMaintainExpected) {
            set$(ctx, "alignItemsAtEndPadding", nextPadding);
        }
    }
}
