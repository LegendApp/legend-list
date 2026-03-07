import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import "../setup";

import { checkFinishedScrollFallback } from "../../src/core/checkFinishedScroll";
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
});
