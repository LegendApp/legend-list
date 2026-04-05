import { describe, expect, it } from "bun:test";
import "../setup"; // Import global test setup

import { finishScrollTo } from "../../src/core/finishScrollTo";
import { createMockContext } from "../__mocks__/createMockContext";
import { createMockState } from "../__mocks__/createMockState";

describe("finishScrollTo", () => {
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
                    initialScroll: {
                        contentOffset: 220,
                        index: 0,
                        viewOffset: 0,
                    } as any,
                    initialScrollSession: {
                        completion: {
                            watchdog: {
                                targetOffset: 220,
                            },
                        },
                        kind: "offset",
                        previousDataLength: 0,
                    },
                    props: {
                        data: [{ id: "item-0" }],
                    },
                    scrollHistory: [{ scroll: 0, time: Date.now() }],
                    scrollingTo: { animated: false, offset: 220 } as any,
                },
            );

            finishScrollTo(mockCtx);

            expect(mockCtx.state.initialScrollSession?.completion?.watchdog).toBeUndefined();
            expect(mockCtx.state.initialScroll).toBeUndefined();
            expect(mockCtx.state.initialScrollSession).toBeUndefined();
        });

        it("preserves empty offset-only initial targets for the first non-empty replay", () => {
            const mockCtx = createMockContext(
                {},
                {
                    initialScroll: {
                        contentOffset: 220,
                        index: 0,
                        viewOffset: 0,
                    } as any,
                    initialScrollSession: {
                        kind: "offset",
                        previousDataLength: 0,
                    } as any,
                    props: {
                        data: [],
                    },
                    scrollHistory: [{ scroll: 0, time: Date.now() }],
                    scrollingTo: {
                        animated: false,
                        isInitialScroll: true,
                        offset: 220,
                    } as any,
                },
            );

            finishScrollTo(mockCtx);

            expect(mockCtx.state.initialScroll).toEqual({
                contentOffset: 220,
                index: 0,
                viewOffset: 0,
            });
            expect(mockCtx.state.initialScrollSession).toMatchObject({
                kind: "offset",
            });
        });

        it("preserves footer-correction targets only when the active scroll requests it", () => {
            const mockCtx = createMockContext(
                {},
                {
                    initialScroll: {
                        contentOffset: undefined,
                        index: 2,
                        preserveForFooterLayout: true,
                        viewOffset: 0,
                        viewPosition: 1,
                    } as any,
                    props: {
                        data: [{ id: "item-0" }, { id: "item-1" }, { id: "item-2" }],
                    },
                    scrollHistory: [{ scroll: 0, time: Date.now() }],
                    scrollingTo: {
                        animated: false,
                        isInitialScroll: true,
                        offset: 220,
                    } as any,
                },
            );

            finishScrollTo(mockCtx);

            expect(mockCtx.state.initialScroll).toEqual({
                contentOffset: undefined,
                index: 2,
                preserveForFooterLayout: true,
                viewOffset: 0,
                viewPosition: 1,
            });
        });

        it("syncs offset sessions from the scroller's observed offset when available", () => {
            const mockCtx = createMockContext(
                {},
                {
                    initialScroll: {
                        contentOffset: 220,
                        index: 0,
                        viewOffset: 0,
                    } as any,
                    initialScrollSession: {
                        kind: "offset",
                        previousDataLength: 0,
                    } as any,
                    props: {
                        data: [{ id: "item-0" }],
                    },
                    refScroller: {
                        current: {
                            getCurrentScrollOffset: () => 180,
                        },
                    } as any,
                    scroll: 220,
                    scrollHistory: [{ scroll: 0, time: Date.now() }],
                    scrollingTo: {
                        animated: false,
                        isInitialScroll: true,
                        offset: 220,
                    } as any,
                    scrollPending: 220,
                    scrollPrev: 220,
                },
            );

            finishScrollTo(mockCtx);

            expect(mockCtx.state.scroll).toBe(180);
            expect(mockCtx.state.scrollPending).toBe(180);
            expect(mockCtx.state.scrollPrev).toBe(180);
        });

        it("ignores non-finite observed offsets when finishing offset sessions", () => {
            const mockCtx = createMockContext(
                {},
                {
                    initialScroll: {
                        contentOffset: 220,
                        index: 0,
                        viewOffset: 0,
                    } as any,
                    initialScrollSession: {
                        kind: "offset",
                        previousDataLength: 0,
                    } as any,
                    props: {
                        data: [{ id: "item-0" }],
                    },
                    refScroller: {
                        current: {
                            getCurrentScrollOffset: () => Number.NaN,
                        },
                    } as any,
                    scroll: 220,
                    scrollHistory: [{ scroll: 0, time: Date.now() }],
                    scrollingTo: {
                        animated: false,
                        isInitialScroll: true,
                        offset: 220,
                    } as any,
                    scrollPending: 220,
                    scrollPrev: 220,
                },
            );

            finishScrollTo(mockCtx);

            expect(mockCtx.state.scroll).toBe(220);
            expect(mockCtx.state.scrollPending).toBe(220);
            expect(mockCtx.state.scrollPrev).toBe(220);
        });

        it("waits for the completion frame before finishing when requested", () => {
            const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
            let queuedFrame: FrameRequestCallback | undefined;
            globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
                queuedFrame = callback;
                return 1;
            }) as typeof requestAnimationFrame;

            const mockCtx = createMockContext(
                {},
                {
                    initialScroll: {
                        contentOffset: 220,
                        index: 0,
                        viewOffset: 0,
                    } as any,
                    initialScrollSession: {
                        kind: "offset",
                        previousDataLength: 0,
                    } as any,
                    props: {
                        data: [{ id: "item-0" }],
                    },
                    scrollHistory: [{ scroll: 0, time: Date.now() }],
                    scrollingTo: {
                        animated: false,
                        isInitialScroll: true,
                        offset: 220,
                        waitForInitialScrollCompletionFrame: true,
                    } as any,
                },
            );

            try {
                finishScrollTo(mockCtx);

                expect(mockCtx.state.didFinishInitialScroll).not.toBe(true);
                expect(mockCtx.state.initialScroll).toEqual({
                    contentOffset: 220,
                    index: 0,
                    viewOffset: 0,
                });

                queuedFrame?.(0);

                expect(mockCtx.state.didFinishInitialScroll).toBe(true);
                expect(mockCtx.state.initialScroll).toBeUndefined();
            } finally {
                globalThis.requestAnimationFrame = originalRequestAnimationFrame;
            }
        });

        it("clears footer-correction targets when a non-initial scroll completes", () => {
            const mockCtx = createMockContext(
                {},
                {
                    initialScroll: {
                        contentOffset: undefined,
                        index: 2,
                        preserveForFooterLayout: true,
                        viewOffset: 0,
                        viewPosition: 1,
                    } as any,
                    props: {
                        data: [{ id: "item-0" }, { id: "item-1" }, { id: "item-2" }],
                    },
                    scrollHistory: [{ scroll: 0, time: Date.now() }],
                    scrollingTo: {
                        animated: false,
                        offset: 220,
                    } as any,
                },
            );

            finishScrollTo(mockCtx);

            expect(mockCtx.state.initialScroll).toBeUndefined();
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
