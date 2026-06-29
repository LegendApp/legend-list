import { Platform } from "@/platform/Platform";
import { peek$, type StateContext, set$ } from "@/state/state";
import type { Insets } from "@/types.base";
import { requestAdjust } from "@/utils/requestAdjust";
import { updateContentMetricsState } from "./updateContentMetricsState";

const SCROLL_ADJUST_EPSILON = 0.1;

function setContentLengthSignal(ctx: StateContext, signalName: "footerSize" | "headerSize", size: number) {
    const didChange = peek$(ctx, signalName) !== size;

    if (didChange) {
        set$(ctx, signalName, size);
        updateContentMetricsState(ctx);
    }

    return didChange;
}

function shouldAdjustForHeaderSizeChange(ctx: StateContext, previousHeaderSize: number, nextHeaderSize: number) {
    const { didContainersLayout, didFinishInitialScroll, props, scroll, scrollingTo } = ctx.state;
    const sizeDiff = nextHeaderSize - previousHeaderSize;
    const leadingPadding = props.horizontal ? props.stylePaddingLeft : props.stylePaddingTop;
    const previousHeaderEnd = (leadingPadding || 0) + previousHeaderSize;

    return (
        Platform.OS === "web" &&
        props.maintainVisibleContentPosition.size &&
        didContainersLayout &&
        didFinishInitialScroll &&
        !scrollingTo &&
        scroll >= previousHeaderEnd - SCROLL_ADJUST_EPSILON &&
        Math.abs(sizeDiff) > SCROLL_ADJUST_EPSILON
    );
}

export function setHeaderSize(ctx: StateContext, size: number) {
    const { state } = ctx;
    const previousHeaderSize = peek$(ctx, "headerSize") || 0;
    const didChange = previousHeaderSize !== size;
    const hasMeasuredOrEstimatedHeaderBaseline = state.didMeasureHeader || previousHeaderSize > SCROLL_ADJUST_EPSILON;

    if (didChange) {
        set$(ctx, "headerSize", size);
        updateContentMetricsState(ctx);

        // Do not compensate the initial measurement from no known header.
        // If a zero/estimated header was already recorded, this layout change
        // is a real content shift above the viewport and should preserve MVCP.
        if (hasMeasuredOrEstimatedHeaderBaseline && shouldAdjustForHeaderSizeChange(ctx, previousHeaderSize, size)) {
            requestAdjust(ctx, size - previousHeaderSize);
        }
    }

    state.didMeasureHeader = true;
}

export function setFooterSize(ctx: StateContext, size: number) {
    return setContentLengthSignal(ctx, "footerSize", size);
}

function areInsetsEqual(left: Partial<Insets> | null | undefined, right: Partial<Insets> | null | undefined) {
    return (
        (left?.top ?? 0) === (right?.top ?? 0) &&
        (left?.bottom ?? 0) === (right?.bottom ?? 0) &&
        (left?.left ?? 0) === (right?.left ?? 0) &&
        (left?.right ?? 0) === (right?.right ?? 0)
    );
}

export function setContentInsetOverride(ctx: StateContext, inset: Partial<Insets> | null | undefined) {
    const { state } = ctx;
    const previousInset = state.contentInsetOverride;
    const nextInset = inset ?? undefined;
    const didChange = !areInsetsEqual(previousInset, nextInset);
    state.contentInsetOverride = nextInset;

    if (didChange) {
        updateContentMetricsState(ctx);
    }

    return didChange;
}
