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

    // When the native tree is actually RTL, RN's `doLeftAndRightSwapInRTL` (on by default) rewrites
    // the item's `left` inset to `start`, which Yoga resolves from the right edge — so native layout
    // already mirrors logical positions. Mirroring here as well double-mirrors every item off screen
    // (blank list, #477 / #458). Gate on the global `I18nManager.isRTL`: a per-list `rtl` prop on an
    // otherwise-LTR native tree gets no native swap, so it still needs the JS mirror. Web always keeps
    // the JS mirror since Container forces `direction: ltr` there.
    if (Platform.OS !== "web" && I18nManager.isRTL) {
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

    // Native: the scroll coordinate space is deterministic — iOS/Android Fabric flip contentOffset in
    // both directions with the self-inverse `maxOffset - x`, so JS reads a physical-left-based offset
    // ("inverted"). Pin it instead of the per-frame distance heuristic, which could reclassify
    // "inverted" -> "normal" on a single overscroll-bounce frame (a transient negative rawOffset first
    // pinned "negative", then the next positive frame fell through to the heuristic) and mirror the
    // visible-range math mid-scroll, blanking the whole list. A negative rawOffset is bounce: clamp it,
    // never switch modes.
    if (Platform.OS !== "web") {
        if (maxOffset === undefined) {
            return rawOffset < 0 ? -rawOffset : rawOffset;
        }
        state.horizontalRTLScrollType = "inverted";
        return clampHorizontalOffset(maxOffset - rawOffset, maxOffset);
    }

    // Web: browsers report flow-relative scroll offsets that may be normal or, in an RTL scroll root
    // (inherited dir="rtl" / direction: rtl), negative. Keep the existing adaptive classification.
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

    if (!state.hasScrolled) {
        const defaultMode = getDefaultHorizontalRTLScrollType();
        state.horizontalRTLScrollType = defaultMode;
        return clampHorizontalOffset(defaultMode === "inverted" ? invertedOffset : normalOffset, maxOffset);
    }

    const referenceScroll = state.scroll;
    const distanceNormal = Math.abs(normalOffset - referenceScroll);
    const distanceInverted = Math.abs(invertedOffset - referenceScroll);
    const useInverted = distanceInverted + 0.5 < distanceNormal;

    state.horizontalRTLScrollType = useInverted ? "inverted" : "normal";
    return clampHorizontalOffset(useInverted ? invertedOffset : normalOffset, maxOffset);
}
