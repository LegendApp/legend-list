import { afterEach, describe, expect, it } from "bun:test";

import "../setup";

import { getLayoutMeasurement, getLayoutRectangle, getScrollContentSize } from "../../src/components/webScrollUtils";

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

        expect(getLayoutMeasurement(element, true, false)).toEqual({
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

        expect(getLayoutRectangle(element, true, false)).toEqual({
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

        expect(getLayoutMeasurement(element, true, true)).toEqual({
            height: 260,
            width: 1280,
        });
        expect(getLayoutRectangle(element, true, true)).toEqual({
            height: 260,
            width: 1280,
            x: 120,
            y: 240,
        });
    });

    it("uses the scroll container size in element-scroll mode", () => {
        const scrollElement = { scrollHeight: 1600, scrollWidth: 900 } as HTMLElement;
        const contentElement = { scrollHeight: 1400, scrollWidth: 860 } as HTMLElement;

        expect(getScrollContentSize(scrollElement, contentElement, false)).toEqual({
            height: 1600,
            width: 900,
        });
    });

    it("uses the content element size in window-scroll mode", () => {
        const scrollElement = { scrollHeight: 1600, scrollWidth: 900 } as HTMLElement;
        const contentElement = { scrollHeight: 2200, scrollWidth: 1200 } as HTMLElement;

        expect(getScrollContentSize(scrollElement, contentElement, true)).toEqual({
            height: 2200,
            width: 1200,
        });
    });
});
