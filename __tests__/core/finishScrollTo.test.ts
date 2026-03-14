import { afterEach, describe, expect, it } from "bun:test";
import "../setup"; // Import global test setup

import { finishScrollTo } from "../../src/core/finishScrollTo";
import { Platform } from "../../src/platform/Platform";
import { createMockContext } from "../__mocks__/createMockContext";
import { createMockState } from "../__mocks__/createMockState";

const originalPlatform = Platform.OS;
const originalNavigator = globalThis.navigator;

describe("finishScrollTo", () => {
    afterEach(() => {
        Platform.OS = originalPlatform;
        if (originalNavigator === undefined) {
            delete (globalThis as typeof globalThis & { navigator?: Navigator }).navigator;
        } else {
            Object.defineProperty(globalThis, "navigator", {
                configurable: true,
                value: originalNavigator,
                writable: true,
            });
        }
    });

    describe("basic functionality", () => {
        it("should clear scrollingTo and scrollHistory when state is valid", () => {
            const mockCtx = createMockContext(
                {
                    scrollingTo: { animated: true, offset: 100 },
                },
                {
                    scrollHistory: [
                        { scroll: 0, time: Date.now() - 1000 },
                        { scroll: 50, time: Date.now() - 500 },
                        { scroll: 75, time: Date.now() - 100 },
                    ],
                    scrollingTo: { animated: true, offset: 100 } as any,
                },
            );

            finishScrollTo(mockCtx);

            expect(mockCtx.state.scrollingTo).toBeUndefined();
            expect(mockCtx.state.scrollHistory.length).toBe(0);
        });

        it("clears initial scroll watchdog and offset state when finishing", () => {
            const mockCtx = createMockContext(
                {},
                {
                    initialAnchor: {
                        attempts: 0,
                        index: 0,
                        settledTicks: 0,
                        viewOffset: 0,
                        viewPosition: 0,
                    },
                    initialNativeScrollWatchdog: {
                        targetOffset: 220,
                    },
                    initialScroll: {
                        contentOffset: 220,
                        index: 0,
                        viewOffset: 0,
                    } as any,
                    initialScrollUsesOffset: true,
                    scrollHistory: [{ scroll: 0, time: Date.now() }],
                    scrollingTo: { animated: false, offset: 220 } as any,
                },
            );

            finishScrollTo(mockCtx);

            expect(mockCtx.state.initialAnchor).toBeUndefined();
            expect(mockCtx.state.initialNativeScrollWatchdog).toBeUndefined();
            expect(mockCtx.state.initialScroll).toBeUndefined();
            expect(mockCtx.state.initialScrollUsesOffset).toBe(false);
        });

        it("keeps short mvcp anchor and retry windows for desktop web initial scroll", () => {
            Platform.OS = "web";
            Object.defineProperty(globalThis, "navigator", {
                configurable: true,
                value: {
                    maxTouchPoints: 0,
                    userAgent:
                        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Safari/605.1.15",
                },
                writable: true,
            });
            const mockCtx = createMockContext(
                {},
                {
                    initialScroll: {
                        contentOffset: 220,
                        index: 4,
                        viewOffset: 0,
                    } as any,
                    scrollHistory: [{ scroll: 0, time: Date.now() }],
                    scrollingTo: {
                        animated: false,
                        index: 4,
                        isInitialScroll: true,
                        offset: 220,
                    } as any,
                },
            );

            finishScrollTo(mockCtx);

            expect(mockCtx.state.initialScrollRetryWindowUntil).toBeGreaterThan(Date.now());
        });

        it("enables the replay window for touch webkit initial scroll", () => {
            Platform.OS = "web";
            Object.defineProperty(globalThis, "navigator", {
                configurable: true,
                value: {
                    maxTouchPoints: 5,
                    userAgent:
                        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Mobile/15E148 Safari/604.1",
                },
                writable: true,
            });
            const mockCtx = createMockContext(
                {},
                {
                    initialScroll: {
                        contentOffset: 220,
                        index: 4,
                        viewOffset: 0,
                    } as any,
                    scrollHistory: [{ scroll: 0, time: Date.now() }],
                    scrollingTo: {
                        animated: false,
                        index: 4,
                        isInitialScroll: true,
                        offset: 220,
                    } as any,
                },
            );

            finishScrollTo(mockCtx);

            expect(mockCtx.state.initialScrollRetryWindowUntil).toBeGreaterThan(Date.now());
        });

        it("refreshes the cached initial target offset to the finished scroll position", () => {
            Platform.OS = "web";
            const mockCtx = createMockContext(
                {},
                {
                    initialScrollLastTarget: {
                        contentOffset: 20000,
                        index: 4,
                        viewOffset: 0,
                        viewPosition: 0,
                    } as any,
                    initialScrollLastTargetUsesOffset: false,
                    scrollingTo: {
                        animated: false,
                        index: 4,
                        isInitialScroll: true,
                        offset: 220,
                        targetOffset: 35534,
                    } as any,
                },
            );

            finishScrollTo(mockCtx);

            expect(mockCtx.state.initialScrollLastTarget?.contentOffset).toBe(35534);
        });

        it("should handle state with undefined scrollingTo", () => {
            const mockCtx = createMockContext(
                { scrollingTo: undefined },
                {
                    scrollHistory: [{ scroll: 100, time: Date.now() }],
                },
            );

            finishScrollTo(mockCtx);

            expect(mockCtx.state.scrollingTo).toBeUndefined();
            expect(mockCtx.state.scrollHistory.length).toBe(1);
        });

        it("should handle state with empty scrollHistory", () => {
            const mockCtx = createMockContext(
                {
                    scrollingTo: { animated: false, offset: 200 },
                },
                {
                    scrollHistory: [],
                    scrollingTo: { animated: false, offset: 200 } as any,
                },
            );

            finishScrollTo(mockCtx);

            expect(mockCtx.state.scrollingTo).toBeUndefined();
            expect(mockCtx.state.scrollHistory.length).toBe(0);
        });
    });

    describe("null/undefined state handling", () => {
        it("should handle null state gracefully", () => {
            const ctx = createMockContext();
            ctx.state = null as any;

            expect(() => {
                finishScrollTo(ctx);
            }).not.toThrow();
        });

        it("should handle undefined state gracefully", () => {
            const ctx = createMockContext();
            ctx.state = undefined as any;

            expect(() => {
                finishScrollTo(ctx);
            }).not.toThrow();
        });
    });

    describe("edge cases", () => {
        it("should handle corrupted scrollHistory", () => {
            const ctx = createMockContext(
                {},
                {
                    scrollHistory: null as any,
                    scrollingTo: { offset: 10 } as any,
                },
            );

            expect(() => {
                finishScrollTo(ctx);
            }).toThrow();
        });

        it("should handle missing scrollHistory property", () => {
            const ctx = createMockContext(
                {},
                {
                    scrollHistory: null as any,
                    scrollingTo: { offset: 10 } as any,
                },
            );

            expect(() => {
                finishScrollTo(ctx);
            }).toThrow();
        });

        it("should handle very large scrollHistory", () => {
            const largeHistory = Array.from({ length: 10000 }, (_, i) => ({
                scroll: i * 10,
                time: Date.now() - i,
            }));

            const mockCtx = createMockContext(
                { scrollingTo: { offset: 100 } },
                { scrollHistory: largeHistory, scrollingTo: { offset: 100 } as any },
            );

            finishScrollTo(mockCtx);

            expect(mockCtx.state.scrollingTo).toBeUndefined();
            expect(mockCtx.state.scrollHistory.length).toBe(0);
        });
    });

    describe("state consistency", () => {
        it("should not affect other state properties", () => {
            const mockCtx = createMockContext(
                { scrollingTo: { offset: 100 } },
                {
                    isAtEnd: false,
                    maintainingScrollAtEnd: false,
                    scroll: 75,
                    scrollHistory: [{ scroll: 50, time: Date.now() }],
                    scrollingTo: { offset: 100 } as any,
                    scrollLength: 400,
                },
            );
            const mockState = mockCtx.state;

            const originalScroll = mockState.scroll;
            const originalScrollLength = mockState.scrollLength;
            const originalIsAtEnd = mockState.isAtEnd;
            const originalMaintaining = mockState.maintainingScrollAtEnd;

            finishScrollTo(mockCtx);

            expect(mockCtx.state.scrollingTo).toBeUndefined();
            expect(mockState.scrollHistory.length).toBe(0);

            expect(mockState.scroll).toBe(originalScroll);
            expect(mockState.scrollLength).toBe(originalScrollLength);
            expect(mockState.isAtEnd).toBe(originalIsAtEnd);
            expect(mockState.maintainingScrollAtEnd).toBe(originalMaintaining || false);
        });

        it("should work with partial state objects", () => {
            const ctx = createMockContext();
            const minimalState = createMockState({
                scrollHistory: [{ scroll: 0, time: 0 }],
                scrollingTo: { offset: 0 } as any,
            });
            ctx.state = minimalState;

            finishScrollTo(ctx);

            expect(minimalState.scrollHistory.length).toBe(0);
        });
    });

    describe("performance", () => {
        it("should handle rapid consecutive calls efficiently", () => {
            const mockState = createMockState();
            mockState.scrollHistory = [{ scroll: 50, time: Date.now() }];
            const mockCtx = createMockContext({ scrollingTo: { offset: 100 } });
            mockState.scrollingTo = { offset: 100 } as any;
            mockCtx.state = mockState;

            const start = Date.now();

            for (let i = 0; i < 1000; i++) {
                mockState.scrollHistory = [{ scroll: i, time: Date.now() }];
                mockState.scrollingTo = { offset: i } as any;
                finishScrollTo(mockCtx);
            }

            const duration = Date.now() - start;
            expect(duration).toBeLessThan(50);
        });
    });

    describe("integration scenarios", () => {
        it("should work in typical scroll completion flow", () => {
            const mockCtx = createMockContext(
                {},
                {
                    scrollHistory: [
                        { scroll: 100, time: Date.now() - 500 },
                        { scroll: 300, time: Date.now() - 300 },
                        { scroll: 450, time: Date.now() - 100 },
                        { scroll: 500, time: Date.now() },
                    ],
                    scrollingTo: {
                        animated: true,
                        index: 5,
                        offset: 500,
                        viewPosition: 0.5,
                    },
                },
            );

            finishScrollTo(mockCtx);

            expect(mockCtx.state.scrollingTo).toBeUndefined();
            expect(mockCtx.state.scrollHistory.length).toBe(0);
        });

        it("should handle interrupted scroll scenarios", () => {
            const mockState = createMockState();
            mockState.scrollHistory = [
                { scroll: 0, time: Date.now() - 200 },
                { scroll: 100, time: Date.now() - 100 },
            ];

            const ctx = createMockContext();
            mockState.scrollingTo = { offset: 0 } as any;
            ctx.state = mockState;

            finishScrollTo(ctx);

            expect(mockState.scrollHistory.length).toBe(0);
        });

        it("should not call onLoad after initial readiness is complete", () => {
            let onLoadCalls = 0;
            const mockCtx = createMockContext(
                {},
                {
                    didContainersLayout: true,
                    didFinishInitialScroll: true,
                    loadStartTime: Date.now() - 1000,
                    props: {
                        onLoad: () => {
                            onLoadCalls += 1;
                        },
                    },
                    scrollHistory: [{ scroll: 10, time: Date.now() - 50 }],
                    scrollingTo: { offset: 50 } as any,
                },
            );
            mockCtx.values.set("readyToRender", true);

            finishScrollTo(mockCtx);

            expect(onLoadCalls).toBe(0);
        });
    });
});
