import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import "../setup";
import { createResizeObserver } from "../../src/hooks/createResizeObserver";

// The globalResizeObserver singleton is created lazily on first call and reused.
// We capture the ResizeObserver callback on the first createResizeObserver call,
// then trigger it directly in each test. setTimeout is mocked per-test so each test
// controls exactly when the debounced flush fires.

let capturedResizeCallback: ResizeObserverCallback | null = null;
let timerCallbacks: Map<number, () => void> = new Map();
let timerIdCounter = 0;
let originalSetTimeout: typeof setTimeout;
let originalClearTimeout: typeof clearTimeout;
let originalResizeObserver: typeof ResizeObserver;

// Install mocks before the singleton is created (i.e., at module load time).
// These run before any test, so the singleton picks up our MockResizeObserver.
originalSetTimeout = globalThis.setTimeout;
originalClearTimeout = globalThis.clearTimeout;
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

describe("createResizeObserver - debounce batching", () => {
    beforeEach(() => {
        timerCallbacks = new Map();
        timerIdCounter = 0;
        globalThis.setTimeout = ((cb: () => void, _delay: number) => {
            const id = ++timerIdCounter;
            timerCallbacks.set(id, cb);
            return id;
        }) as unknown as typeof setTimeout;
        globalThis.clearTimeout = ((id: number) => {
            timerCallbacks.delete(id);
        }) as unknown as typeof clearTimeout;
    });

    afterEach(() => {
        globalThis.setTimeout = originalSetTimeout;
        globalThis.clearTimeout = originalClearTimeout;
    });

    function flushTimers() {
        const cbs = [...timerCallbacks.values()];
        timerCallbacks.clear();
        for (const cb of cbs) cb();
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

        flushTimers();

        expect(callback).toHaveBeenCalledTimes(1);
        unsub();
    });

    it("schedules only one timer for multiple synchronous observer firings", () => {
        const element = {} as Element;
        const callback = mock(() => {});
        const unsub = createResizeObserver(element, callback);

        fireObserver([{ target: element }]);
        fireObserver([{ target: element }]);

        expect(timerCallbacks.size).toBe(1);

        flushTimers();

        expect(callback).toHaveBeenCalledTimes(2);
        unsub();
    });

    it("processes entries from all firings that arrived before the timer", () => {
        const el1 = {} as Element;
        const el2 = {} as Element;
        const cb1 = mock(() => {});
        const cb2 = mock(() => {});
        const unsub1 = createResizeObserver(el1, cb1);
        const unsub2 = createResizeObserver(el2, cb2);

        fireObserver([{ target: el1 }, { target: el2 }]);

        flushTimers();

        expect(cb1).toHaveBeenCalledTimes(1);
        expect(cb2).toHaveBeenCalledTimes(1);
        unsub1();
        unsub2();
    });

    it("does not call callbacks for elements that were unsubscribed before timer fires", () => {
        const element = {} as Element;
        const callback = mock(() => {});
        const unsub = createResizeObserver(element, callback);

        fireObserver([{ target: element }]);
        unsub();
        flushTimers();

        expect(callback).not.toHaveBeenCalled();
    });

    it("allows a new timer to be scheduled after the previous one fires", () => {
        const element = {} as Element;
        const callback = mock(() => {});
        const unsub = createResizeObserver(element, callback);

        fireObserver([{ target: element }]);
        flushTimers();
        expect(callback).toHaveBeenCalledTimes(1);

        // Second batch after first timer completes
        fireObserver([{ target: element }]);
        expect(timerCallbacks.size).toBe(1);
        flushTimers();
        expect(callback).toHaveBeenCalledTimes(2);

        unsub();
    });
});
