import { getContentInsetEnd } from "@/state/getContentInsetEnd";
import type { StateContext } from "@/state/state";

export function getContentSize(ctx: StateContext) {
    const { values, state } = ctx;
    const stylePaddingTop: number = values.get("stylePaddingTop") || 0;
    const stylePaddingBottom: number = state.props.stylePaddingBottom || 0;
    const alignItemsAtEndPadding: number = values.get("alignItemsAtEndPadding") || 0;
    const headerSize: number = values.get("headerSize") || 0;
    const footerSize: number = values.get("footerSize") || 0;
    const contentInsetBottom = getContentInsetEnd(ctx);
    const totalSize: number = state.pendingTotalSize ?? state.totalSize ?? values.get("totalSize");
    return (
        headerSize +
        footerSize +
        totalSize +
        stylePaddingTop +
        alignItemsAtEndPadding +
        stylePaddingBottom +
        (contentInsetBottom || 0)
    );
}
