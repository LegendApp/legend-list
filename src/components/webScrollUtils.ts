import type { LayoutRectangle } from "@/platform/platform-types";

type ScrollPosition = { x: number; y: number };
type ViewSize = { height: number; width: number };
export type ScrollEventTarget = Window | HTMLElement;
// undefined owns its scroll box; null is an external scroller that has not mounted yet.
export type ExternalScrollTarget = ScrollEventTarget | null | undefined;

export function isWindowTarget(target: ExternalScrollTarget): target is Window {
    return typeof window !== "undefined" && target === window;
}

export function getScrollPosition(target: ExternalScrollTarget): ScrollPosition {
    if (isWindowTarget(target)) {
        return { x: target.scrollX ?? target.pageXOffset ?? 0, y: target.scrollY ?? target.pageYOffset ?? 0 };
    }
    return { x: target?.scrollLeft ?? 0, y: target?.scrollTop ?? 0 };
}

/** Position in the owner's scrollable content, excluding the owner's border. */
export function getElementScrollPosition(element: HTMLElement | null, target: ExternalScrollTarget) {
    const rect = element?.getBoundingClientRect();
    const scroll = getScrollPosition(target);
    const parent = target && !isWindowTarget(target) ? target : null;
    const parentRect = parent?.getBoundingClientRect();
    return {
        left: (rect?.left ?? 0) - (parentRect?.left ?? 0) - (parent?.clientLeft ?? 0) + scroll.x,
        top: (rect?.top ?? 0) - (parentRect?.top ?? 0) - (parent?.clientTop ?? 0) + scroll.y,
    };
}

export function getContentSize(content: HTMLElement | null): ViewSize {
    return { height: content?.scrollHeight ?? 0, width: content?.scrollWidth ?? 0 };
}

export function getScrollContentSize(
    scrollElement: HTMLElement | null,
    contentElement: HTMLElement | null,
    externalTarget: ExternalScrollTarget,
): ViewSize {
    return getContentSize(externalTarget !== undefined ? contentElement : scrollElement);
}

export function getLayoutMeasurement(
    scrollElement: HTMLElement | null,
    externalTarget: ExternalScrollTarget,
    horizontal: boolean,
): ViewSize {
    if (externalTarget !== undefined) {
        const rect = scrollElement?.getBoundingClientRect();
        const viewport = isWindowTarget(externalTarget)
            ? { height: externalTarget.innerHeight, width: externalTarget.innerWidth }
            : { height: externalTarget?.clientHeight ?? 0, width: externalTarget?.clientWidth ?? 0 };
        return {
            height: horizontal ? (rect?.height ?? scrollElement?.clientHeight ?? 0) : viewport.height,
            width: horizontal ? viewport.width : (rect?.width ?? scrollElement?.clientWidth ?? 0),
        };
    }
    return { height: scrollElement?.clientHeight ?? 0, width: scrollElement?.clientWidth ?? 0 };
}

export function clampOffset(offset: number, maxOffset: number): number {
    return Math.max(0, Math.min(offset, maxOffset));
}

export function getMaxOffset(contentSize: ViewSize, layoutMeasurement: ViewSize, horizontal: boolean): number {
    const axis = horizontal ? "width" : "height";
    return Math.max(0, contentSize[axis] - layoutMeasurement[axis]);
}

export function resolveScrollableNode(
    scrollElement: HTMLElement | null,
    externalTarget: ExternalScrollTarget,
): HTMLElement | null {
    if (isWindowTarget(externalTarget)) {
        return (document.scrollingElement || document.documentElement || document.body) as HTMLElement | null;
    }
    return externalTarget === undefined ? scrollElement : externalTarget;
}

export function resolveScrollEventTarget(
    scrollElement: HTMLElement | null,
    externalTarget: ExternalScrollTarget,
): ScrollEventTarget | null {
    return externalTarget === undefined ? scrollElement : externalTarget;
}

export function getLayoutRectangle(
    element: HTMLElement,
    externalTarget: ExternalScrollTarget,
    horizontal: boolean,
): LayoutRectangle {
    if (externalTarget === undefined) {
        const rect = element.getBoundingClientRect();
        return { height: rect.height, width: rect.width, x: rect.left, y: rect.top };
    }
    const { left, top } = getElementScrollPosition(element, externalTarget);
    const { height, width } = getLayoutMeasurement(element, externalTarget, horizontal);
    return { height, width, x: left, y: top };
}

export function resolveExternalScrollOffset({
    clampedOffset,
    horizontal,
    listPos,
    scroll,
}: {
    clampedOffset: number;
    horizontal: boolean;
    listPos: { left: number; top: number };
    scroll: ScrollPosition;
}) {
    return {
        left: horizontal ? listPos.left + clampedOffset : scroll.x,
        top: horizontal ? scroll.y : listPos.top + clampedOffset,
    };
}
