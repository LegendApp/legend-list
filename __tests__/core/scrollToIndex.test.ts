import { beforeEach, describe, expect, it } from "bun:test";
import "../setup"; // Import global test setup

import { scrollToIndex } from "../../src/core/scrollToIndex";
import type { StateContext } from "../../src/state/state";
import type { InternalState } from "../../src/types";
import { createMockContext } from "../__mocks__/createMockContext";
import { createMockState } from "../__mocks__/createMockState";

describe("scrollToIndex", () => {
    let mockCtx: StateContext;
    let mockState: InternalState;
    let mockScrollCalls: any[] = [];

    beforeEach(() => {
        mockScrollCalls = [];

        mockCtx = createMockContext({
            headerSize: 0,
            stylePaddingTop: 0,
        });

        mockState = createMockState({
            idCache: new Map(),
            positions: new Map(),
            props: {
                data: Array.from({ length: 10 }, (_, i) => ({ id: i })),
                estimatedItemSize: 100,
                getEstimatedItemSize: undefined,
                horizontal: false,
                keyExtractor: (_: any, index: number) => `item_${index}`,
            },
            refScroller: {
                current: {
                    scrollTo: (params: any) => mockScrollCalls.push(params),
                } as any,
            },
            scroll: 0,
            scrollForNextCalculateItemsInView: undefined,
            scrollHistory: [],
            scrollingTo: undefined,
            scrollLength: 1000, // Required by calculateOffsetWithOffsetPosition
            scrollPending: 0,
            sizes: new Map(),
            sizesKnown: new Map(),
        });

        // Setup default positions for items
        for (let i = 0; i < 10; i++) {
            const itemId = `item_${i}`;
            mockState.idCache.set(i, itemId);
            mockState.positions.set(itemId, i * 100); // Each item is 100px tall
        }
    });

    describe("index boundary handling", () => {
        it("should clamp index to valid range when index is too high", () => {
            scrollToIndex(mockCtx, mockState, { index: 15 }); // Beyond data length

            expect(mockScrollCalls.length).toBe(1);
            // Should scroll to last item (index 9)
            expect(mockState.scrollingTo?.index).toBe(9);
        });

        it("should clamp index to valid range when index is negative", () => {
            scrollToIndex(mockCtx, mockState, { index: -5 });

            expect(mockScrollCalls.length).toBe(1);
            // Should scroll to first item (index 0)
            expect(mockState.scrollingTo?.index).toBe(0);
        });

        it("should handle index 0 correctly", () => {
            scrollToIndex(mockCtx, mockState, { index: 0 });

            expect(mockScrollCalls.length).toBe(1);
            expect(mockState.scrollingTo?.index).toBe(0);
            expect(mockScrollCalls[0].y).toBe(0); // Should be at top
        });

        it("should handle last valid index correctly", () => {
            scrollToIndex(mockCtx, mockState, { index: 9 }); // Last item

            expect(mockScrollCalls.length).toBe(1);
            expect(mockState.scrollingTo?.index).toBe(9);
        });

        it("should handle empty data array", () => {
            mockState.props.data = [];

            scrollToIndex(mockCtx, mockState, { index: 0 });

            expect(mockScrollCalls.length).toBe(1);
            expect(mockState.scrollingTo?.index).toBe(-1); // Clamped to -1 for empty array
        });
    });

    describe("offset calculations", () => {
        it("should calculate basic offset without viewOffset", () => {
            scrollToIndex(mockCtx, mockState, { index: 3 });

            expect(mockScrollCalls.length).toBe(1);
            expect(mockScrollCalls[0].y).toBe(300); // Item 3 at position 300
            expect(mockScrollCalls[0].x).toBe(0); // Vertical scrolling
        });

        it("should apply viewOffset to the calculated position", () => {
            scrollToIndex(mockCtx, mockState, { index: 3, viewOffset: 50 });

            expect(mockScrollCalls.length).toBe(1);
            // The viewOffset is applied twice in the calculation:
            // 1. firstIndexScrollPosition = (position + padding + header) - viewOffset = 300 - 50 = 250
            // 2. calculateOffsetWithOffsetPosition: offset -= viewOffset = 250 - 50 = 200
            expect(mockScrollCalls[0].y).toBe(200);
        });

        it("should handle negative viewOffset", () => {
            scrollToIndex(mockCtx, mockState, { index: 3, viewOffset: -50 });

            expect(mockScrollCalls.length).toBe(1);
            // viewOffset is applied twice: (300 - (-50)) - (-50) = 350 - (-50) = 400
            expect(mockScrollCalls[0].y).toBe(400);
        });

        it("should include padding and header in offset calculation", () => {
            mockCtx.values.set("stylePaddingTop", 20);
            mockCtx.values.set("headerSize", 30);

            scrollToIndex(mockCtx, mockState, { index: 3 });

            expect(mockScrollCalls.length).toBe(1);
            expect(mockScrollCalls[0].y).toBe(350); // 300 + 20 + 30
        });

        it("should handle missing position data gracefully", () => {
            // Remove position for item 3
            mockState.positions.delete("item_3");

            scrollToIndex(mockCtx, mockState, { index: 3 });

            expect(mockScrollCalls.length).toBe(1);
            expect(mockScrollCalls[0].y).toBe(0); // Defaults to 0 when position is missing
        });
    });

    describe("viewPosition handling", () => {
        it("should default viewPosition to 1 for last item when not specified", () => {
            scrollToIndex(mockCtx, mockState, { index: 9 }); // Last item

            expect(mockState.scrollingTo?.viewPosition).toBe(1);
        });

        it("should use provided viewPosition for last item", () => {
            scrollToIndex(mockCtx, mockState, { index: 9, viewPosition: 0.5 });

            expect(mockState.scrollingTo?.viewPosition).toBe(0.5);
        });

        it("should default viewPosition to 0 for non-last items", () => {
            scrollToIndex(mockCtx, mockState, { index: 3 });

            expect(mockState.scrollingTo?.viewPosition).toBe(0);
        });

        it("should use provided viewPosition for non-last items", () => {
            scrollToIndex(mockCtx, mockState, { index: 3, viewPosition: 0.7 });

            expect(mockState.scrollingTo?.viewPosition).toBe(0.7);
        });
    });

    describe("animation handling", () => {
        it("should use animated=true by default", () => {
            scrollToIndex(mockCtx, mockState, { index: 3 });

            expect(mockScrollCalls[0].animated).toBe(true);
        });

        it("should respect animated=false", () => {
            scrollToIndex(mockCtx, mockState, { animated: false, index: 3 });

            expect(mockScrollCalls[0].animated).toBe(false);
        });

        it("should respect animated=true explicitly", () => {
            scrollToIndex(mockCtx, mockState, { animated: true, index: 3 });

            expect(mockScrollCalls[0].animated).toBe(true);
        });
    });

    describe("horizontal scrolling", () => {
        beforeEach(() => {
            mockState.props.horizontal = true;
        });

        it("should scroll horizontally when horizontal=true", () => {
            scrollToIndex(mockCtx, mockState, { index: 3 });

            expect(mockScrollCalls[0].x).toBe(300); // Horizontal position
            expect(mockScrollCalls[0].y).toBe(0); // No vertical scroll
        });

        it("should apply viewOffset horizontally", () => {
            scrollToIndex(mockCtx, mockState, { index: 3, viewOffset: 50 });

            expect(mockScrollCalls[0].x).toBe(200); // viewOffset applied twice: (300 - 50) - 50 = 200
            expect(mockScrollCalls[0].y).toBe(0);
        });
    });

    describe("state management", () => {
        it("should clear scrollForNextCalculateItemsInView", () => {
            mockState.scrollForNextCalculateItemsInView = { bottom: 200, top: 100 };

            scrollToIndex(mockCtx, mockState, { index: 3 });

            expect(mockState.scrollForNextCalculateItemsInView).toBeUndefined();
        });

        it("should set scrollingTo state", () => {
            scrollToIndex(mockCtx, mockState, { animated: false, index: 3, viewOffset: 50 });

            expect(mockState.scrollingTo).toEqual({
                animated: false,
                index: 3,
                offset: expect.any(Number),
                viewOffset: 50,
                viewPosition: 0,
            });
        });

        it("should clear scroll history", () => {
            mockState.scrollHistory = [
                { scroll: 100, time: Date.now() },
                { scroll: 200, time: Date.now() },
            ];

            scrollToIndex(mockCtx, mockState, { index: 3 });

            expect(mockState.scrollHistory.length).toBe(0);
        });

        it("should set scrollPending", () => {
            scrollToIndex(mockCtx, mockState, { index: 3 });

            expect(typeof mockState.scrollPending).toBe("number");
            expect(mockState.scrollPending).toBeGreaterThanOrEqual(0);
        });

        it("should update scroll position for non-animated scrolls", async () => {
            scrollToIndex(mockCtx, mockState, { animated: false, index: 3 });

            expect(typeof mockState.scroll).toBe("number");
            expect(mockState.scroll).toBeGreaterThanOrEqual(0);
        });
    });

    describe("edge cases and error handling", () => {
        it("should handle missing refScroller gracefully", () => {
            mockState.refScroller = { current: null };

            expect(() => {
                scrollToIndex(mockCtx, mockState, { index: 3 });
            }).not.toThrow();

            // Should still update state even if scroll fails
            expect(mockState.scrollingTo?.index).toBe(3);
        });

        it("should handle undefined refScroller", () => {
            mockState.refScroller = undefined as any;

            expect(() => {
                scrollToIndex(mockCtx, mockState, { index: 3 });
            }).toThrow();
        });

        it("should handle corrupted positions map", () => {
            mockState.positions = null as any;

            expect(() => {
                scrollToIndex(mockCtx, mockState, { index: 3 });
            }).toThrow();
        });

        it("should handle large index values", () => {
            const largeIndex = Number.MAX_SAFE_INTEGER;

            scrollToIndex(mockCtx, mockState, { index: largeIndex });

            // Should clamp to last valid index
            expect(mockState.scrollingTo?.index).toBe(9);
        });

        it("should handle floating point index values", () => {
            scrollToIndex(mockCtx, mockState, { index: 3.7 });

            // Should use the index as-is (will be clamped during calculation)
            expect(mockState.scrollingTo?.index).toBe(3.7);
        });

        it("should handle very large viewOffset values", () => {
            scrollToIndex(mockCtx, mockState, { index: 3, viewOffset: Number.MAX_SAFE_INTEGER });

            expect(mockScrollCalls.length).toBe(1);
            // Should handle the calculation without overflow
            expect(typeof mockScrollCalls[0].y).toBe("number");
        });

        it("should handle NaN index", () => {
            scrollToIndex(mockCtx, mockState, { index: NaN });

            // NaN comparisons should handle gracefully
            expect(mockScrollCalls.length).toBe(1);
        });

        it("should handle Infinity index", () => {
            scrollToIndex(mockCtx, mockState, { index: Number.POSITIVE_INFINITY });

            // Should clamp to last valid index
            expect(mockState.scrollingTo?.index).toBe(9);
        });
    });

    describe("performance and complex scenarios", () => {
        it("should handle rapid consecutive scrollToIndex calls", () => {
            const start = Date.now();

            for (let i = 0; i < 100; i++) {
                scrollToIndex(mockCtx, mockState, { index: i % 10 });
            }

            const duration = Date.now() - start;
            expect(duration).toBeLessThan(50); // Should be very fast
            expect(mockScrollCalls.length).toBe(100);
        });

        it("should handle large datasets efficiently", () => {
            // Create a large dataset
            const largeData = Array.from({ length: 10000 }, (_, i) => ({ id: i }));
            mockState.props.data = largeData;

            // Setup positions for large dataset (only what we need)
            const targetIndex = 5000;
            const itemId = `item_${targetIndex}`;
            mockState.idCache.set(targetIndex, itemId);
            mockState.positions.set(itemId, targetIndex * 100);

            const start = Date.now();
            scrollToIndex(mockCtx, mockState, { index: targetIndex });
            const duration = Date.now() - start;

            expect(duration).toBeLessThan(10); // Should be very fast even with large dataset
            expect(mockState.scrollingTo?.index).toBe(targetIndex);
        });

        it("should handle complex offset scenarios", () => {
            // Complex scenario with padding, header, viewOffset, and viewPosition
            mockCtx.values.set("stylePaddingTop", 25);
            mockCtx.values.set("headerSize", 75);

            scrollToIndex(mockCtx, mockState, {
                animated: false,
                index: 5,
                viewOffset: 30,
                viewPosition: 0.5,
            });

            expect(mockScrollCalls.length).toBe(1);
            expect(mockState.scrollingTo).toEqual({
                animated: false,
                index: 5,
                offset: expect.any(Number),
                viewOffset: 30,
                viewPosition: 0.5,
            });

            // Complex calculation:
            // 1. calculateOffsetForIndex: position(500) + padding(25) + header(75) = 600
            // 2. scrollToIndex: firstIndexScrollPosition = 600 - viewOffset(30) = 570
            // 3. calculateOffsetWithOffsetPosition:
            //    - offset = 570 - viewOffset(30) = 540
            //    - offset -= viewPosition(0.5) * (scrollLength(1000) - itemSize(100)) = 540 - 0.5 * 900 = 540 - 450 = 90
            expect(mockScrollCalls[0].y).toBe(90);
        });

        it("should maintain state consistency across multiple calls", () => {
            // First scroll
            scrollToIndex(mockCtx, mockState, { animated: false, index: 3 });
            const firstScrollTo = { ...mockState.scrollingTo };

            // Second scroll
            scrollToIndex(mockCtx, mockState, { index: 7, viewOffset: 50 });
            const secondScrollTo = { ...mockState.scrollingTo };

            expect(firstScrollTo.index).toBe(3);
            expect(secondScrollTo.index).toBe(7);
            expect(secondScrollTo.viewOffset).toBe(50);
            expect(mockScrollCalls.length).toBe(2);
        });

        it("should handle mixed horizontal and vertical configurations", () => {
            // Test switching between horizontal and vertical
            mockState.props.horizontal = false;
            scrollToIndex(mockCtx, mockState, { index: 3 });

            expect(mockScrollCalls[0].x).toBe(0);
            expect(mockScrollCalls[0].y).toBe(300);

            mockState.props.horizontal = true;
            scrollToIndex(mockCtx, mockState, { index: 5 });

            expect(mockScrollCalls[1].x).toBe(500);
            expect(mockScrollCalls[1].y).toBe(0);
        });
    });
});
