import { afterEach, describe, expect, it } from "bun:test";

import "../setup";

import {
    getElementScrollPosition,
    getLayoutMeasurement,
    getLayoutRectangle,
    getScrollContentSize,
    getScrollPosition,
    resolveExternalScrollOffset,
    resolveScrollableNode,
    resolveScrollEventTarget,
} from "../../src/components/webScrollUtils";

describe("webScrollUtils", () => {
    const originalWindowValues = {
        innerHeight: (window as any).innerHeight,
        innerWidth: (window as any).innerWidth,
        pageXOffset: (window as any).pageXOffset,
        pageYOffset: (window as any).pageYOffset,
        scrollX: (window as any).scrollX,
        scrollY: (window as any).scrollY,
    };

    afterEach(() => {
        Object.assign(window as any, originalWindowValues);
    });

    it("uses element width for layout measurement in window scroll mode", () => {
        Object.assign(window as any, { innerHeight: 900, innerWidth: 1400 });
        const element = {
            clientHeight: 220,
            clientWidth: 360,
            getBoundingClientRect: () => ({ height: 220, width: 360 }),
        } as HTMLElement;

        expect(getLayoutMeasurement(element, window, false)).toEqual({
            height: 900,
            width: 360,
        });
    });

    it("uses element width for layout rectangle in window scroll mode", () => {
        Object.assign(window as any, {
            innerHeight: 800,
            innerWidth: 1280,
            pageXOffset: 20,
            pageYOffset: 40,
            scrollX: 20,
            scrollY: 40,
        });
        const element = {
            getBoundingClientRect: () => ({ height: 500, left: 100, top: 200, width: 420 }),
        } as HTMLElement;

        expect(getLayoutRectangle(element, window, false)).toEqual({
            height: 800,
            width: 420,
            x: 120,
            y: 240,
        });
    });

    it("uses viewport width and element height in horizontal window scroll mode", () => {
        Object.assign(window as any, {
            innerHeight: 800,
            innerWidth: 1280,
            pageXOffset: 20,
            pageYOffset: 40,
            scrollX: 20,
            scrollY: 40,
        });
        const element = {
            clientHeight: 260,
            clientWidth: 420,
            getBoundingClientRect: () => ({ height: 260, left: 100, top: 200, width: 420 }),
        } as HTMLElement;

        expect(getLayoutMeasurement(element, window, true)).toEqual({
            height: 260,
            width: 1280,
        });
        expect(getLayoutRectangle(element, window, true)).toEqual({
            height: 260,
            width: 1280,
            x: 120,
            y: 240,
        });
    });

    it("uses the scroll container size in element-scroll mode", () => {
        const scrollElement = { scrollHeight: 1600, scrollWidth: 900 } as HTMLElement;
        const contentElement = { scrollHeight: 1400, scrollWidth: 860 } as HTMLElement;

        expect(getScrollContentSize(scrollElement, contentElement, undefined)).toEqual({
            height: 1600,
            width: 900,
        });
    });

    it("uses the content element size in window-scroll mode", () => {
        const scrollElement = { scrollHeight: 1600, scrollWidth: 900 } as HTMLElement;
        const contentElement = { scrollHeight: 2200, scrollWidth: 1200 } as HTMLElement;

        expect(getScrollContentSize(scrollElement, contentElement, window)).toEqual({
            height: 2200,
            width: 1200,
        });
    });
});

describe("external scroll geometry", () => {
    const parent = {
        clientHeight: 500,
        clientLeft: 2,
        clientTop: 3,
        clientWidth: 900,
        getBoundingClientRect: () => ({ left: 20, top: 100 }),
        scrollLeft: 60,
        scrollTop: 500,
    } as HTMLElement;
    const first = {
        getBoundingClientRect: () => ({ height: 2000, left: 42, top: -197, width: 400 }),
    } as HTMLElement;

    it("measures a bordered owner's viewport while retaining the list's column width", () => {
        expect(getLayoutMeasurement(first, parent, false)).toEqual({ height: 500, width: 400 });
        expect(getLayoutMeasurement(first, parent, true)).toEqual({ height: 2000, width: 900 });
        expect(getLayoutRectangle(first, parent, false)).toEqual({ height: 500, width: 400, x: 80, y: 200 });
    });

    it("converts list-local targets to parent coordinates and preserves cross-axis scrolling", () => {
        const listPos = getElementScrollPosition(first, parent);
        const scroll = getScrollPosition(parent);
        expect(resolveExternalScrollOffset({ clampedOffset: 750, horizontal: false, listPos, scroll })).toEqual({
            left: 60,
            top: 950,
        });
        expect(resolveExternalScrollOffset({ clampedOffset: 750, horizontal: true, listPos, scroll })).toEqual({
            left: 830,
            top: 500,
        });
    });

    it("uses a separate origin for each list sharing the same parent", () => {
        const second = { getBoundingClientRect: () => ({ left: 42, top: 2023 }) } as HTMLElement;
        expect(getElementScrollPosition(second, parent).top).toBe(2420);
        expect(getElementScrollPosition(first, parent).top).toBe(200);
    });

    it("remeasures position when preceding content grows without a scroll event", () => {
        const moved = { getBoundingClientRect: () => ({ left: 42, top: -97 }) } as HTMLElement;
        expect(getElementScrollPosition(moved, parent).top).toBe(300);
    });

    it("waits for a null external owner without falling back to a nested scrollbar", () => {
        expect(resolveScrollEventTarget(first, null)).toBeNull();
        expect(resolveScrollableNode(first, null)).toBeNull();
        expect(getLayoutMeasurement(first, null, false).height).toBe(0);
        expect(resolveScrollEventTarget(first, undefined)).toBe(first);
        expect(resolveScrollEventTarget(first, parent)).toBe(parent);
        expect(resolveScrollEventTarget(first, window)).toBe(window);
    });
});
