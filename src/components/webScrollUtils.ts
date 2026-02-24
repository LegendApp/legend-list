import type { LayoutRectangle } from "@/platform/platform-types";

type ScrollPosition = { x: number; y: number };
type ViewSize = { height: number; width: number };
export type ScrollEventTarget = Window | HTMLElement;

type WindowScrollTargetParams = {
    clampedOffset: number;
    horizontal: boolean;
    listPos: { left: number; top: number };
    scroll: { x: number; y: number };
};

function getDocumentScrollerNode(): HTMLElement | null {
    if (typeof document === "undefined") {
        return null;
    }
    return (document.scrollingElement || document.documentElement || document.body) as HTMLElement | null;
}

export function getWindowScrollPosition(): ScrollPosition {
    if (typeof window === "undefined") {
        return { x: 0, y: 0 };
    }
    return {
        x: window.scrollX ?? window.pageXOffset ?? 0,
        y: window.scrollY ?? window.pageYOffset ?? 0,
    };
}

export function getElementDocumentPosition(element: HTMLElement | null, scroll: ScrollPosition) {
    const rect = element?.getBoundingClientRect();
    return {
        left: (rect?.left ?? 0) + scroll.x,
        top: (rect?.top ?? 0) + scroll.y,
    };
}

export function getContentSize(content: HTMLElement | null): ViewSize {
    return {
        height: content?.scrollHeight ?? 0,
        width: content?.scrollWidth ?? 0,
    };
}

export function getScrollContentSize(
    scrollElement: HTMLElement | null,
    contentElement: HTMLElement | null,
    isWindowScroll: boolean,
): ViewSize {
    return getContentSize(isWindowScroll ? contentElement : scrollElement);
}

export function getLayoutMeasurement(
    scrollElement: HTMLElement | null,
    isWindowScroll: boolean,
    horizontal: boolean,
): ViewSize {
    if (isWindowScroll && typeof window !== "undefined") {
        const rect = scrollElement?.getBoundingClientRect();
        return {
            // In window-scroll mode, use viewport size on the scroll axis.
            height: horizontal
                ? (rect?.height ?? scrollElement?.clientHeight ?? window.innerHeight)
                : window.innerHeight,
            // Keep the cross-axis size list-relative to avoid inflating container measurements.
            width: horizontal ? window.innerWidth : (rect?.width ?? scrollElement?.clientWidth ?? window.innerWidth),
        };
    }
    return {
        height: scrollElement?.clientHeight ?? 0,
        width: scrollElement?.clientWidth ?? 0,
    };
}

export function clampOffset(offset: number, maxOffset: number): number {
    return Math.max(0, Math.min(offset, maxOffset));
}

function getAxisSize(size: ViewSize, horizontal: boolean): number {
    return horizontal ? size.width : size.height;
}

export function getMaxOffset(contentSize: ViewSize, layoutMeasurement: ViewSize, horizontal: boolean): number {
    return Math.max(0, getAxisSize(contentSize, horizontal) - getAxisSize(layoutMeasurement, horizontal));
}

export function resolveScrollableNode(
    scrollElement: HTMLDivElement | null,
    isWindowScroll: boolean,
): HTMLElement | null {
    return isWindowScroll ? getDocumentScrollerNode() || scrollElement : scrollElement;
}

export function resolveScrollEventTarget(
    scrollElement: HTMLDivElement | null,
    isWindowScroll: boolean,
): ScrollEventTarget | null {
    return isWindowScroll && typeof window !== "undefined" ? window : scrollElement;
}

export function getLayoutRectangle(
    element: HTMLElement,
    isWindowScroll: boolean,
    horizontal: boolean,
): LayoutRectangle {
    const rect = element.getBoundingClientRect();
    const scroll = getWindowScrollPosition();
    return {
        height: isWindowScroll && typeof window !== "undefined" && !horizontal ? window.innerHeight : rect.height,
        width: isWindowScroll && typeof window !== "undefined" && horizontal ? window.innerWidth : rect.width,
        x: isWindowScroll ? rect.left + scroll.x : rect.left,
        y: isWindowScroll ? rect.top + scroll.y : rect.top,
    };
}

export function resolveWindowScrollTarget({ clampedOffset, horizontal, listPos, scroll }: WindowScrollTargetParams) {
    return {
        left: horizontal ? listPos.left + clampedOffset : scroll.x,
        top: horizontal ? scroll.y : listPos.top + clampedOffset,
    };
}
