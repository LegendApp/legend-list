import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import "../setup";

import { checkFinishedScroll, checkFinishedScrollFallback } from "../../src/core/checkFinishedScroll";
import { Platform } from "../../src/platform/Platform";
import { createMockContext } from "../__mocks__/createMockContext";

describe("checkFinishedScrollFallback", () => {
    let originalPlatform: typeof Platform.OS;
    let originalSetTimeout: typeof globalThis.setTimeout;
    let originalClearTimeout: typeof globalThis.clearTimeout;
    let originalRequestAnimationFrame: typeof globalThis.requestAnimationFrame;
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
        originalRequestAnimationFrame = globalThis.requestAnimationFrame;
        queue = [];

        globalThis.setTimeout = ((callback: TimerHandler) => {
            queue.push(callback as () => void);
            return queue.length as unknown as ReturnType<typeof setTimeout>;
        }) as typeof globalThis.setTimeout;
        globalThis.clearTimeout = (() => undefined) as typeof globalThis.clearTimeout;
        globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
            callback(0);
            return 1;
        }) as typeof globalThis.requestAnimationFrame;
    });

    afterEach(() => {
        Platform.OS = originalPlatform;
        globalThis.setTimeout = originalSetTimeout;
        globalThis.clearTimeout = originalClearTimeout;
        globalThis.requestAnimationFrame = originalRequestAnimationFrame;
    });

    it("waits longer on native initial non-zero scroll when no native scroll event is observed on Android", () => {
        Platform.OS = "android";
        const ctx = createMockContext(
            {},
            {
                hasScrolled: false,
                initialScrollSession: {
                    completion: {
                        watchdog: {
                            targetOffset: 220,
                        },
                    },
                    kind: "offset",
                    previousDataLength: 0,
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
                initialScrollSession: {
                    completion: {
                        watchdog: {
                            targetOffset: 220,
                        },
                    },
                    kind: "offset",
                    previousDataLength: 0,
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
                initialScrollSession: {
                    completion: {
                        watchdog: {
                            targetOffset: 220,
                        },
                    },
                    kind: "offset",
                    previousDataLength: 0,
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

    it("jiggles silent Android initial dispatches before finishing", () => {
        Platform.OS = "android";
        const scrollToCalls: Array<{ animated: boolean; x: number; y: number }> = [];
        const ctx = createMockContext(
            {},
            {
                didContainersLayout: true,
                hasScrolled: false,
                initialScrollSession: {
                    completion: {
                        didDispatchNativeScroll: true,
                        watchdog: {
                            targetOffset: 220,
                        },
                    },
                    kind: "offset",
                    previousDataLength: 0,
                } as any,
                refScroller: {
                    current: {
                        scrollTo: (params: { animated: boolean; x: number; y: number }) => scrollToCalls.push(params),
                    },
                } as any,
                scroll: 220,
                scrollingTo: {
                    animated: false,
                    index: 99,
                    isInitialScroll: true,
                    offset: 220,
                    targetOffset: 220,
                    viewOffset: 0,
                } as any,
                scrollPending: 220,
            },
        );

        checkFinishedScrollFallback(ctx);

        flushTimers(1);
        expect(scrollToCalls).toEqual([
            { animated: false, x: 0, y: 219 },
            { animated: false, x: 0, y: 220 },
        ]);
        expect(ctx.state.initialScrollSession?.completion).toMatchObject({
            didDispatchNativeScroll: true,
            didRetrySilentInitialScroll: true,
            watchdog: {
                targetOffset: 220,
            },
        });
        expect(ctx.state.scrollingTo).toBeDefined();

        flushTimers(1);
        expect(ctx.state.scrollingTo).toBeUndefined();
        expect(ctx.state.didFinishInitialScroll).toBe(true);
    });

    it("does not finish a silent iOS bootstrap dispatch before native scroll is observed", () => {
        Platform.OS = "ios";
        const scrollToCalls: Array<{ animated: boolean; x: number; y: number }> = [];
        const ctx = createMockContext(
            { footerSize: 34 },
            {
                didContainersLayout: true,
                hasScrolled: false,
                initialScrollSession: {
                    completion: {
                        didDispatchNativeScroll: true,
                        watchdog: {
                            targetOffset: 39715,
                        },
                    },
                    kind: "bootstrap",
                    previousDataLength: 100,
                } as any,
                refScroller: {
                    current: {
                        getCurrentScrollOffset: () => 39681,
                        scrollTo: (params: { animated: boolean; x: number; y: number }) => scrollToCalls.push(params),
                    },
                } as any,
                scroll: 39715,
                scrollingTo: {
                    animated: false,
                    index: 99,
                    isInitialScroll: true,
                    offset: 39715,
                    targetOffset: 39715,
                    viewOffset: -34,
                    viewPosition: 1,
                } as any,
                scrollLength: 758,
                scrollPending: 39715,
                totalSize: 40439,
            },
        );

        checkFinishedScrollFallback(ctx);

        flushTimers(1);
        expect(ctx.state.scrollingTo).toBeDefined();
        expect(ctx.state.didFinishInitialScroll).not.toBe(true);
        expect(scrollToCalls).toEqual([{ animated: false, x: 0, y: 39715 }]);
    });

    it("retries an initial scroll that has observed native movement but is still short of the target", () => {
        Platform.OS = "android";
        const scrollToCalls: Array<{ animated: boolean; x: number; y: number }> = [];
        const ctx = createMockContext(
            { totalSize: 1453.3333740234375 },
            {
                didContainersLayout: true,
                hasScrolled: true,
                initialScrollSession: {
                    completion: {
                        didDispatchNativeScroll: true,
                    },
                    kind: "bootstrap",
                    previousDataLength: 2,
                } as any,
                refScroller: {
                    current: {
                        scrollTo: (params: { animated: boolean; x: number; y: number }) => scrollToCalls.push(params),
                    },
                } as any,
                scroll: 840.6666870117188,
                scrollingTo: {
                    animated: false,
                    index: 1,
                    isInitialScroll: true,
                    offset: 871.2499389648438,
                    targetOffset: 871.2499389648438,
                    viewOffset: 0,
                    viewPosition: 1,
                } as any,
                scrollLength: 657.3333740234375,
                scrollPending: 840.6666870117188,
            },
        );

        checkFinishedScrollFallback(ctx);

        flushTimers(1);
        expect(ctx.state.scrollingTo).toBeDefined();
        expect(ctx.state.didFinishInitialScroll).not.toBe(true);
        expect(scrollToCalls).toEqual([{ animated: false, x: 0, y: 871.2499389648438 }]);
    });

    it("finishes immediately when the active initial target is zero and content fits the viewport", () => {
        Platform.OS = "android";
        const scrollToCalls: Array<{ animated: boolean; x: number; y: number }> = [];
        const ctx = createMockContext(
            { totalSize: 100 },
            {
                hasScrolled: false,
                initialScrollSession: {
                    completion: {
                        watchdog: {
                            targetOffset: 36,
                        },
                    },
                    kind: "offset",
                    previousDataLength: 0,
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

    it("finishes immediately when a non-animated initial target is already aligned after layout", () => {
        Platform.OS = "android";
        const scrollToCalls: Array<{ animated: boolean; x: number; y: number }> = [];
        const ctx = createMockContext(
            {},
            {
                didContainersLayout: true,
                hasScrolled: false,
                initialScrollSession: {
                    completion: {
                        watchdog: {
                            targetOffset: 220,
                        },
                    },
                    kind: "offset",
                    previousDataLength: 0,
                } as any,
                refScroller: {
                    current: {
                        scrollTo: (params: { animated: boolean; x: number; y: number }) => scrollToCalls.push(params),
                    },
                } as any,
                scroll: 220,
                scrollingTo: {
                    animated: false,
                    index: 99,
                    isInitialScroll: true,
                    offset: 220,
                    targetOffset: 220,
                    viewOffset: 0,
                } as any,
                scrollPending: 220,
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
                initialScrollSession: {
                    completion: {
                        watchdog: {
                            targetOffset: 36,
                        },
                    },
                    kind: "offset",
                    previousDataLength: 0,
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

    it("does not finish a non-zero initial target without observed movement", () => {
        const ctx = createMockContext(
            { totalSize: 40731.25 },
            {
                didContainersLayout: true,
                hasScrolled: false,
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

        expect(ctx.state.scrollingTo).toBeDefined();
        expect(ctx.state.didFinishInitialScroll).not.toBe(true);
    });
});
