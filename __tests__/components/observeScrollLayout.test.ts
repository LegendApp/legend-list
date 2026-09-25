import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

import "../setup";

import { observeScrollLayout } from "../../src/components/observeScrollLayout";

describe("scroll-owner layout observation", () => {
    const OriginalResizeObserver = globalThis.ResizeObserver;
    const OriginalMutationObserver = globalThis.MutationObserver;
    const sizes = new Set<Element>();
    const children = new Set<Node>();
    let resized: () => void;
    let mutated: () => void;

    beforeEach(() => {
        sizes.clear();
        children.clear();
        globalThis.ResizeObserver = class {
            constructor(callback: () => void) {
                resized = callback;
            }
            observe(element: Element) {
                sizes.add(element);
            }
            disconnect() {
                sizes.clear();
            }
            unobserve(element: Element) {
                sizes.delete(element);
            }
        } as typeof ResizeObserver;
        globalThis.MutationObserver = class {
            constructor(callback: () => void) {
                mutated = callback;
            }
            observe(node: Node, options: MutationObserverInit) {
                expect(options).toEqual({ childList: true });
                children.add(node);
            }
            disconnect() {
                children.clear();
            }
            takeRecords() {
                return [];
            }
        } as typeof MutationObserver;
    });

    afterEach(() => {
        globalThis.ResizeObserver = OriginalResizeObserver;
        globalThis.MutationObserver = OriginalMutationObserver;
    });

    it("tracks inserted and removed preceding sections without observing row contents", () => {
        const owner = { parentElement: null } as HTMLElement;
        const column = { parentElement: owner } as HTMLElement;
        const list = { parentElement: column, previousElementSibling: null } as HTMLElement;
        const onLayout = mock();
        const dispose = observeScrollLayout(list, owner, onLayout);
        expect(sizes).toEqual(new Set([list, column, owner]));
        expect(children).toEqual(new Set([column, owner]));

        const header = { parentElement: column, previousElementSibling: null } as HTMLElement;
        Object.assign(list, { previousElementSibling: header });
        mutated();
        expect(sizes.has(header)).toBe(true);
        expect(onLayout).toHaveBeenCalledTimes(2);
        resized();
        expect(onLayout).toHaveBeenCalledTimes(3);

        Object.assign(list, { previousElementSibling: null });
        mutated();
        expect(sizes.has(header)).toBe(false);
        expect(children.has(list)).toBe(false);
        dispose?.();
        expect(sizes.size).toBe(0);
        expect(children.size).toBe(0);
    });

    it("only measures the list when it owns the scrollbar, and waits for a null owner", () => {
        const list = { parentElement: {} } as HTMLElement;
        const onLayout = mock();
        expect(observeScrollLayout(list, null, onLayout)).toBeUndefined();
        expect(onLayout).not.toHaveBeenCalled();
        expect(sizes.size).toBe(0);
        const dispose = observeScrollLayout(list, undefined, onLayout);
        expect(sizes).toEqual(new Set([list]));
        expect(children.size).toBe(0);
        expect(onLayout).toHaveBeenCalledTimes(1);
        dispose?.();
    });

    it("uses the same layout tracking for window scrolling and cleans up its resize listener", () => {
        const originalWindow = globalThis.window;
        const add = mock();
        const remove = mock();
        globalThis.window = { addEventListener: add, removeEventListener: remove } as unknown as Window &
            typeof globalThis;
        const header = { previousElementSibling: null } as HTMLElement;
        const root = { parentElement: null } as HTMLElement;
        const list = { parentElement: root, previousElementSibling: header } as HTMLElement;
        const onLayout = mock();
        try {
            const dispose = observeScrollLayout(list, window, onLayout);
            expect(sizes.has(header)).toBe(true);
            expect(add).toHaveBeenCalledWith("resize", onLayout);
            dispose?.();
            expect(remove).toHaveBeenCalledWith("resize", onLayout);
            expect(sizes.size).toBe(0);
            expect(children.size).toBe(0);
        } finally {
            globalThis.window = originalWindow;
        }
    });
});
