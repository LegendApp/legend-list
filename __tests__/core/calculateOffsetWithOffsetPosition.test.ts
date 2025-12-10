import { beforeEach, describe, expect, it } from "bun:test";
import "../setup"; // Import global test setup

import { calculateOffsetWithOffsetPosition } from "../../src/core/calculateOffsetWithOffsetPosition";
import type { StateContext } from "../../src/state/state";
import type { InternalState, ScrollIndexWithOffsetPosition } from "../../src/types";
import { createMockContext } from "../__mocks__/createMockContext";

describe("calculateOffsetWithOffsetPosition", () => {
    let mockState: InternalState;
    let mockCtx: StateContext;
    const callCalculateOffset = (offset: number, params: Partial<ScrollIndexWithOffsetPosition>) =>
        calculateOffsetWithOffsetPosition(mockCtx, offset, params);

    beforeEach(() => {
        mockCtx = createMockContext(
            { scrollingTo: undefined },
            {
                positions: new Map([
                    ["item_0", 0],
                    ["item_1", 100],
                    ["item_2", 250],
                    ["item_3", 400],
                ]),
                props: {
                    data: [
                        { id: "item1", name: "First" },
                        { id: "item2", name: "Second" },
                        { id: "item3", name: "Third" },
                        { id: "item4", name: "Fourth" },
                    ],
                    estimatedItemSize: 100,
                    keyExtractor: (_item: any, index: number) => `item_${index}`,
                },
                scrollLength: 400, // Viewport height/width
                sizesKnown: new Map([
                    ["item_0", 80],
                    ["item_1", 120],
                    ["item_2", 90],
                    ["item_3", 110],
                ]),
            },
        );
        mockState = mockCtx.state;
    });

    describe("basic functionality", () => {
        it("should return original offset when no adjustments needed", () => {
            const result = callCalculateOffset(100, {});
            expect(result).toBe(100);
        });

        it("should handle empty params object", () => {
            const result = callCalculateOffset(250, {});
            expect(result).toBe(250);
        });

        it("should handle all undefined params", () => {
            const params: Partial<ScrollIndexWithOffsetPosition> = {
                index: undefined,
                viewOffset: undefined,
                viewPosition: undefined,
            };
            const result = callCalculateOffset(150, params);
            expect(result).toBe(150);
        });
    });

    describe("viewOffset handling", () => {
        it("should subtract viewOffset from offset", () => {
            const params = { viewOffset: 50 };
            const result = callCalculateOffset(200, params);
            expect(result).toBe(150); // 200 - 50
        });

        it("should handle zero viewOffset", () => {
            const params = { viewOffset: 0 };
            const result = callCalculateOffset(200, params);
            expect(result).toBe(200);
        });

        it("should handle negative viewOffset", () => {
            const params = { viewOffset: -30 };
            const result = callCalculateOffset(200, params);
            expect(result).toBe(230); // 200 - (-30)
        });

        it("should handle large viewOffset", () => {
            const params = { viewOffset: 1000 };
            const result = callCalculateOffset(200, params);
            expect(result).toBe(-800); // 200 - 1000
        });
    });

    describe("viewPosition handling", () => {
        it("should adjust offset based on viewPosition when index provided", () => {
            const params = {
                index: 1,
                viewPosition: 0.5, // Middle of viewport
            };
            // scrollLength = 400, item size = 120 (from sizesKnown)
            // adjustment = 0.5 * (400 - 120) = 0.5 * 280 = 140
            const result = callCalculateOffset(200, params);
            expect(result).toBe(60); // 200 - 140
        });

        it("should handle viewPosition = 0 (top of viewport)", () => {
            const params = {
                index: 1,
                viewPosition: 0,
            };
            // adjustment = 0 * (400 - 120) = 0
            const result = callCalculateOffset(200, params);
            expect(result).toBe(200); // 200 - 0
        });

        it("should handle viewPosition = 1 (bottom of viewport)", () => {
            const params = {
                index: 1,
                viewPosition: 1,
            };
            // adjustment = 1 * (400 - 120) = 280
            const result = callCalculateOffset(200, params);
            expect(result).toBe(-80); // 200 - 280
        });

        it("should account for bottom contentInset when aligning to bottom", () => {
            mockState.props.contentInset = { bottom: 40, left: 0, right: 0, top: 0 };
            const params = {
                index: 1,
                viewPosition: 1,
            };
            // adjustment = 1 * (400 - 40 - 120) = 240
            const result = callCalculateOffset(200, params);
            expect(result).toBe(-40); // 200 - 240
        });

        it("should respect right contentInset for horizontal lists", () => {
            mockState.props.horizontal = true;
            mockState.props.contentInset = { bottom: 0, left: 0, right: 30, top: 0 };

            const params = {
                index: 1,
                viewPosition: 1,
            };
            // adjustment = 1 * (400 - 30 - 120) = 250
            const result = callCalculateOffset(200, params);
            expect(result).toBe(-50); // 200 - 250
        });

        it("should not adjust when viewPosition provided but index is undefined", () => {
            const params = {
                viewPosition: 0.5,
                // index: undefined
            };
            const result = callCalculateOffset(200, params);
            expect(result).toBe(200); // No adjustment
        });

        it("should not adjust when index provided but viewPosition is undefined", () => {
            const params = {
                index: 1,
                // viewPosition: undefined
            };
            const result = callCalculateOffset(200, params);
            expect(result).toBe(200); // No adjustment
        });
    });

    describe("combined viewOffset and viewPosition", () => {
        it("should apply both viewOffset and viewPosition adjustments", () => {
            const params = {
                index: 1,
                viewOffset: 50,
                viewPosition: 0.5,
            };
            // viewOffset adjustment: -50
            // viewPosition adjustment: -140 (0.5 * (400 - 120))
            // total: 200 - 50 - 140 = 10
            const result = callCalculateOffset(200, params);
            expect(result).toBe(10);
        });

        it("should handle negative viewOffset with viewPosition", () => {
            const params = {
                index: 0,
                viewOffset: -25,
                viewPosition: 0.25,
            };
            // viewOffset adjustment: -(-25) = +25
            // item size for index 0 = 80 (from sizesKnown)
            // viewPosition adjustment: -80 (0.25 * (400 - 80))
            // total: 150 + 25 - 80 = 95
            const result = callCalculateOffset(150, params);
            expect(result).toBe(95);
        });
    });

    describe("item size calculation", () => {
        it("should use cached size when available", () => {
            const params = {
                index: 2,
                viewPosition: 0.5,
            };
            // Cached size for item_2 is 90
            // adjustment = 0.5 * (400 - 90) = 155
            const result = callCalculateOffset(200, params);
            expect(result).toBe(45); // 200 - 155
        });

        it("should fall back to estimated size when not cached", () => {
            // Remove from cache
            mockState.sizesKnown.delete("item_1");

            const params = {
                index: 1,
                viewPosition: 0.5,
            };
            // Should use estimatedItemSize = 100
            // adjustment = 0.5 * (400 - 100) = 150
            const result = callCalculateOffset(200, params);
            expect(result).toBe(50); // 200 - 150
        });

        it("should handle item size larger than scrollLength", () => {
            mockState.sizesKnown.set("item_1", 500); // Larger than scrollLength (400)

            const params = {
                index: 1,
                viewPosition: 0.5,
            };
            // adjustment = 0.5 * (400 - 500) = 0.5 * (-100) = -50
            const result = callCalculateOffset(200, params);
            expect(result).toBe(250); // 200 - (-50)
        });
    });

    describe("edge cases and error handling", () => {
        it("should handle null state gracefully", () => {
            const result = calculateOffsetWithOffsetPosition(mockCtx, 100, {});
            expect(result).toBe(100); // No adjustments applied when state is null
        });

        it("should handle out of bounds index", () => {
            const params = {
                index: 10, // Out of bounds
                viewPosition: 0.5,
            };
            // Should fall back to estimatedItemSize since getItemSize handles this
            const result = callCalculateOffset(200, params);
            expect(result).toBe(50); // 200 - (0.5 * (400 - 100))
        });

        it("should handle negative index", () => {
            const params = {
                index: -1,
                viewPosition: 0.5,
            };
            // Should fall back to estimatedItemSize
            const result = callCalculateOffset(200, params);
            expect(result).toBe(50); // 200 - (0.5 * (400 - 100))
        });

        it("should handle viewPosition outside 0-1 range", () => {
            const params = {
                index: 1,
                viewPosition: 1.5, // > 1
            };
            // adjustment = 1.5 * (400 - 120) = 420
            const result = callCalculateOffset(200, params);
            expect(result).toBe(-220); // 200 - 420
        });

        it("should handle negative viewPosition", () => {
            const params = {
                index: 1,
                viewPosition: -0.5,
            };
            // adjustment = -0.5 * (400 - 120) = -140
            const result = callCalculateOffset(200, params);
            expect(result).toBe(340); // 200 - (-140)
        });

        it("should handle zero scrollLength", () => {
            mockState.scrollLength = 0;

            const params = {
                index: 1,
                viewPosition: 0.5,
            };
            // adjustment = 0.5 * (0 - 120) = -60
            const result = callCalculateOffset(200, params);
            expect(result).toBe(260); // 200 - (-60)
        });

        it("should handle corrupted cached sizes", () => {
            mockState.sizesKnown = null as any;

            const params = {
                index: 1,
                viewPosition: 0.5,
            };
            // Should throw when sizesKnown is null
            expect(() => {
                callCalculateOffset(200, params);
            }).toThrow();
        });

        it("should handle missing estimatedItemSize", () => {
            mockState.props.estimatedItemSize = undefined;
            mockState.sizesKnown.delete("item_1");

            const params = {
                index: 1,
                viewPosition: 0.5,
            };
            // getItemSize should handle this gracefully
            const result = callCalculateOffset(200, params);
            expect(typeof result).toBe("number");
        });
    });

    describe("performance and large datasets", () => {
        it("should handle large datasets efficiently", () => {
            // Create large dataset
            const largeData = Array.from({ length: 10000 }, (_, i) => ({
                id: `item${i}`,
                name: `Item ${i}`,
            }));
            mockState.props.data = largeData;

            const start = Date.now();

            for (let i = 0; i < 100; i++) {
                callCalculateOffset(200, {
                    index: i,
                    viewOffset: 25,
                    viewPosition: 0.5,
                });
            }

            const duration = Date.now() - start;
            expect(duration).toBeLessThan(50); // Should be fast for 100 calculations
        });

        it("should handle rapid consecutive calls", () => {
            const start = Date.now();

            for (let i = 0; i < 1000; i++) {
                callCalculateOffset(i, {
                    index: i % 4,
                    viewOffset: i % 10,
                    viewPosition: (i % 100) / 100,
                });
            }

            const duration = Date.now() - start;
            expect(duration).toBeLessThan(100); // Should be very fast
        });
    });

    describe("real world scenarios", () => {
        it("should handle scrollToIndex with center positioning", () => {
            // Typical scrollToIndex to center an item
            const params = {
                index: 2,
                viewOffset: 0,
                viewPosition: 0.5, // Center item in viewport
            };
            // Item size = 90, scrollLength = 400
            // adjustment = 0.5 * (400 - 90) = 155
            const result = callCalculateOffset(250, params);
            expect(result).toBe(95); // 250 - 155
        });

        it("should handle scrollToIndex with top positioning", () => {
            const params = {
                index: 1,
                viewOffset: 10, // Small margin from top
                viewPosition: 0, // Align to top
            };
            // viewPosition adjustment = 0 * (400 - 120) = 0
            const result = callCalculateOffset(100, params);
            expect(result).toBe(90); // 100 - 10 - 0
        });

        it("should handle scrollToIndex with bottom positioning", () => {
            const params = {
                index: 3,
                viewOffset: -20, // Negative to push up from bottom
                viewPosition: 1, // Align to bottom
            };
            // Item size = 110, adjustment = 1 * (400 - 110) = 290
            const result = callCalculateOffset(400, params);
            expect(result).toBe(130); // 400 - (-20) - 290
        });

        it("should handle chat interface scroll to end", () => {
            // In chat UI, scrolling to show new message at bottom
            const params = {
                index: 3, // Last message
                viewOffset: 0,
                viewPosition: 1, // Bottom of viewport
            };
            const result = callCalculateOffset(400, params);
            expect(result).toBe(110); // 400 - (1 * (400 - 110))
        });

        it("should handle infinite scroll positioning", () => {
            // When loading new items, maintain position relative to a specific item
            const params = {
                index: 1,
                viewOffset: 50, // Account for loading indicator
                viewPosition: 0.3, // Specific position in viewport
            };
            // adjustment = 0.3 * (400 - 120) = 84
            const result = callCalculateOffset(200, params);
            expect(result).toBe(66); // 200 - 50 - 84
        });
    });

    describe("floating point precision", () => {
        it("should handle floating point viewPosition values", () => {
            const params = {
                index: 1,
                viewPosition: 0.333333, // Precise floating point
            };
            // adjustment = 0.333333 * (400 - 120) = 93.33324
            const result = callCalculateOffset(200, params);
            expect(result).toBeCloseTo(106.67, 2); // 200 - 93.33
        });

        it("should handle very small viewPosition values", () => {
            const params = {
                index: 1,
                viewPosition: 0.001,
            };
            const result = callCalculateOffset(200, params);
            expect(result).toBeCloseTo(199.72, 2); // Very small adjustment
        });
    });

    describe("integration with getItemSize", () => {
        it("should use getItemSize for unknown items", () => {
            // Clear cached size and add to data but not cache
            mockState.sizesKnown.delete("item_1");

            const params = {
                index: 1,
                viewPosition: 0.5,
            };
            // Should use estimatedItemSize or getItemSize fallback
            const result = callCalculateOffset(200, params);
            expect(typeof result).toBe("number");
        });

        it("should handle getItemSize with different data types", () => {
            mockState.props = { ...mockState.props, data: [...mockState.props.data] };
            (mockState.props.data as any)[1] = { size: 150 }; // Different structure

            const params = {
                index: 1,
                viewPosition: 0.5,
            };
            const result = callCalculateOffset(200, params);
            expect(typeof result).toBe("number");
        });
    });
});
