import { beforeEach, describe, expect, it } from "bun:test";
import "../setup"; // Import global test setup

import { calculateOffsetForIndex } from "../../src/core/calculateOffsetForIndex";
import type { StateContext } from "../../src/state/state";
import type { InternalState } from "../../src/types";
import { createMockContext } from "../__mocks__/createMockContext";

describe("calculateOffsetForIndex", () => {
    let mockCtx: StateContext;
    let mockState: InternalState;

    beforeEach(() => {
        mockCtx = createMockContext(
            {},
            {
                positions: [0, 100, 250, 400],
                props: {
                    data: [
                        { id: "item1", name: "First" },
                        { id: "item2", name: "Second" },
                        { id: "item3", name: "Third" },
                        { id: "item4", name: "Fourth" },
                    ],
                    keyExtractor: (_: any, index: number) => `item_${index}`,
                },
            },
        );
        mockState = mockCtx.state;
    });

    describe("basic functionality", () => {
        it("should return 0 when index is undefined", () => {
            const result = calculateOffsetForIndex(mockCtx, undefined);
            expect(result).toBe(0);
        });

        it("should return position for valid index", () => {
            const result = calculateOffsetForIndex(mockCtx, 1);
            expect(result).toBe(100);
        });

        it("should return 0 for index not in positions map", () => {
            const result = calculateOffsetForIndex(mockCtx, 10);
            expect(result).toBe(0);
        });

        it("should handle index 0 correctly", () => {
            const result = calculateOffsetForIndex(mockCtx, 0);
            expect(result).toBe(0);
        });
    });

    describe("padding top exclusion", () => {
        it("should not add stylePaddingTop to position", () => {
            mockCtx.values.set("stylePaddingTop", 50);

            const result = calculateOffsetForIndex(mockCtx, 1);
            expect(result).toBe(100);
        });

        it("should handle zero stylePaddingTop", () => {
            mockCtx.values.set("stylePaddingTop", 0);

            const result = calculateOffsetForIndex(mockCtx, 1);
            expect(result).toBe(100);
        });

        it("should ignore negative stylePaddingTop", () => {
            mockCtx.values.set("stylePaddingTop", -25);

            const result = calculateOffsetForIndex(mockCtx, 1);
            expect(result).toBe(100);
        });

        it("should not add stylePaddingTop when it's null/undefined", () => {
            mockCtx.values.set("stylePaddingTop", null);

            const result = calculateOffsetForIndex(mockCtx, 1);
            expect(result).toBe(100);
        });
    });

    describe("header size exclusion", () => {
        it("should not add headerSize to position", () => {
            mockCtx.values.set("headerSize", 75);

            const result = calculateOffsetForIndex(mockCtx, 1);
            expect(result).toBe(100);
        });

        it("should handle zero headerSize", () => {
            mockCtx.values.set("headerSize", 0);

            const result = calculateOffsetForIndex(mockCtx, 1);
            expect(result).toBe(100);
        });

        it("should ignore negative headerSize", () => {
            mockCtx.values.set("headerSize", -30);

            const result = calculateOffsetForIndex(mockCtx, 1);
            expect(result).toBe(100);
        });

        it("should not add headerSize when it's null/undefined", () => {
            mockCtx.values.set("headerSize", null);

            const result = calculateOffsetForIndex(mockCtx, 1);
            expect(result).toBe(100);
        });
    });

    describe("combined offsets", () => {
        it("should ignore stylePaddingTop and headerSize when both are provided", () => {
            mockCtx.values.set("stylePaddingTop", 25);
            mockCtx.values.set("headerSize", 40);

            const result = calculateOffsetForIndex(mockCtx, 2);
            expect(result).toBe(250);
        });

        it("should handle both negative values", () => {
            mockCtx.values.set("stylePaddingTop", -10);
            mockCtx.values.set("headerSize", -20);

            const result = calculateOffsetForIndex(mockCtx, 2);
            expect(result).toBe(250);
        });

        it("should handle mixed positive/negative values", () => {
            mockCtx.values.set("stylePaddingTop", 30);
            mockCtx.values.set("headerSize", -15);

            const result = calculateOffsetForIndex(mockCtx, 2);
            expect(result).toBe(250);
        });

        it("should handle undefined index with offsets", () => {
            mockCtx.values.set("stylePaddingTop", 25);
            mockCtx.values.set("headerSize", 40);

            const result = calculateOffsetForIndex(mockCtx, undefined);
            // Implementation returns 0 when index is undefined
            expect(result).toBe(0);
        });
    });

    describe("edge cases and error handling", () => {
        it("should handle negative index", () => {
            const result = calculateOffsetForIndex(mockCtx, -1);
            expect(result).toBe(0); // getId should handle this gracefully
        });

        it("should handle very large index", () => {
            const result = calculateOffsetForIndex(mockCtx, 999999);
            expect(result).toBe(0); // Not in positions map
        });

        it("should handle floating point index", () => {
            const result = calculateOffsetForIndex(mockCtx, 1.5);
            // getId should convert to string "1.5", which won't match "item_1"
            expect(result).toBe(0);
        });
    });

    describe("keyExtractor integration", () => {
        it("should work with custom keyExtractor", () => {
            mockState.props.keyExtractor = (item: any) => `custom_${item.id}`;
            mockState.positions = [0, 150, 300];

            const result = calculateOffsetForIndex(mockCtx, 1);
            expect(result).toBe(150);
        });

        it("should handle keyExtractor returning different types", () => {
            mockState.props.keyExtractor = (_: any, index: number) => index.toString(); // Returns string
            mockState.positions = [0, 120, 280];

            const result = calculateOffsetForIndex(mockCtx, 1);
            expect(result).toBe(120);
        });
    });

    describe("large datasets", () => {
        it("returns exact offsets from a large populated positions array", () => {
            const largePositions: Array<number | undefined> = [];
            const largeData = [];
            for (let i = 0; i < 10000; i++) {
                largePositions[i] = i * 100;
                largeData.push({ id: i, text: `Item ${i}` });
            }
            mockState.positions = largePositions;
            mockState.props.data = largeData;

            expect(calculateOffsetForIndex(mockCtx, 5000)).toBe(500000);
            expect(calculateOffsetForIndex(mockCtx, 9999)).toBe(999900);
        });
    });

    describe("real world scenarios", () => {
        it("should handle chat interface pattern (extra top inset)", () => {
            // Simulate chat UI with extra top inset
            mockCtx.values.set("stylePaddingTop", 200); // Space above messages
            mockCtx.values.set("headerSize", 0);

            const result = calculateOffsetForIndex(mockCtx, 2);
            expect(result).toBe(250);
        });

        it("should handle list with sticky header", () => {
            mockCtx.values.set("headerSize", 60); // Sticky header
            mockCtx.values.set("stylePaddingTop", 10); // Additional spacing

            const result = calculateOffsetForIndex(mockCtx, 1);
            expect(result).toBe(100);
        });

        it("should handle infinite scroll loading state", () => {
            // When loading, headerSize might be negative to account for loading indicator
            mockCtx.values.set("headerSize", -40); // Loading indicator adjustment

            const result = calculateOffsetForIndex(mockCtx, 0);
            expect(result).toBe(0);
        });
    });

    describe("integration with getId function", () => {
        it("should respect getId behavior for out of bounds", () => {
            // getId should handle out of bounds gracefully
            const result = calculateOffsetForIndex(mockCtx, 100);
            expect(result).toBe(0); // Default when key not found
        });

        it("should work when positions has sparse/missing entries", () => {
            mockState.positions = [0, undefined, 250, 400];

            const result = calculateOffsetForIndex(mockCtx, 1);
            expect(result).toBe(0);
        });
    });
});
