import { I18nManager } from "@/platform/I18nManager";
import { Platform } from "@/platform/Platform";
import type { InternalState } from "@/types.internal";

export type HorizontalRTLScrollType = "normal" | "inverted" | "negative";

type InsetsLike = {
    left?: number;
    right?: number;
};

type RTLPropsLike = {
    horizontal?: boolean;
    rtl?: boolean;
};

type StylePaddingPropsLike = RTLPropsLike & {
    stylePaddingBottom?: number;
    stylePaddingLeft?: number;
    stylePaddingRight?: number;
};

function clampHorizontalOffset(offset: number, maxOffset: number | undefined): number {
    if (maxOffset === undefined) {
        return offset;
    }
    return Math.max(0, Math.min(maxOffset, offset));
}

function getHorizontalMaxOffset(
    state: Pick<InternalState, "scrollLength">,
    contentWidth: number | undefined,
): number | undefined {
    if (contentWidth === undefined || !Number.isFinite(contentWidth) || !Number.isFinite(state.scrollLength)) {
        return undefined;
    }

    return Math.max(0, contentWidth - state.scrollLength);
}

const webScrollTypes = new WeakMap<HTMLElement, HorizontalRTLScrollType>();

type HorizontalRTLState = Pick<InternalState, "horizontalRTLScrollType"> & Partial<Pick<InternalState, "refScroller">>;

export function getNativeHorizontalRTLScrollType(state: HorizontalRTLState | undefined): HorizontalRTLScrollType {
    if (Platform.OS === "web") {
        const owner = state?.refScroller?.current?.getScrollableNode?.() as HTMLElement | null | undefined;
        // External and window owners can remain LTR even when the list renders RTL.
        if (owner && typeof getComputedStyle === "function") {
            let mode = webScrollTypes.get(owner);
            if (!mode) {
                mode = getComputedStyle(owner).direction === "ltr" ? "normal" : "negative";
                webScrollTypes.set(owner, mode);
            }
            return mode;
        }
    }
    return state?.horizontalRTLScrollType ?? (Platform.OS === "web" ? "negative" : "inverted");
}

export function invalidateHorizontalRTLScrollType(state: Pick<InternalState, "props"> & HorizontalRTLState) {
    if (Platform.OS === "web" && isHorizontalRTL(state)) {
        const owner = state.refScroller?.current?.getScrollableNode?.() as HTMLElement | null | undefined;
        if (owner) webScrollTypes.delete(owner);
    }
}

export function isHorizontalRTL(state: Pick<InternalState, "props"> | undefined): boolean {
    return isHorizontalRTLProps(state?.props);
}

export function isHorizontalRTLProps(props: RTLPropsLike | undefined): boolean {
    return !!props?.horizontal && (props.rtl ?? !!I18nManager.isRTL);
}

export function getStylePaddingEnd(props: StylePaddingPropsLike | undefined): number {
    if (!props?.horizontal) {
        return props?.stylePaddingBottom || 0;
    }
    return (isHorizontalRTLProps(props) ? props.stylePaddingLeft : props.stylePaddingRight) || 0;
}

export function getHorizontalInsetEnd(
    state: Pick<InternalState, "props"> | undefined,
    inset: InsetsLike | undefined,
): number {
    if (!inset) {
        return 0;
    }
    return (isHorizontalRTL(state) ? inset.left : inset.right) || 0;
}

export function toPhysicalHorizontalItemPosition(
    state: (Pick<InternalState, "props"> & HorizontalRTLState) | undefined,
    logicalPosition: number,
    itemSize: number,
    listSize: number | undefined,
): number {
    if (!isHorizontalRTL(state) || listSize === undefined || !Number.isFinite(listSize)) {
        return logicalPosition;
    }

    // LTR owners scroll in physical item order, including for RTL list content.
    if (Platform.OS === "web" && getNativeHorizontalRTLScrollType(state) === "normal") return logicalPosition;
    return Math.max(0, listSize - logicalPosition - itemSize);
}

