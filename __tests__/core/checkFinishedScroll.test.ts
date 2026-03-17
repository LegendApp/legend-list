import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import "../setup";

import {
    checkFinishedScroll,
    checkFinishedScrollFallback,
} from "../../src/core/checkFinishedScroll?check-finished-scroll-test";
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

    it("keeps retrying an initial scroll fallback when movement occurred but the scroll is still short of target", () => {
        Platform.OS = "android";
        const scrollToCalls: Array<{ animated: boolean; x: number; y: number }> = [];
        const ctx = createMockContext(
            { totalSize: 40434.375 },
            {
                didContainersLayout: true,
                hasScrolled: true,
                initialNativeScrollWatchdog: {
                    startScroll: 39496.66796875,
                    targetOffset: 39627.375,
                } as any,
                props: {
                    data: Array.from({ length: 100 }, (_value, index) => ({ id: index })),
                } as any,
                refScroller: {
                    current: {
                        scrollTo: (params: { animated: boolean; x: number; y: number }) => scrollToCalls.push(params),
                    },
                } as any,
                scroll: 39573.33203125,
                scrollAdjustHandler: {
                    getAdjust: () => -54.5,
                    requestAdjust: () => {},
                    setMounted: () => {},
                } as any,
                scrollingTo: {
                    animated: false,
                    index: 99,
                    isInitialScroll: true,
                    offset: 39576.75,
                    targetOffset: 39627.375,
                    viewOffset: 0,
                    viewPosition: 1,
                } as any,
                scrollLength: 780,
                scrollPending: 39573.33203125,
            },
        );

        checkFinishedScrollFallback(ctx);

        flushTimers(1);
        expect(scrollToCalls).toEqual([{ animated: false, x: 0, y: 39627.375 }]);
        expect(ctx.state.scrollingTo).toBeDefined();
        expect(ctx.state.didFinishInitialScroll).toBeUndefined();
    });

    it("does not finish an initial scroll fallback just because movement occurred while still short of target", () => {
        Platform.OS = "android";
        const ctx = createMockContext(
            { totalSize: 40434.375 },
            {
                didContainersLayout: true,
                hasScrolled: true,
                props: {
                    data: Array.from({ length: 100 }, (_value, index) => ({ id: index })),
                } as any,
                scroll: 39573.33203125,
                scrollAdjustHandler: {
                    getAdjust: () => -54.5,
                    requestAdjust: () => {},
                    setMounted: () => {},
                } as any,
                scrollingTo: {
                    animated: false,
                    index: 99,
                    isInitialScroll: true,
                    offset: 39576.75,
                    targetOffset: 39627.375,
                    viewOffset: 0,
                    viewPosition: 1,
                } as any,
                scrollLength: 780,
                scrollPending: 39573.33203125,
            },
        );

        checkFinishedScrollFallback(ctx);

        flushTimers(1);
        expect(ctx.state.scrollingTo).toBeDefined();
        expect(ctx.state.didFinishInitialScroll).toBeUndefined();
    });

    it("retries the logical initial target instead of finishing at a temporary queued-layout clamp", () => {
        Platform.OS = "android";
        const scrollToCalls: Array<{ animated: boolean; x: number; y: number }> = [];
        const ctx = createMockContext(
            { totalSize: 40407.375 },
            {
                didContainersLayout: true,
                hasScrolled: false,
                initialNativeScrollWatchdog: {
                    startScroll: 0,
                    targetOffset: 39708.875,
                } as any,
                props: {
                    data: Array.from({ length: 100 }, (_value, index) => ({ id: index })),
                } as any,
                queuedInitialLayout: true,
                refScroller: {
                    current: {
                        scrollTo: (params: { animated: boolean; x: number; y: number }) => scrollToCalls.push(params),
                    },
                } as any,
                scroll: 39627.375,
                scrollingTo: {
                    animated: false,
                    index: 99,
                    isInitialScroll: true,
                    logicalTargetOffset: 39708.875,
                    offset: 39708.875,
                    precomputedWithViewOffset: true,
                    targetOffset: 39627.375,
                } as any,
                scrollLength: 780,
                scrollPending: 39627.375,
            },
        );

        checkFinishedScrollFallback(ctx);

        flushTimers(1);
        expect(scrollToCalls).toEqual([{ animated: false, x: 0, y: 39708.875 }]);
        expect(ctx.state.scrollingTo).toBeDefined();
        expect(ctx.state.didFinishInitialScroll).toBeUndefined();
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

    it("does not finish at a temporary clamped target while queued initial layout is still active", () => {
        const ctx = createMockContext(
            { totalSize: 40407.375 },
            {
                didContainersLayout: true,
                queuedInitialLayout: true,
                scroll: 39627.375,
                scrollingTo: {
                    animated: false,
                    index: 99,
                    isInitialScroll: true,
                    logicalTargetOffset: 39708.875,
                    offset: 39708.875,
                    precomputedWithViewOffset: true,
                    targetOffset: 39627.375,
                } as any,
                scrollLength: 780,
                scrollPending: 39627.375,
            },
        );

        checkFinishedScroll(ctx);
        pendingFrame?.(0);

        expect(ctx.state.scrollingTo).toBeDefined();
        expect(ctx.state.didFinishInitialScroll).toBeUndefined();
    });
});
