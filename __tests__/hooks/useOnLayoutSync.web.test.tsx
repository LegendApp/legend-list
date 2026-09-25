import "../setup";

import * as React from "react";

import { afterEach, describe, expect, it, mock } from "bun:test";
import { setContainerLayoutBaseline } from "../../src/core/containerLayoutBaseline";
import TestRenderer, { act } from "../helpers/testRenderer";

let resizeObserverCallback: ((entry: ResizeObserverEntry) => void) | undefined;
const originalHTMLElement = globalThis.HTMLElement;

class MockHTMLElement {
    getBoundingClientRect: () => DOMRect;

    constructor(getBoundingClientRect: () => DOMRect) {
        this.getBoundingClientRect = getBoundingClientRect;
    }
}

function createRect(width: number, height: number): DOMRect {
    return {
        bottom: height,
        height,
        left: 0,
        right: width,
        toJSON: () => ({}),
        top: 0,
        width,
        x: 0,
        y: 0,
    };
}

function createEntry(element: HTMLElement, contentHeight: number, borderHeight: number): ResizeObserverEntry {
    return {
        borderBoxSize: [{ blockSize: borderHeight, inlineSize: 320 }],
        contentRect: createRect(320, contentHeight),
        target: element,
    } as ResizeObserverEntry;
}

async function importWebUseOnLayoutSync() {
    mock.module("@/hooks/createResizeObserver", () => ({
        createResizeObserver: (_element: Element, callback: (entry: ResizeObserverEntry) => void) => {
            resizeObserverCallback = callback;
            return () => {};
        },
    }));

    return import("../../src/hooks/useOnLayoutSync.tsx?web-layout-baseline");
}

afterEach(() => {
    resizeObserverCallback = undefined;
    globalThis.HTMLElement = originalHTMLElement;
});

describe("useOnLayoutSync web measurement baseline", () => {
    it("uses the parent measurement without another bounding rect read", async () => {
        globalThis.HTMLElement = MockHTMLElement as unknown as typeof HTMLElement;
        const { useOnLayoutSync } = await importWebUseOnLayoutSync();
        const getBoundingClientRect = mock(() => createRect(320, 180));
        const element = new MockHTMLElement(getBoundingClientRect) as unknown as HTMLElement;
        const onLayoutChange = mock();

        function Probe() {
            const ref = React.useRef(element);
            useOnLayoutSync({ measureInLayoutEffect: false, onLayoutChange, ref });
            return null;
        }

        act(() => {
            TestRenderer.create(<Probe />);
        });

        expect(getBoundingClientRect).not.toHaveBeenCalled();
        expect(onLayoutChange).not.toHaveBeenCalled();

        setContainerLayoutBaseline(element, createRect(320, 180));
        act(() => {
            resizeObserverCallback?.(createEntry(element, 172, 180));
        });

        expect(getBoundingClientRect).not.toHaveBeenCalled();
        expect(onLayoutChange).not.toHaveBeenCalled();

        act(() => {
            resizeObserverCallback?.(createEntry(element, 212, 220));
        });

        expect(onLayoutChange).toHaveBeenCalledTimes(1);
        expect(onLayoutChange).toHaveBeenCalledWith({ height: 220, width: 320, x: 0, y: 0 }, false);
    });

    it("emits the first observer measurement when no parent baseline exists", async () => {
        globalThis.HTMLElement = MockHTMLElement as unknown as typeof HTMLElement;
        const { useOnLayoutSync } = await importWebUseOnLayoutSync();
        const element = new MockHTMLElement(() => createRect(320, 180)) as unknown as HTMLElement;
        const onLayoutChange = mock();

        function Probe() {
            const ref = React.useRef(element);
            useOnLayoutSync({ measureInLayoutEffect: false, onLayoutChange, ref });
            return null;
        }

        act(() => {
            TestRenderer.create(<Probe />);
        });
        act(() => {
            resizeObserverCallback?.(createEntry(element, 172, 180));
        });

        expect(onLayoutChange).toHaveBeenCalledTimes(1);
        expect(onLayoutChange).toHaveBeenCalledWith({ height: 180, width: 320, x: 0, y: 0 }, false);
    });

    it("falls back to the element border box when the observer omits borderBoxSize", async () => {
        globalThis.HTMLElement = MockHTMLElement as unknown as typeof HTMLElement;
        const { useOnLayoutSync } = await importWebUseOnLayoutSync();
        const getBoundingClientRect = mock(() => createRect(320, 180));
        const element = new MockHTMLElement(getBoundingClientRect) as unknown as HTMLElement;
        const onLayoutChange = mock();

        function Probe() {
            const ref = React.useRef(element);
            useOnLayoutSync({ measureInLayoutEffect: false, onLayoutChange, ref });
            return null;
        }

        act(() => {
            TestRenderer.create(<Probe />);
        });
        act(() => {
            resizeObserverCallback?.({ contentRect: createRect(320, 172), target: element } as ResizeObserverEntry);
        });

        expect(getBoundingClientRect).toHaveBeenCalledTimes(1);
        expect(onLayoutChange).toHaveBeenCalledWith({ height: 180, width: 320, x: 0, y: 0 }, false);
    });
});

it("delegates external viewport layout without observing an imperative ref or null owner", async () => {
    const { useOnLayoutSync } = await importWebUseOnLayoutSync();
    const onLayoutChange = mock();
    const onLayoutProp = mock();
    let onLayout: ReturnType<typeof useOnLayoutSync>["onLayout"];
    function Probe() {
        const ref = React.useRef({ getScrollableNode: () => null } as any);
        ({ onLayout } = useOnLayoutSync({ onLayoutChange, onLayoutProp, ref, webExternalScroll: true }));
        return null;
    }
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
        renderer = TestRenderer.create(<Probe />);
    });
    expect(resizeObserverCallback).toBeUndefined();
    const layout = { height: 500, width: 360, x: 20, y: 200 };
    act(() => {
        onLayout?.({ nativeEvent: { layout } } as any);
    });
    expect(onLayoutChange).toHaveBeenCalledWith(layout, false);
    expect(onLayoutProp).toHaveBeenCalledWith({ nativeEvent: { layout } });
    act(() => renderer!.unmount());
});
