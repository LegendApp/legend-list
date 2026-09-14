import { getContentInsetEnd } from "@/state/getContentInsetEnd";
import type { StateContext } from "@/state/state";

export function getContentSize(ctx: StateContext) {
    const { values, state } = ctx;
    const stylePaddingStart: number = state.props.horizontal
        ? state.props.stylePaddingLeft || 0
        : values.get("stylePaddingTop") || 0;
    const stylePaddingEnd: number = state.props.horizontal
        ? state.props.stylePaddingRight || 0
        : state.props.stylePaddingBottom || 0;
    const alignItemsAtEndPadding: number = values.get("alignItemsAtEndPadding") || 0;
    const headerSize: number = values.get("headerSize") || 0;
    const footerSize: number = values.get("footerSize") || 0;
    const contentInsetEnd = getContentInsetEnd(ctx);
    const totalSize: number = state.pendingTotalSize ?? state.totalSize ?? values.get("totalSize");
    const layoutSize = Math.max(0, totalSize - (state.props.data.length > 0 ? ctx.scrollAxisGap : 0));
    return (
        headerSize +
        footerSize +
        layoutSize +
        stylePaddingStart +
        alignItemsAtEndPadding +
        stylePaddingEnd +
        (contentInsetEnd || 0)
    );
}
