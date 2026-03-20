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

    it("does not finish an initial scroll fallback just because movement was observed while still short of target", () => {
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

    it("finishes an initial scroll fallback once the resolved end clamp target is reached", () => {
        Platform.OS = "android";
        const ctx = createMockContext(
            { totalSize: 40407.375 },
            {
                didContainersLayout: true,
                hasScrolled: true,
                initialBootstrap: {
                    active: false,
                    desiredOffset: 39800,
                    stableFrames: 0,
                    targetIndexHint: 99,
                    targetKey: undefined,
                    viewOffset: 0,
                    viewPosition: 0,
                } as any,
                props: {
                    data: Array.from({ length: 100 }, (_value, index) => ({ id: index })),
                    keyExtractor: (item: { id: number }) => `item_${item.id}`,
                } as any,
                queuedInitialLayout: true,
                scroll: 39627.33203125,
                scrollAdjustHandler: {
                    getAdjust: () => -81.5,
                    requestAdjust: () => {},
                    setMounted: () => {},
                } as any,
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
                scrollPending: 39627.33203125,
            },
        );

        checkFinishedScrollFallback(ctx);

        flushTimers(1);
        expect(ctx.state.scrollingTo).toBeUndefined();
        expect(ctx.state.initialBootstrap?.active).toBe(true);
        expect(ctx.state.didFinishInitialScroll).toBeUndefined();
    });

    it("finishes immediately when the active initial target is zero and content fits the viewport", () => {
        Platform.OS = "android";
        const scrollToCalls: Array<{ animated: boolean; x: number; y: number }> = [];
        const ctx = createMockContext(
            { totalSize: 100 },
            {
                hasScrolled: false,
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

    it("does not force-finish a non-zero initial scroll fallback before native movement is observed", () => {
        Platform.OS = "android";
        const ctx = createMockContext(
            { totalSize: 40434.375 },
            {
                didContainersLayout: true,
                didDispatchNativeScroll: true,
                initialBootstrap: {
                    active: false,
                    desiredOffset: 39800,
                    stableFrames: 0,
                    targetIndexHint: 99,
                    targetKey: "item_99",
                    viewOffset: 0,
                    viewPosition: 0,
                } as any,
                props: {
                    data: Array.from({ length: 100 }, (_value, index) => ({ id: index })),
                    keyExtractor: (item: { id: number }) => `item_${item.id}`,
                } as any,
                queuedInitialLayout: true,
                scroll: 39708.875,
                scrollingTo: {
                    animated: false,
                    index: 99,
                    isInitialScroll: true,
                    logicalTargetOffset: 39708.875,
                    offset: 39708.875,
                    precomputedWithViewOffset: true,
                    targetOffset: 39708.875,
                } as any,
                scrollAdjustHandler: {
                    getAdjust: () => 27,
                    requestAdjust: () => {},
                    setMounted: () => {},
                } as any,
                scrollLength: 780,
                scrollPending: 39708.875,
            },
        );

        checkFinishedScrollFallback(ctx);

        flushTimers(8);
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
                hasScrolled: true,
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
                initialBootstrap: {
                    active: false,
                    desiredOffset: 39708.875,
                    stableFrames: 0,
                    targetIndexHint: 99,
                    targetKey: "item_99",
                    viewOffset: 0,
                    viewPosition: 0,
                } as any,
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

    it("hands off to bootstrap immediately after a queued-layout clamp is reached once native dispatch has been armed", () => {
        const ctx = createMockContext(
            { totalSize: 40407.375 },
            {
                didContainersLayout: true,
                didDispatchNativeScroll: true,
                initialBootstrap: {
                    active: false,
                    desiredOffset: 39708.875,
                    stableFrames: 0,
                    targetIndexHint: 99,
                    targetKey: "item_99",
                    viewOffset: 0,
                    viewPosition: 0,
                } as any,
                props: {
                    data: Array.from({ length: 100 }, (_value, index) => ({ id: index })),
                    keyExtractor: (item: { id: number }) => `item_${item.id}`,
                } as any,
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

        expect(ctx.state.scrollingTo).toBeUndefined();
        expect(ctx.state.initialBootstrap?.active).toBe(true);
        expect(ctx.state.didFinishInitialScroll).toBeUndefined();
    });

    it("does not finish a non-zero initial scroll at target before native movement is observed", () => {
        const ctx = createMockContext(
            { totalSize: 40434.375 },
            {
                didContainersLayout: true,
                didDispatchNativeScroll: true,
                initialBootstrap: {
                    active: false,
                    desiredOffset: 39800,
                    stableFrames: 0,
                    targetIndexHint: 99,
                    targetKey: "item_99",
                    viewOffset: 0,
                    viewPosition: 0,
                } as any,
                queuedInitialLayout: true,
                scroll: 39708.875,
                scrollAdjustHandler: {
                    getAdjust: () => 27,
                    requestAdjust: () => {},
                    setMounted: () => {},
                } as any,
                scrollingTo: {
                    animated: false,
                    index: 99,
                    isInitialScroll: true,
                    logicalTargetOffset: 39708.875,
                    offset: 39708.875,
                    precomputedWithViewOffset: true,
                    targetOffset: 39708.875,
                } as any,
                scrollLength: 780,
                scrollPending: 39708.875,
            },
        );

        checkFinishedScroll(ctx);
        pendingFrame?.(0);

        expect(ctx.state.scrollingTo).toBeDefined();
        expect(ctx.state.didFinishInitialScroll).toBeUndefined();
    });

    it("hands off to bootstrap immediately at the queued-layout end clamp after native movement is observed", () => {
        const ctx = createMockContext(
            { totalSize: 40407.375 },
            {
                didContainersLayout: true,
                hasScrolled: true,
                initialBootstrap: {
                    active: false,
                    desiredOffset: 39708.875,
                    stableFrames: 0,
                    targetIndexHint: 99,
                    targetKey: "item_99",
                    viewOffset: 0,
                    viewPosition: 0,
                } as any,
                props: {
                    data: Array.from({ length: 100 }, (_value, index) => ({ id: index })),
                    keyExtractor: (item: { id: number }) => `item_${item.id}`,
                } as any,
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

        expect(ctx.state.scrollingTo).toBeUndefined();
        expect(ctx.state.initialBootstrap?.active).toBe(true);
        expect(ctx.state.didFinishInitialScroll).toBeUndefined();
    });

    it("does not hand off to bootstrap after a noScrollingTo clamp retry lowers only the live offset", () => {
        const ctx = createMockContext(
            { totalSize: 40252 },
            {
                didContainersLayout: true,
                hasScrolled: true,
                initialBootstrap: {
                    active: false,
                    desiredOffset: 39800,
                    stableFrames: 0,
                    targetIndexHint: 99,
                    targetKey: "item_99",
                    viewOffset: 0,
                    viewPosition: 0,
                } as any,
                props: {
                    data: Array.from({ length: 100 }, (_value, index) => ({ id: index })),
                    keyExtractor: (item: { id: number }) => `item_${item.id}`,
                } as any,
                queuedInitialLayout: true,
                scroll: 39472,
                scrollingTo: {
                    animated: false,
                    index: 99,
                    isInitialScroll: true,
                    logicalTargetOffset: 39708.875,
                    offset: 39472,
                    precomputedWithViewOffset: true,
                    targetOffset: 39627.375,
                } as any,
                scrollLength: 780,
                scrollPending: 39472,
            },
        );

        checkFinishedScroll(ctx);
        pendingFrame?.(0);

        expect(ctx.state.scrollingTo).toBeDefined();
        expect(ctx.state.initialBootstrap?.active).toBe(false);
        expect(ctx.state.didFinishInitialScroll).toBeUndefined();
    });
});
