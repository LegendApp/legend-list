import { getContentInsetEnd } from "@/state/getContentInsetEnd";
import type { StateContext } from "@/state/state";

export function getContentSize(ctx: StateContext) {
    const { values, state } = ctx;
    const stylePaddingTop: number = values.get("stylePaddingTop") || 0;
    const stylePaddingBottom: number = state.props.stylePaddingBottom || 0;
    const headerSize: number = values.get("headerSize") || 0;
    const footerSize: number = values.get("footerSize") || 0;
    const contentInsetBottom = getContentInsetEnd(state);
    const totalSize: number = state.pendingTotalSize ?? values.get("totalSize");
    return headerSize + footerSize + totalSize + stylePaddingTop + stylePaddingBottom + (contentInsetBottom || 0);
}
