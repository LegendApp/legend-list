import { Platform } from "@/platform/Platform";
import { getContentInsetEnd } from "@/state/getContentInsetEnd";
import type { StateContext } from "@/state/state";
import { isHorizontalRTL } from "@/utils/rtl";

export function getContentSize(ctx: StateContext, includeContentContainerMinSize = true) {
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
    const contentSize =
        headerSize + footerSize + layoutSize + stylePaddingStart + alignItemsAtEndPadding + stylePaddingEnd;
    // Rendered end space is inside the minimum; native insets are outside it.
    // Native RTL retains its existing inset/minimum coordinate convention.
    const inContentInset =
        Platform.OS === "web" || isHorizontalRTL(state)
            ? contentInsetEnd
            : state.props.anchoredEndSpace && state.props.anchoredEndSpaceOwner === "list"
              ? values.get("anchoredEndSpaceSize") || 0
              : 0;
    const containerSize = contentSize + inContentInset;
    return (
        (includeContentContainerMinSize
            ? Math.max(containerSize, state.props.contentContainerMinSize ?? 0)
            : containerSize) +
        contentInsetEnd -
        inContentInset
    );
}
