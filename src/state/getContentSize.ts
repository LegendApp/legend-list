import { getContentInsetEnd } from "@/state/getContentInsetEnd";
import type { StateContext } from "@/state/state";

function getContentSizeWithTotalSize(ctx: StateContext, totalSize: number) {
    const { values, state } = ctx;
    const stylePaddingTop: number = values.get("stylePaddingTop") || 0;
    const stylePaddingBottom: number = state.props.stylePaddingBottom || 0;
    const headerSize: number = values.get("headerSize") || 0;
    const footerSize: number = values.get("footerSize") || 0;
    const contentInsetBottom = getContentInsetEnd(state);
    return headerSize + footerSize + totalSize + stylePaddingTop + stylePaddingBottom + (contentInsetBottom || 0);
}

export function getContentSize(ctx: StateContext) {
    return getContentSizeWithTotalSize(ctx, ctx.values.get("totalSize") || 0);
}

export function getContentSizeExact(ctx: StateContext) {
    return getContentSizeWithTotalSize(ctx, ctx.state.totalSizeExact);
}
