import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import "../setup";
import { createResizeObserver } from "../../src/hooks/createResizeObserver";

// The globalResizeObserver singleton is created lazily on first call and reused.
// We capture the ResizeObserver callback on the first createResizeObserver call,
// then trigger it directly in each test. rAF is mocked per-test so each test
// controls exactly when the frame fires.

let capturedResizeCallback: ResizeObserverCallback | null = null;
let rafCallbacks: FrameRequestCallback[] = [];
let originalRaf: typeof requestAnimationFrame;
let originalResizeObserver: typeof ResizeObserver;

// Install mocks before the singleton is created (i.e., at module load time).
// These run before any test, so the singleton picks up our MockResizeObserver.
originalRaf = globalThis.requestAnimationFrame;
originalResizeObserver = globalThis.ResizeObserver;

globalThis.ResizeObserver = class MockResizeObserver {
    constructor(cb: ResizeObserverCallback) {
        capturedResizeCallback = cb;
    }
    observe() {}
    unobserve() {}
    disconnect() {}
} as unknown as typeof ResizeObserver;

// Trigger singleton creation so capturedResizeCallback is set.
const _initEl = {} as Element;
createResizeObserver(_initEl, () => {});

describe("createResizeObserver - rAF batching", () => {
    beforeEach(() => {
        rafCallbacks = [];
        globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
            rafCallbacks.push(cb);
            return rafCallbacks.length;
        }) as typeof requestAnimationFrame;
    });

    afterEach(() => {
        globalThis.requestAnimationFrame = originalRaf;
    });

    function flushRaf() {
        const cbs = rafCallbacks.splice(0);
        for (const cb of cbs) cb(0);
    }

    function fireObserver(entries: Partial<ResizeObserverEntry>[]) {
        capturedResizeCallback!(entries as ResizeObserverEntry[], {} as ResizeObserver);
    }

    it("does not invoke callbacks synchronously when ResizeObserver fires", () => {
        const element = {} as Element;
        const callback = mock(() => {});
        const unsub = createResizeObserver(element, callback);

        fireObserver([{ target: element }]);

        expect(callback).not.toHaveBeenCalled();

        flushRaf();

        expect(callback).toHaveBeenCalledTimes(1);
        unsub();
    });

    it("schedules only one rAF for multiple synchronous observer firings", () => {
        const element = {} as Element;
        const callback = mock(() => {});
        const unsub = createResizeObserver(element, callback);

        fireObserver([{ target: element }]);
        fireObserver([{ target: element }]);

        expect(rafCallbacks).toHaveLength(1);

        flushRaf();

        expect(callback).toHaveBeenCalledTimes(2);
        unsub();
    });

    it("processes entries from all firings that arrived before the rAF", () => {
        const el1 = {} as Element;
        const el2 = {} as Element;
        const cb1 = mock(() => {});
        const cb2 = mock(() => {});
        const unsub1 = createResizeObserver(el1, cb1);
        const unsub2 = createResizeObserver(el2, cb2);

        fireObserver([{ target: el1 }, { target: el2 }]);

        flushRaf();

        expect(cb1).toHaveBeenCalledTimes(1);
        expect(cb2).toHaveBeenCalledTimes(1);
        unsub1();
        unsub2();
    });

    it("does not call callbacks for elements that were unsubscribed before rAF fires", () => {
        const element = {} as Element;
        const callback = mock(() => {});
        const unsub = createResizeObserver(element, callback);

        fireObserver([{ target: element }]);
        unsub();
        flushRaf();

        expect(callback).not.toHaveBeenCalled();
    });

    it("allows a new rAF to be scheduled after the previous one fires", () => {
        const element = {} as Element;
        const callback = mock(() => {});
        const unsub = createResizeObserver(element, callback);

        fireObserver([{ target: element }]);
        flushRaf();
        expect(callback).toHaveBeenCalledTimes(1);

        // Second batch after first rAF completes
        fireObserver([{ target: element }]);
        expect(rafCallbacks).toHaveLength(1);
        flushRaf();
        expect(callback).toHaveBeenCalledTimes(2);

        unsub();
    });
});
