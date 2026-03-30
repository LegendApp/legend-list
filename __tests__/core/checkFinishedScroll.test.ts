import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import "../setup";

import { checkFinishedScroll, checkFinishedScrollFallback } from "../../src/core/checkFinishedScroll";
import { Platform } from "../../src/platform/Platform";
import { createMockContext } from "../__mocks__/createMockContext";

describe("checkFinishedScrollFallback", () => {
    let originalPlatform: typeof Platform.OS;
    let originalSetTimeout: typeof globalThis.setTimeout;
    let originalClearTimeout: typeof globalThis.clearTimeout;
    let queue: Array<() => void>;

    const flushTimers = (count: number) => {
        for (let i = 0; i < count; i++) {
            const cb = queue.shift();
            if (!cb) {
                return;
            }
            cb();
        }
    };

    beforeEach(() => {
        originalPlatform = Platform.OS;
        originalSetTimeout = globalThis.setTimeout;
        originalClearTimeout = globalThis.clearTimeout;
        queue = [];

        globalThis.setTimeout = ((callback: TimerHandler) => {
            queue.push(callback as () => void);
            return queue.length as unknown as ReturnType<typeof setTimeout>;
        }) as typeof globalThis.setTimeout;
        globalThis.clearTimeout = (() => undefined) as typeof globalThis.clearTimeout;
    });

    afterEach(() => {
        Platform.OS = originalPlatform;
        globalThis.setTimeout = originalSetTimeout;
        globalThis.clearTimeout = originalClearTimeout;
    });

    it("waits longer on native initial non-zero scroll when no native scroll event is observed on Android", () => {
        Platform.OS = "android";
        const ctx = createMockContext(
            {},
            {
                hasScrolled: false,
                initialNativeScrollWatchdog: {
                    targetOffset: 220,
                },
                scrollingTo: {
                    animated: false,
                    index: 99,
                    isInitialScroll: true,
                    offset: 220,
                    viewOffset: 0,
                } as any,
                scrollPending: 220,
            },
        );

        checkFinishedScrollFallback(ctx);

        flushTimers(8);
        expect(ctx.state.scrollingTo).not.toBeUndefined();

        flushTimers(20);
        expect(ctx.state.scrollingTo).toBeUndefined();
    });

    it("waits longer on native initial non-zero scroll when no native scroll event is observed on iOS", () => {
        Platform.OS = "ios";
        const ctx = createMockContext(
            {},
            {
                hasScrolled: false,
                initialNativeScrollWatchdog: {
                    targetOffset: 220,
                },
                scrollingTo: {
                    animated: false,
                    index: 99,
                    isInitialScroll: true,
                    offset: 220,
                    viewOffset: 0,
                } as any,
                scrollPending: 220,
            },
        );

        checkFinishedScrollFallback(ctx);

        flushTimers(8);
        expect(ctx.state.scrollingTo).not.toBeUndefined();

        flushTimers(20);
        expect(ctx.state.scrollingTo).toBeUndefined();
    });

    it("keeps default fallback timing for non-initial scrolls", () => {
        Platform.OS = "android";
        const ctx = createMockContext(
            {},
            {
                hasScrolled: false,
                scrollingTo: {
                    animated: false,
                    index: 99,
                    isInitialScroll: false,
                    offset: 220,
                    viewOffset: 0,
                } as any,
                scrollPending: 220,
            },
        );

        checkFinishedScrollFallback(ctx);

        flushTimers(8);
        expect(ctx.state.scrollingTo).toBeUndefined();
    });

    it("reissues native scrollTo while an initial non-zero target is still pending", () => {
        Platform.OS = "android";
        const scrollToCalls: Array<{ animated: boolean; x: number; y: number }> = [];
        const ctx = createMockContext(
            {},
            {
                hasScrolled: false,
                initialNativeScrollWatchdog: {
                    targetOffset: 220,
                } as any,
                refScroller: {
                    current: {
                        scrollTo: (params: { animated: boolean; x: number; y: number }) => scrollToCalls.push(params),
                    },
                } as any,
                scrollingTo: {
                    animated: false,
                    index: 99,
                    isInitialScroll: true,
                    offset: 220,
                    viewOffset: 0,
                } as any,
                scrollPending: 220,
            },
        );

        checkFinishedScrollFallback(ctx);

        flushTimers(1);
        expect(scrollToCalls).toEqual([{ animated: false, x: 0, y: 220 }]);

        flushTimers(1);
        expect(scrollToCalls).toEqual([
            { animated: false, x: 0, y: 220 },
            { animated: false, x: 0, y: 220 },
        ]);
    });

    it("finishes immediately when the active initial target is zero and content fits the viewport", () => {
        Platform.OS = "android";
        const scrollToCalls: Array<{ animated: boolean; x: number; y: number }> = [];
        const ctx = createMockContext(
            { totalSize: 100 },
            {
                hasScrolled: false,
                initialNativeScrollWatchdog: {
                    targetOffset: 36,
                } as any,
                props: {
                    data: [{ id: "item-1" }],
                } as any,
                refScroller: {
                    current: {
                        scrollTo: (params: { animated: boolean; x: number; y: number }) => scrollToCalls.push(params),
                    },
                } as any,
                scrollingTo: {
                    animated: false,
                    index: 1,
                    isInitialScroll: true,
                    offset: 0,
                    targetOffset: 0,
                    viewOffset: 0,
                } as any,
                scrollLength: 614.67,
                scrollPending: 0,
            },
        );

        checkFinishedScrollFallback(ctx);

        flushTimers(1);
        expect(scrollToCalls).toEqual([]);
        expect(ctx.state.scrollingTo).toBeUndefined();
        expect(ctx.state.didFinishInitialScroll).toBe(true);
    });

    it("keeps zero-target initial scroll pending when data has not arrived yet", () => {
        Platform.OS = "android";
        const scrollToCalls: Array<{ animated: boolean; x: number; y: number }> = [];
        const ctx = createMockContext(
            { totalSize: 0 },
            {
                hasScrolled: false,
                initialNativeScrollWatchdog: {
                    targetOffset: 36,
                } as any,
                props: {
                    data: [],
                } as any,
                refScroller: {
                    current: {
                        scrollTo: (params: { animated: boolean; x: number; y: number }) => scrollToCalls.push(params),
                    },
                } as any,
                scrollingTo: {
                    animated: false,
                    index: 1,
                    isInitialScroll: true,
                    offset: 0,
                    targetOffset: 0,
                    viewOffset: 0,
                } as any,
                scrollLength: 614.67,
                scrollPending: 0,
            },
        );

        checkFinishedScrollFallback(ctx);

        flushTimers(1);
        expect(scrollToCalls).toEqual([{ animated: false, x: 0, y: 36 }]);
        expect(ctx.state.scrollingTo).toBeDefined();
        expect(ctx.state.didFinishInitialScroll).toBeUndefined();
    });

    it("finishes non-animated initial scroll when the target is already satisfied after layout without deferred positions", () => {
        Platform.OS = "android";
        const ctx = createMockContext(
            { totalSize: 4000 },
            {
                deferredPositions: undefined,
                didContainersLayout: true,
                hasScrolled: false,
                initialNativeScrollWatchdog: {
                    startScroll: 0,
                    targetOffset: 220,
                } as any,
                props: {
                    data: Array.from({ length: 10 }, (_, index) => ({ id: `item-${index}` })),
                } as any,
                scroll: 220,
                scrollingTo: {
                    animated: false,
                    index: 3,
                    isInitialScroll: true,
                    offset: 220,
                    targetOffset: 220,
                    viewOffset: 0,
                } as any,
                scrollLength: 300,
                scrollPending: 220,
            },
        );

        checkFinishedScrollFallback(ctx);

        flushTimers(1);
        expect(ctx.state.scrollingTo).toBeUndefined();
        expect(ctx.state.didFinishInitialScroll).toBe(true);
    });

    it("keeps non-animated initial scroll pending until layout completes even if state.scroll matches the target", () => {
        Platform.OS = "android";
        const ctx = createMockContext(
            { totalSize: 4000 },
            {
                deferredPositions: undefined,
                didContainersLayout: false,
                hasScrolled: false,
                initialNativeScrollWatchdog: {
                    startScroll: 0,
                    targetOffset: 220,
                } as any,
                props: {
                    data: Array.from({ length: 10 }, (_, index) => ({ id: `item-${index}` })),
                } as any,
                scroll: 220,
                scrollingTo: {
                    animated: false,
                    index: 3,
                    isInitialScroll: true,
                    offset: 220,
                    targetOffset: 220,
                    viewOffset: 0,
                } as any,
                scrollLength: 300,
                scrollPending: 220,
            },
        );

        checkFinishedScrollFallback(ctx);

        flushTimers(1);
        expect(ctx.state.scrollingTo).toBeDefined();
        expect(ctx.state.didFinishInitialScroll).toBeUndefined();
    });
});

