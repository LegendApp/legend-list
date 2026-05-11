import { I18nManager } from "react-native";

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
    if (
        contentWidth === undefined ||
        !Number.isFinite(contentWidth) ||
        !Number.isFinite(state.scrollLength) ||
        contentWidth <= state.scrollLength
    ) {
        return contentWidth !== undefined && Number.isFinite(contentWidth) && Number.isFinite(state.scrollLength)
            ? 0
            : undefined;
    }

    return Math.max(0, contentWidth - state.scrollLength);
}

function getDefaultHorizontalRTLScrollType(): HorizontalRTLScrollType {
    return Platform.OS === "web" ? "normal" : "inverted";
}

function getNativeHorizontalRTLScrollType(
    state: Pick<InternalState, "horizontalRTLScrollType"> | undefined,
): HorizontalRTLScrollType {
    return state?.horizontalRTLScrollType ?? getDefaultHorizontalRTLScrollType();
}

export function isRTLProps(props: RTLPropsLike | undefined): boolean {
    return props?.rtl ?? !!I18nManager.isRTL;
}

export function isRTLList(state: Pick<InternalState, "props"> | undefined): boolean {
    return isRTLProps(state?.props);
}

export function isHorizontalRTL(state: Pick<InternalState, "props"> | undefined): boolean {
    return isHorizontalRTLProps(state?.props);
}

export function isHorizontalRTLProps(props: RTLPropsLike | undefined): boolean {
    return !!props?.horizontal && isRTLProps(props);
}

export function getLogicalHorizontalMaxOffset(
    state: Pick<InternalState, "props" | "scrollLength">,
    contentWidth: number | undefined,
): number {
    return getHorizontalMaxOffset(state, contentWidth) ?? 0;
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
    state: Pick<InternalState, "props"> | undefined,
    logicalPosition: number,
    itemSize: number,
    listSize: number | undefined,
): number {
    if (!isHorizontalRTL(state) || listSize === undefined || !Number.isFinite(listSize)) {
        return logicalPosition;
    }

    return Math.max(0, listSize - logicalPosition - itemSize);
}

export function toNativeHorizontalOffset(
    state: Pick<InternalState, "props" | "horizontalRTLScrollType" | "scrollLength"> | undefined,
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

    if (rawOffset < 0) {
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

    const referenceScroll = state.hasScrolled ? state.scroll : 0;
    const distanceNormal = Math.abs(normalOffset - referenceScroll);
    const distanceInverted = Math.abs(invertedOffset - referenceScroll);
    const useInverted = distanceInverted + 0.5 < distanceNormal;

    state.horizontalRTLScrollType = useInverted ? "inverted" : "normal";
    return clampHorizontalOffset(useInverted ? invertedOffset : normalOffset, maxOffset);
}
