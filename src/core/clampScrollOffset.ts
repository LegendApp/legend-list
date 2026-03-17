import { logInitialScrollTrace } from "@/core/logInitialScrollTrace";
import { Platform } from "@/platform/Platform";
import { getContentInsetEnd } from "@/state/getContentInsetEnd";
import { getContentSize } from "@/state/getContentSize";
import type { StateContext } from "@/state/state";
import type { ScrollTarget } from "@/types.base";

function shouldExtendLogicalMaxForInitialEndTarget(
    state: StateContext["state"],
    scrollTarget: Partial<ScrollTarget> | undefined,
) {
    if (!scrollTarget?.isInitialScroll) {
        return false;
    }

    const { index, viewPosition } = scrollTarget;
    return index !== undefined && index === state.props.data.length - 1 && (viewPosition ?? 0) > 0;
}

export function clampScrollOffset(ctx: StateContext, offset: number, scrollTarget?: Partial<ScrollTarget>) {
    const state = ctx.state;
    const contentSize = getContentSize(ctx);
    const stylePaddingTop = ctx.values.get("stylePaddingTop") || 0;
    const stylePaddingBottom = state.props.stylePaddingBottom || 0;
    const headerSize = ctx.values.get("headerSize") || 0;
    const footerSize = ctx.values.get("footerSize") || 0;
    const contentInsetBottom = getContentInsetEnd(state) || 0;
    const valuesTotalSize = ctx.values.get("totalSize");
    const pendingTotalSize = state.pendingTotalSize;
    const effectiveTotalSize = pendingTotalSize ?? valuesTotalSize;
    let clampedOffset = offset;
    let baseMaxOffset: number | undefined;
    let extraEndOffset = 0;
    let logicalMaxExtension = 0;
    let maxOffset: number | undefined;
    if (
        Number.isFinite(contentSize) &&
        Number.isFinite(state.scrollLength) &&
        (Platform.OS !== "android" || state.lastLayout)
    ) {
        baseMaxOffset = Math.max(0, contentSize - state.scrollLength);
        const viewOffset = scrollTarget?.viewOffset;
        extraEndOffset = typeof viewOffset === "number" && viewOffset < 0 ? -viewOffset : 0;
        const scrollAdjust = state.scrollAdjustHandler.getAdjust();
        logicalMaxExtension =
            shouldExtendLogicalMaxForInitialEndTarget(state, scrollTarget) && scrollAdjust < 0 ? -scrollAdjust : 0;
        maxOffset = baseMaxOffset + extraEndOffset + logicalMaxExtension;
        clampedOffset = Math.min(offset, maxOffset);
    }
    clampedOffset = Math.max(0, clampedOffset);
    logInitialScrollTrace(ctx, "clampScrollOffset", {
        baseMaxOffset,
        clampedOffset,
        contentSize,
        contentSizeFooter: footerSize,
        contentSizeHeader: headerSize,
        contentSizeInsetEnd: contentInsetBottom,
        contentSizePaddingBottom: stylePaddingBottom,
        contentSizePaddingTop: stylePaddingTop,
        contentSizePendingTotal: pendingTotalSize,
        contentSizeTotal: effectiveTotalSize,
        contentSizeValuesTotal: valuesTotalSize,
        extraEndOffset,
        inputOffset: offset,
        logicalMaxExtension,
        maxOffset,
        scrollAdjust: state.scrollAdjustHandler.getAdjust(),
        targetIndex: scrollTarget?.index,
        targetViewOffset: scrollTarget?.viewOffset,
        targetViewPosition: scrollTarget?.viewPosition,
    });
    return clampedOffset;
}