describe("checkFinishedScroll", () => {
    let originalRequestAnimationFrame: typeof globalThis.requestAnimationFrame;
    let pendingFrame: FrameRequestCallback | undefined;

    beforeEach(() => {
        originalRequestAnimationFrame = globalThis.requestAnimationFrame;
        pendingFrame = undefined;
        globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
            pendingFrame = callback;
            return 1;
        }) as typeof globalThis.requestAnimationFrame;
    });

    afterEach(() => {
        globalThis.requestAnimationFrame = originalRequestAnimationFrame;
    });

    it("finishes when the scroll reaches the resolved end clamp target", () => {
        const ctx = createMockContext(
            { totalSize: 40731.25 },
            {
                didContainersLayout: true,
                scroll: 39879.333333333336,
                scrollingTo: {
                    animated: false,
                    index: 99,
                    isInitialScroll: true,
                    offset: 39856.25,
                    targetOffset: 39879.25,
                    viewOffset: 0,
                    viewPosition: 1,
                } as any,
                scrollLength: 852,
                scrollPending: 39879.333333333336,
            },
        );

        checkFinishedScroll(ctx);
        pendingFrame?.(0);

        expect(ctx.state.scrollingTo).toBeUndefined();
        expect(ctx.state.didFinishInitialScroll).toBe(true);
    });
});
