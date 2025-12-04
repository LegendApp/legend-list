import { beforeEach, describe, expect, it } from "bun:test";
import "../setup"; // Import global test setup

import { calculateOffsetForIndex } from "../../src/core/calculateOffsetForIndex";
import type { StateContext } from "../../src/state/state";
import type { InternalState } from "../../src/types";
import { createMockContext } from "../__mocks__/createMockContext";
import { createMockState } from "../__mocks__/createMockState";

describe("calculateOffsetForIndex", () => {
    let mockCtx: StateContext;
    let mockState: InternalState;

    beforeEach(() => {
        // Create mock context
        mockCtx = createMockContext();

        // Create mock state with basic setup
        mockState = createMockState({
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
                keyExtractor: (_: any, index: number) => `item_${index}`,
            },
        });
    });

    describe("basic functionality", () => {
        it("should return 0 when index is undefined", () => {
            const result = calculateOffsetForIndex(mockCtx, mockState, undefined);
            expect(result).toBe(0);
        });

        it("should return position for valid index", () => {
            const result = calculateOffsetForIndex(mockCtx, mockState, 1);
            expect(result).toBe(100);
        });

        it("should return 0 for index not in positions map", () => {
            const result = calculateOffsetForIndex(mockCtx, mockState, 10);
            expect(result).toBe(0);
        });

        it("should handle index 0 correctly", () => {
            const result = calculateOffsetForIndex(mockCtx, mockState, 0);
            expect(result).toBe(0);
        });
    });

    describe("padding top integration", () => {
        it("should add stylePaddingTop to position", () => {
            mockCtx.values.set("stylePaddingTop", 50);

            const result = calculateOffsetForIndex(mockCtx, mockState, 1);
            expect(result).toBe(150); // 100 + 50
        });

        it("should handle zero stylePaddingTop", () => {
            mockCtx.values.set("stylePaddingTop", 0);

            const result = calculateOffsetForIndex(mockCtx, mockState, 1);
            expect(result).toBe(100);
        });

        it("should handle negative stylePaddingTop", () => {
            mockCtx.values.set("stylePaddingTop", -25);

            const result = calculateOffsetForIndex(mockCtx, mockState, 1);
            expect(result).toBe(75); // 100 - 25
        });

        it("should not add stylePaddingTop when it's null/undefined", () => {
            mockCtx.values.set("stylePaddingTop", null);

            const result = calculateOffsetForIndex(mockCtx, mockState, 1);
            expect(result).toBe(100);
        });
    });

    describe("header size integration", () => {
        it("should add headerSize to position", () => {
            mockCtx.values.set("headerSize", 75);

            const result = calculateOffsetForIndex(mockCtx, mockState, 1);
            expect(result).toBe(175); // 100 + 75
        });

        it("should handle zero headerSize", () => {
            mockCtx.values.set("headerSize", 0);

            const result = calculateOffsetForIndex(mockCtx, mockState, 1);
            expect(result).toBe(100);
        });

        it("should handle negative headerSize", () => {
            mockCtx.values.set("headerSize", -30);

            const result = calculateOffsetForIndex(mockCtx, mockState, 1);
            expect(result).toBe(70); // 100 - 30
        });

        it("should not add headerSize when it's null/undefined", () => {
            mockCtx.values.set("headerSize", null);

            const result = calculateOffsetForIndex(mockCtx, mockState, 1);
            expect(result).toBe(100);
        });
    });

    describe("combined offsets", () => {
        it("should add both stylePaddingTop and headerSize", () => {
            mockCtx.values.set("stylePaddingTop", 25);
            mockCtx.values.set("headerSize", 40);

            const result = calculateOffsetForIndex(mockCtx, mockState, 2);
            expect(result).toBe(315); // 250 + 25 + 40
        });

        it("should handle both negative values", () => {
            mockCtx.values.set("stylePaddingTop", -10);
            mockCtx.values.set("headerSize", -20);

            const result = calculateOffsetForIndex(mockCtx, mockState, 2);
            expect(result).toBe(220); // 250 - 10 - 20
        });

        it("should handle mixed positive/negative values", () => {
            mockCtx.values.set("stylePaddingTop", 30);
            mockCtx.values.set("headerSize", -15);

            const result = calculateOffsetForIndex(mockCtx, mockState, 2);
            expect(result).toBe(265); // 250 + 30 - 15
        });

        it("should handle undefined index with offsets", () => {
            mockCtx.values.set("stylePaddingTop", 25);
            mockCtx.values.set("headerSize", 40);

            const result = calculateOffsetForIndex(mockCtx, mockState, undefined);
            // Implementation returns 0 when index is undefined
            expect(result).toBe(0);
        });
    });

    describe("edge cases and error handling", () => {
        it("should handle null state gracefully", () => {
            // Function may handle null state without throwing
            const result = calculateOffsetForIndex(mockCtx, null as any, 1);
            expect(result).toBeDefined();
        });

        it("should handle corrupted positions map", () => {
            mockState.positions = null as any;

            expect(() => {
                calculateOffsetForIndex(mockCtx, mockState, 1);
            }).toThrow();
        });

        it("should handle negative index", () => {
            const result = calculateOffsetForIndex(mockCtx, mockState, -1);
            expect(result).toBe(0); // getId should handle this gracefully
        });

        it("should handle very large index", () => {
            const result = calculateOffsetForIndex(mockCtx, mockState, 999999);
            expect(result).toBe(0); // Not in positions map
        });

        it("should handle floating point index", () => {
            const result = calculateOffsetForIndex(mockCtx, mockState, 1.5);
            // getId should convert to string "1.5", which won't match "item_1"
            expect(result).toBe(0);
        });

        it("should handle corrupted context values", () => {
            mockCtx.values = null as any;

            expect(() => {
                calculateOffsetForIndex(mockCtx, mockState, 1);
            }).toThrow();
        });
    });

    describe("keyExtractor integration", () => {
        it("should work with custom keyExtractor", () => {
            mockState.props.keyExtractor = (item: any) => `custom_${item.id}`;
            mockState.positions = new Map([
                ["custom_item1", 0],
                ["custom_item2", 150],
                ["custom_item3", 300],
            ]);

            const result = calculateOffsetForIndex(mockCtx, mockState, 1);
            expect(result).toBe(150);
        });

        it("should handle keyExtractor returning different types", () => {
            mockState.props.keyExtractor = (_: any, index: number) => index.toString(); // Returns string
            mockState.positions = new Map([
                ["0", 0],
                ["1", 120],
                ["2", 280],
            ]);

            const result = calculateOffsetForIndex(mockCtx, mockState, 1);
            expect(result).toBe(120);
        });
    });

    describe("performance and large datasets", () => {
        it("should handle large position maps efficiently", () => {
            // Create large dataset
            const largePositions = new Map();
            const largeData = [];
            for (let i = 0; i < 10000; i++) {
                largePositions.set(`item_${i}`, i * 100);
                largeData.push({ id: i, text: `Item ${i}` });
            }
            mockState.positions = largePositions;
            mockState.props.data = largeData;

            const start = Date.now();
            const result = calculateOffsetForIndex(mockCtx, mockState, 5000);
            const duration = Date.now() - start;

            expect(result).toBe(500000); // Should find the position in the large map
            expect(duration).toBeLessThan(10); // Should be very fast
        });

        it("should handle rapid consecutive calls", () => {
            const start = Date.now();

            for (let i = 0; i < 1000; i++) {
                calculateOffsetForIndex(mockCtx, mockState, i % 4);
            }

            const duration = Date.now() - start;
            expect(duration).toBeLessThan(50); // Should be very fast for 1000 calls
        });
    });

    describe("real world scenarios", () => {
        it("should handle chat interface pattern (alignItemsAtEnd)", () => {
            // Simulate chat UI with padding top for bottom alignment
            mockCtx.values.set("stylePaddingTop", 200); // Space above messages
            mockCtx.values.set("headerSize", 0);

            const result = calculateOffsetForIndex(mockCtx, mockState, 2);
            expect(result).toBe(450); // 250 + 200
        });

        it("should handle list with sticky header", () => {
            mockCtx.values.set("headerSize", 60); // Sticky header
            mockCtx.values.set("stylePaddingTop", 10); // Additional spacing

            const result = calculateOffsetForIndex(mockCtx, mockState, 1);
            expect(result).toBe(170); // 100 + 60 + 10
        });

        it("should handle infinite scroll loading state", () => {
            // When loading, headerSize might be negative to account for loading indicator
            mockCtx.values.set("headerSize", -40); // Loading indicator adjustment

            const result = calculateOffsetForIndex(mockCtx, mockState, 0);
            expect(result).toBe(-40); // 0 + 0 - 40
        });
    });

    describe("integration with getId function", () => {
        it("should respect getId behavior for out of bounds", () => {
            // getId should handle out of bounds gracefully
            const result = calculateOffsetForIndex(mockCtx, mockState, 100);
            expect(result).toBe(0); // Default when key not found
        });

        it("should work when positions map has mixed key types", () => {
            mockState.positions = new Map([
                ["item_0", 0],
                ["1", 100], // String key
                ["item_2", 250],
                ["custom", 400],
            ]);

            // This should use getId which converts to "item_1" - won't match number 1
            const result = calculateOffsetForIndex(mockCtx, mockState, 1);
            expect(result).toBe(0);
        });
    });
});
