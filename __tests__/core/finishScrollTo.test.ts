import { describe, expect, it } from "bun:test";
import "../setup"; // Import global test setup

import { finishScrollTo } from "../../src/core/finishScrollTo";
import type { InternalState } from "../../src/types";

describe("finishScrollTo", () => {
    describe("basic functionality", () => {
        it("should clear scrollingTo and scrollHistory when state is valid", () => {
            const mockState: InternalState = {
                scrollHistory: [
                    { scroll: 0, time: Date.now() - 1000 },
                    { scroll: 50, time: Date.now() - 500 },
                    { scroll: 75, time: Date.now() - 100 },
                ],
                scrollingTo: { animated: true, offset: 100 },
            } as any;

            finishScrollTo(mockState);

            expect(mockState.scrollingTo).toBeUndefined();
            expect(mockState.scrollHistory.length).toBe(0);
        });

        it("should handle state with undefined scrollingTo", () => {
            const mockState: InternalState = {
                scrollHistory: [{ scroll: 100, time: Date.now() }],
                scrollingTo: undefined,
            } as any;

            finishScrollTo(mockState);

            expect(mockState.scrollingTo).toBeUndefined();
            expect(mockState.scrollHistory.length).toBe(0);
        });

        it("should handle state with empty scrollHistory", () => {
            const mockState: InternalState = {
                scrollHistory: [],
                scrollingTo: { animated: false, offset: 200 },
            } as any;

            finishScrollTo(mockState);

            expect(mockState.scrollingTo).toBeUndefined();
            expect(mockState.scrollHistory.length).toBe(0);
        });
    });

    describe("null/undefined state handling", () => {
        it("should handle null state gracefully", () => {
            expect(() => {
                finishScrollTo(null);
            }).not.toThrow();
        });

        it("should handle undefined state gracefully", () => {
            expect(() => {
                finishScrollTo(undefined);
            }).not.toThrow();
        });
    });

    describe("edge cases", () => {
        it("should handle corrupted scrollHistory", () => {
            const mockState = {
                scrollHistory: null as any,
                scrollingTo: { offset: 100 },
            } as InternalState;

            expect(() => {
                finishScrollTo(mockState);
            }).toThrow();
        });

        it("should handle missing scrollHistory property", () => {
            const mockState = {
                scrollingTo: { offset: 100 },
                // scrollHistory property missing
            } as any;

            expect(() => {
                finishScrollTo(mockState);
            }).toThrow();
        });

        it("should handle very large scrollHistory", () => {
            const largeHistory = Array.from({ length: 10000 }, (_, i) => ({
                scroll: i * 10,
                time: Date.now() - i,
            }));

            const mockState: InternalState = {
                scrollHistory: largeHistory,
                scrollingTo: { offset: 100 },
            } as any;

            finishScrollTo(mockState);

            expect(mockState.scrollingTo).toBeUndefined();
            expect(mockState.scrollHistory.length).toBe(0);
        });
    });

    describe("state consistency", () => {
        it("should not affect other state properties", () => {
            const mockState: InternalState = {
                isAtEnd: false,
                maintainingScrollAtEnd: false,
                scroll: 75,
                scrollHistory: [{ scroll: 50, time: Date.now() }],
                scrollingTo: { offset: 100 },
                scrollLength: 400,
            } as any;

            const originalScroll = mockState.scroll;
            const originalScrollLength = mockState.scrollLength;
            const originalIsAtEnd = mockState.isAtEnd;
            const originalMaintaining = mockState.maintainingScrollAtEnd;

            finishScrollTo(mockState);

            // Should only clear scrollingTo and scrollHistory
            expect(mockState.scrollingTo).toBeUndefined();
            expect(mockState.scrollHistory.length).toBe(0);

            // Should not affect other properties
            expect(mockState.scroll).toBe(originalScroll);
            expect(mockState.scrollLength).toBe(originalScrollLength);
            expect(mockState.isAtEnd).toBe(originalIsAtEnd);
            expect(mockState.maintainingScrollAtEnd).toBe(originalMaintaining!);
        });

        it("should work with partial state objects", () => {
            const minimalState = {
                scrollHistory: [{ scroll: 0, time: 0 }],
                scrollingTo: { offset: 100 },
            } as InternalState;

            finishScrollTo(minimalState);

            expect(minimalState.scrollingTo).toBeUndefined();
            expect(minimalState.scrollHistory.length).toBe(0);
        });
    });

    describe("performance", () => {
        it("should handle rapid consecutive calls efficiently", () => {
            const mockState: InternalState = {
                scrollHistory: [{ scroll: 50, time: Date.now() }],
                scrollingTo: { offset: 100 },
            } as any;

            const start = Date.now();

            for (let i = 0; i < 1000; i++) {
                // Reset state for each call
                mockState.scrollingTo = { offset: i };
                mockState.scrollHistory = [{ scroll: i, time: Date.now() }];

                finishScrollTo(mockState);
            }

            const duration = Date.now() - start;
            expect(duration).toBeLessThan(50); // Should be very fast
        });
    });

    describe("integration scenarios", () => {
        it("should work in typical scroll completion flow", () => {
            // Simulate a typical scrollTo -> onScroll -> finishScrollTo flow
            const mockState: InternalState = {
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
            } as any;

            finishScrollTo(mockState);

            expect(mockState.scrollingTo).toBeUndefined();
            expect(mockState.scrollHistory.length).toBe(0);
        });

        it("should handle interrupted scroll scenarios", () => {
            // When user interrupts a scroll with another scroll
            const mockState: InternalState = {
                scrollHistory: [
                    { scroll: 0, time: Date.now() - 200 },
                    { scroll: 100, time: Date.now() - 100 },
                    // Scroll was interrupted before reaching target
                ],
                scrollingTo: {
                    animated: true,
                    offset: 200,
                },
            } as any;

            finishScrollTo(mockState);

            expect(mockState.scrollingTo).toBeUndefined();
            expect(mockState.scrollHistory.length).toBe(0);
        });

        it("should work with programmatic scrolls", () => {
            // scrollToIndex, scrollTo, etc.
            const mockState: InternalState = {
                scrollHistory: [],
                scrollingTo: {
                    animated: false,
                    index: 10,
                    offset: 800,
                },
            } as any;

            finishScrollTo(mockState);

            expect(mockState.scrollingTo).toBeUndefined();
            expect(mockState.scrollHistory.length).toBe(0);
        });
    });
});
