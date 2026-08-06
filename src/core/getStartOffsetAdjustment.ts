import { peek$, type StateContext } from "@/state/state";
import { isHorizontalRTL } from "@/utils/rtl";

export function getStartOffsetAdjustment(ctx: StateContext) {
    const { state } = ctx;
    const stylePaddingStart = state.props.horizontal
        ? (isHorizontalRTL(state) ? state.props.stylePaddingRight : state.props.stylePaddingLeft) || 0
        : peek$(ctx, "stylePaddingTop") || 0;

    return stylePaddingStart + (peek$(ctx, "alignItemsAtEndPadding") || 0) + (peek$(ctx, "headerSize") || 0);
}