export function toNativeHorizontalOffset(
    state: (Pick<InternalState, "props" | "scrollLength"> & HorizontalRTLState) | undefined,
    logicalOffset: number,
    contentWidth: number | undefined,
): number {
    if (!state || !isHorizontalRTL(state)) {
        return logicalOffset;
    }

    const maxOffset = getHorizontalMaxOffset(state, contentWidth);
    const clampedLogicalOffset = clampHorizontalOffset(logicalOffset, maxOffset);
    const mode = getNativeHorizontalRTLScrollType(state);

    if (mode === "negative") {
        return clampedLogicalOffset === 0 ? 0 : -clampedLogicalOffset;
    }
    if (mode === "inverted") {
        if (maxOffset === undefined) {
            return clampedLogicalOffset;
        }
        return clampHorizontalOffset(maxOffset - clampedLogicalOffset, maxOffset);
    }

    return clampedLogicalOffset;
}

/** Converts an observed DOM offset using the scroll owner's RTL convention without changing state. */
export function peekLogicalHorizontalOffset(
    state: Pick<InternalState, "props"> & HorizontalRTLState,
    rawOffset: number,
    maxOffset: number | undefined,
): number {
    if (!isHorizontalRTL(state)) {
        return rawOffset;
    }
    let mode = getNativeHorizontalRTLScrollType(state);
    if (rawOffset < 0 && (Platform.OS !== "web" || mode !== "normal")) {
        mode = "negative";
    }
    if (mode === "negative") {
        return clampHorizontalOffset(-rawOffset, maxOffset);
    }
    if (mode === "inverted" && maxOffset !== undefined) {
        return clampHorizontalOffset(maxOffset - rawOffset, maxOffset);
    }
    return clampHorizontalOffset(rawOffset, maxOffset);
}

export function toLogicalHorizontalOffset(
    state: InternalState,
    rawOffset: number,
    contentWidth: number | undefined,
): number {
    if (!isHorizontalRTL(state)) {
        state.horizontalRTLScrollType = undefined;
        return rawOffset;
    }

    const maxOffset = getHorizontalMaxOffset(state, contentWidth);

    const mode = getNativeHorizontalRTLScrollType(state);
    if (Platform.OS === "web" && mode === "normal") {
        state.horizontalRTLScrollType = "normal";
        return clampHorizontalOffset(rawOffset, maxOffset);
    }

    if (rawOffset < 0 || mode === "negative") {
        state.horizontalRTLScrollType = "negative";
        return clampHorizontalOffset(-rawOffset, maxOffset);
    }

    if (maxOffset === undefined) {
        return rawOffset;
    }

    const normalOffset = rawOffset;
    const invertedOffset = maxOffset - rawOffset;
    if (!Number.isFinite(invertedOffset)) {
        state.horizontalRTLScrollType = "normal";
        return normalOffset;
    }

    const previousMode = state.horizontalRTLScrollType;
    if (previousMode === "inverted") {
        return clampHorizontalOffset(invertedOffset, maxOffset);
    }
    if (previousMode === "normal") {
        return clampHorizontalOffset(normalOffset, maxOffset);
    }

    if (!state.hasScrolled) {
        // Web owners and the negative convention return above, leaving the native default.
        state.horizontalRTLScrollType = "inverted";
        return clampHorizontalOffset(invertedOffset, maxOffset);
    }

    const referenceScroll = state.scroll;
    const distanceNormal = Math.abs(normalOffset - referenceScroll);
    const distanceInverted = Math.abs(invertedOffset - referenceScroll);
    const useInverted = distanceInverted + 0.5 < distanceNormal;

    state.horizontalRTLScrollType = useInverted ? "inverted" : "normal";
    return clampHorizontalOffset(useInverted ? invertedOffset : normalOffset, maxOffset);
}
