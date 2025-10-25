import { describe, expect, it } from "bun:test";
import "../setup"; // Import global test setup

import { finishScrollTo } from "../../src/core/finishScrollTo";
import type { InternalState } from "../../src/types";
import { createMockContext } from "../__mocks__/createMockContext";
import { createMockState } from "../__mocks__/createMockState";

describe("finishScrollTo", () => {
    describe("basic functionality", () => {
        it("should clear scrollingTo and scrollHistory when state is valid", () => {
            const mockState = createMockState();
            mockState.scrollHistory = [
                { scroll: 0, time: Date.now() - 1000 },
                { scroll: 50, time: Date.now() - 500 },
                { scroll: 75, time: Date.now() - 100 },
            ];
            mockState.isOptimizingItemPositions = true;
            const mockCtx = createMockContext({
                scrollingTo: { animated: true, offset: 100 },
            });

            finishScrollTo(mockCtx, mockState);

            expect(mockCtx.values.get("scrollingTo")).toBeUndefined();
            expect(mockState.scrollHistory.length).toBe(0);
            expect(mockState.isOptimizingItemPositions).toBe(false);
        });

        it("should handle state with undefined scrollingTo", () => {
            const mockState = createMockState();
            mockState.scrollHistory = [{ scroll: 100, time: Date.now() }];
            const mockCtx = createMockContext({ scrollingTo: undefined });

            finishScrollTo(mockCtx, mockState);

            expect(mockCtx.values.get("scrollingTo")).toBeUndefined();
            expect(mockState.scrollHistory.length).toBe(0);
        });

        it("should handle state with empty scrollHistory", () => {
            const mockState = createMockState();
            mockState.scrollHistory = [];
            const mockCtx = createMockContext({
                scrollingTo: { animated: false, offset: 200 },
            });

            finishScrollTo(mockCtx, mockState);

            expect(mockCtx.values.get("scrollingTo")).toBeUndefined();
            expect(mockState.scrollHistory.length).toBe(0);
        });
    });

    describe("null/undefined state handling", () => {
        it("should handle null state gracefully", () => {
            expect(() => {
                finishScrollTo(createMockContext(), null);
            }).not.toThrow();
        });

        it("should handle undefined state gracefully", () => {
            expect(() => {
                finishScrollTo(createMockContext(), undefined);
            }).not.toThrow();
        });
    });

    describe("edge cases", () => {
        it("should handle corrupted scrollHistory", () => {
            const mockState = {
                scrollHistory: null as any,
            } as InternalState;

            expect(() => {
                finishScrollTo(createMockContext(), mockState);
            }).toThrow();
        });

        it("should handle missing scrollHistory property", () => {
            const mockState = {} as any;

            expect(() => {
                finishScrollTo(createMockContext(), mockState);
            }).toThrow();
        });

        it("should handle very large scrollHistory", () => {
            const largeHistory = Array.from({ length: 10000 }, (_, i) => ({
                scroll: i * 10,
                time: Date.now() - i,
            }));

            const mockState = createMockState();
            mockState.scrollHistory = largeHistory;
            const mockCtx = createMockContext({ scrollingTo: { offset: 100 } });

            finishScrollTo(mockCtx, mockState);

            expect(mockCtx.values.get("scrollingTo")).toBeUndefined();
            expect(mockState.scrollHistory.length).toBe(0);
        });
    });

    describe("state consistency", () => {
        it("should not affect other state properties", () => {
            const mockState = createMockState({
                isAtEnd: false,
                maintainingScrollAtEnd: false,
                scroll: 75,
                scrollLength: 400,
            });
            mockState.scrollHistory = [{ scroll: 50, time: Date.now() }];
            const mockCtx = createMockContext({ scrollingTo: { offset: 100 } });

            const originalScroll = mockState.scroll;
            const originalScrollLength = mockState.scrollLength;
            const originalIsAtEnd = mockState.isAtEnd;
            const originalMaintaining = mockState.maintainingScrollAtEnd;

            finishScrollTo(mockCtx, mockState);

            expect(mockCtx.values.get("scrollingTo")).toBeUndefined();
            expect(mockState.scrollHistory.length).toBe(0);

            expect(mockState.scroll).toBe(originalScroll);
            expect(mockState.scrollLength).toBe(originalScrollLength);
            expect(mockState.isAtEnd).toBe(originalIsAtEnd);
            expect(mockState.maintainingScrollAtEnd).toBe(originalMaintaining || false);
        });

        it("should work with partial state objects", () => {
            const minimalState = {
                scrollHistory: [{ scroll: 0, time: 0 }],
            } as InternalState;

            finishScrollTo(createMockContext(), minimalState);

            expect(minimalState.scrollHistory.length).toBe(0);
        });
    });

    describe("performance", () => {
        it("should handle rapid consecutive calls efficiently", () => {
            const mockState = createMockState();
            mockState.scrollHistory = [{ scroll: 50, time: Date.now() }];
            const mockCtx = createMockContext({ scrollingTo: { offset: 100 } });

            const start = Date.now();

            for (let i = 0; i < 1000; i++) {
                mockState.scrollHistory = [{ scroll: i, time: Date.now() }];
                mockCtx.values.set("scrollingTo", { offset: i });
                finishScrollTo(mockCtx, mockState);
            }

            const duration = Date.now() - start;
            expect(duration).toBeLessThan(50);
        });
    });

    describe("integration scenarios", () => {
        it("should work in typical scroll completion flow", () => {
            const mockState = createMockState();
            mockState.scrollHistory = [
                { scroll: 100, time: Date.now() - 500 },
                { scroll: 300, time: Date.now() - 300 },
                { scroll: 450, time: Date.now() - 100 },
                { scroll: 500, time: Date.now() },
            ];
            const mockCtx = createMockContext({
                scrollingTo: {
                    animated: true,
                    index: 5,
                    offset: 500,
                    viewPosition: 0.5,
                },
            });

            finishScrollTo(mockCtx, mockState);

            expect(mockCtx.values.get("scrollingTo")).toBeUndefined();
            expect(mockState.scrollHistory.length).toBe(0);
        });

        it("should handle interrupted scroll scenarios", () => {
            const mockState = createMockState();
            mockState.scrollHistory = [
                { scroll: 0, time: Date.now() - 200 },
                { scroll: 100, time: Date.now() - 100 },
            ];

            finishScrollTo(createMockContext(), mockState);

            expect(mockState.scrollHistory.length).toBe(0);
        });
    });
});
