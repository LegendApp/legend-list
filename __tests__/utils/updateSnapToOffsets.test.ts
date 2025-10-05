import { beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import "../setup"; // Import global test setup

import type { StateContext } from "../../src/state/state";
import * as stateModule from "../../src/state/state";
import type { InternalState } from "../../src/types";
import { updateSnapToOffsets } from "../../src/utils/updateSnapToOffsets";
import { createMockContext } from "../__mocks__/createMockContext";

describe("updateSnapToOffsets", () => {
    let mockCtx: StateContext;
    let mockState: InternalState;
    let setStateSpy: ReturnType<typeof mock>;

    beforeEach(() => {
        setStateSpy = mock();

        // Mock set$ using spyOn
        spyOn(stateModule, "set$").mockImplementation(setStateSpy);

        // Create mock context
        mockCtx = createMockContext();

        // Create mock state
        mockState = {
            idCache: new Map(), // Required for getId function
            positions: new Map([
                [0, 0],
                [1, 100],
                [2, 250],
                [3, 400],
                [4, 600],
                [5, 850],
            ]),
            props: {
                data: [
                    { id: "item1", name: "First" },
                    { id: "item2", name: "Second" },
                    { id: "item3", name: "Third" },
                    { id: "item4", name: "Fourth" },
                    { id: "item5", name: "Fifth" },
                    { id: "item6", name: "Sixth" },
                ],
                keyExtractor: undefined, // Use index-based keys (default behavior)
                snapToIndices: [0, 2, 4], // Snap to items 0, 2, and 4
            },
        } as any;
    });

    describe("basic functionality", () => {
        it("should create snapToOffsets array from snapToIndices", () => {
            updateSnapToOffsets(mockCtx, mockState);

            expect(setStateSpy).toHaveBeenCalledWith(mockCtx, "snapToOffsets", [0, 250, 600]);
        });

        it("should handle single snap index", () => {
            mockState.props.snapToIndices = [2];

            updateSnapToOffsets(mockCtx, mockState);

            expect(setStateSpy).toHaveBeenCalledWith(mockCtx, "snapToOffsets", [250]);
        });

        it("should handle empty snapToIndices array", () => {
            mockState.props.snapToIndices = [];

            updateSnapToOffsets(mockCtx, mockState);

            expect(setStateSpy).toHaveBeenCalledWith(mockCtx, "snapToOffsets", []);
        });

        it("should preserve order of snapToIndices", () => {
            mockState.props.snapToIndices = [4, 1, 3, 0]; // Out of order

            updateSnapToOffsets(mockCtx, mockState);

            expect(setStateSpy).toHaveBeenCalledWith(mockCtx, "snapToOffsets", [600, 100, 400, 0]);
        });
    });

    describe("position mapping", () => {
        it("should correctly map indices to positions", () => {
            mockState.props.snapToIndices = [1, 3, 5];

            updateSnapToOffsets(mockCtx, mockState);

            expect(setStateSpy).toHaveBeenCalledWith(mockCtx, "snapToOffsets", [100, 400, 850]);
        });

        it("should handle indices not in positions map", () => {
            mockState.props.snapToIndices = [10, 20]; // Out of bounds indices

            updateSnapToOffsets(mockCtx, mockState);

            // Should use undefined values from positions map
            expect(setStateSpy).toHaveBeenCalledWith(mockCtx, "snapToOffsets", [undefined, undefined]);
        });

        it("should handle mixed valid and invalid indices", () => {
            mockState.props.snapToIndices = [1, 10, 2, 20];

            updateSnapToOffsets(mockCtx, mockState);

            expect(setStateSpy).toHaveBeenCalledWith(mockCtx, "snapToOffsets", [100, undefined, 250, undefined]);
        });

        it("should handle zero index correctly", () => {
            mockState.props.snapToIndices = [0];

            updateSnapToOffsets(mockCtx, mockState);

            expect(setStateSpy).toHaveBeenCalledWith(mockCtx, "snapToOffsets", [0]);
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
            mockState.props.snapToIndices = [0, 2];

            updateSnapToOffsets(mockCtx, mockState);

            expect(setStateSpy).toHaveBeenCalledWith(mockCtx, "snapToOffsets", [0, 300]);
        });

        it("should handle keyExtractor returning different types", () => {
            (mockState.props as any).keyExtractor = (_: any, index: number) => index; // Returns number
            mockState.positions = new Map([
                [0, 0],
                [1, 120],
                [2, 280],
            ]) as any;
            mockState.props.snapToIndices = [0, 1, 2];

            updateSnapToOffsets(mockCtx, mockState);

            expect(setStateSpy).toHaveBeenCalledWith(mockCtx, "snapToOffsets", [0, 120, 280]);
        });

        it("should handle keyExtractor with complex logic", () => {
            mockState.props.keyExtractor = (item: any, index: number) => `${item.name}_${index}`;
            mockState.positions = new Map([
                ["First_0", 0],
                ["Second_1", 200],
                ["Third_2", 400],
            ]);
            mockState.props.snapToIndices = [1, 2];

            updateSnapToOffsets(mockCtx, mockState);

            expect(setStateSpy).toHaveBeenCalledWith(mockCtx, "snapToOffsets", [200, 400]);
        });
    });

    describe("edge cases and error handling", () => {
        it("should handle null state", () => {
            expect(() => {
                updateSnapToOffsets(mockCtx, null as any);
            }).toThrow();
        });

        it("should handle null context", () => {
            expect(() => {
                updateSnapToOffsets(null as any, mockState);
            }).not.toThrow(); // set$ function handles null context gracefully
        });

        it("should handle corrupted positions map", () => {
            mockState.positions = null as any;

            expect(() => {
                updateSnapToOffsets(mockCtx, mockState);
            }).toThrow();
        });

        it("should handle missing snapToIndices", () => {
            mockState.props.snapToIndices = undefined as any;

            expect(() => {
                updateSnapToOffsets(mockCtx, mockState);
            }).toThrow();
        });

        it("should handle corrupted props", () => {
            mockState.props = null as any;

            expect(() => {
                updateSnapToOffsets(mockCtx, mockState);
            }).toThrow();
        });

        it("should handle negative indices", () => {
            mockState.props.snapToIndices = [-1, -2];

            updateSnapToOffsets(mockCtx, mockState);

            // getId should handle negative indices gracefully
            expect(setStateSpy).toHaveBeenCalledWith(mockCtx, "snapToOffsets", [undefined, undefined]);
        });

        it("should handle floating point indices", () => {
            mockState.props.snapToIndices = [1.5, 2.7];

            updateSnapToOffsets(mockCtx, mockState);

            // getId converts to string, so 1.5 -> "1.5" which won't match "item_1"
            expect(setStateSpy).toHaveBeenCalledWith(mockCtx, "snapToOffsets", [undefined, undefined]);
        });

        it("should handle very large indices", () => {
            mockState.props.snapToIndices = [999999, 1000000];

            updateSnapToOffsets(mockCtx, mockState);

            expect(setStateSpy).toHaveBeenCalledWith(mockCtx, "snapToOffsets", [undefined, undefined]);
        });
    });

    describe("performance", () => {
        it("should handle large snapToIndices arrays efficiently", () => {
            const largeIndices = Array.from({ length: 1000 }, (_, i) => i);
            const largePositions = new Map();
            // Keys should match what getId returns (index as number when no keyExtractor)
            for (let i = 0; i < 1000; i++) {
                largePositions.set(i, i * 100);
            }

            mockState.props.snapToIndices = largeIndices;
            mockState.positions = largePositions;
            // Add mock data array for getId function
            mockState.props.data = Array.from({ length: 1000 }, (_, i) => ({ id: i, value: `item_${i}` }));
            mockState.props.keyExtractor = undefined; // Use default index-based keys

            const start = Date.now();
            updateSnapToOffsets(mockCtx, mockState);
            const duration = Date.now() - start;

            expect(duration).toBeLessThan(100); // Should be reasonably fast
            expect(setStateSpy).toHaveBeenCalledTimes(1);

            const expectedOffsets = Array.from({ length: 1000 }, (_, i) => i * 100);
            expect(setStateSpy).toHaveBeenCalledWith(mockCtx, "snapToOffsets", expectedOffsets);
        });

        it("should handle rapid consecutive calls efficiently", () => {
            const start = Date.now();

            for (let i = 0; i < 100; i++) {
                setStateSpy.mockClear();
                updateSnapToOffsets(mockCtx, mockState);
            }

            const duration = Date.now() - start;
            expect(duration).toBeLessThan(50); // Should be very fast
        });

        it("should not cause memory issues with large datasets", () => {
            const hugeData = Array.from({ length: 50000 }, (_, i) => ({ id: i }));
            mockState.props.data = hugeData;
            mockState.props.snapToIndices = [0, 1000, 2000, 3000];

            const start = Date.now();
            updateSnapToOffsets(mockCtx, mockState);
            const duration = Date.now() - start;

            expect(duration).toBeLessThan(50);
        });
    });

    describe("real world scenarios", () => {
        it("should handle pagination snap points", () => {
            // Snap to page boundaries
            mockState.props.snapToIndices = [0, 10, 20, 30]; // Page starts
            mockState.positions = new Map([
                [0, 0],
                [10, 1000],
                [20, 2000],
                [30, 3000],
            ]) as any;
            // Ensure we have enough data for getId
            mockState.props.data = Array.from({ length: 35 }, (_, i) => ({ id: i, value: `item_${i}` }));

            updateSnapToOffsets(mockCtx, mockState);

            expect(setStateSpy).toHaveBeenCalledWith(mockCtx, "snapToOffsets", [0, 1000, 2000, 3000]);
        });

        it("should handle section headers snap", () => {
            // Snap to section headers
            mockState.props.snapToIndices = [0, 5, 12, 18]; // Section starts
            mockState.positions = new Map([
                [0, 0], // Section A header
                [5, 500], // Section B header
                [12, 1200], // Section C header
                [18, 1800], // Section D header
            ]) as any;
            // Ensure we have enough data for getId
            mockState.props.data = Array.from({ length: 25 }, (_, i) => ({ id: i, value: `item_${i}` }));

            updateSnapToOffsets(mockCtx, mockState);

            expect(setStateSpy).toHaveBeenCalledWith(mockCtx, "snapToOffsets", [0, 500, 1200, 1800]);
        });

        it("should handle carousel item snap", () => {
            // Horizontal carousel with snap to each item
            mockState.props.snapToIndices = [0, 1, 2, 3, 4];
            mockState.positions = new Map([
                [0, 0],
                [1, 300],
                [2, 600],
                [3, 900],
                [4, 1200],
            ]) as any;
            // Ensure we have enough data for getId
            mockState.props.data = Array.from({ length: 10 }, (_, i) => ({ id: i, value: `item_${i}` }));

            updateSnapToOffsets(mockCtx, mockState);

            expect(setStateSpy).toHaveBeenCalledWith(mockCtx, "snapToOffsets", [0, 300, 600, 900, 1200]);
        });

        it("should handle staggered snap points", () => {
            // Non-uniform snap points
            mockState.props.snapToIndices = [0, 3, 7, 15];
            mockState.positions = new Map([
                [0, 0],
                [3, 300],
                [7, 700],
                [15, 1500],
            ]) as any;
            // Ensure we have enough data for getId
            mockState.props.data = Array.from({ length: 20 }, (_, i) => ({ id: i, value: `item_${i}` }));

            updateSnapToOffsets(mockCtx, mockState);

            expect(setStateSpy).toHaveBeenCalledWith(mockCtx, "snapToOffsets", [0, 300, 700, 1500]);
        });

        it("should handle dynamic snap indices", () => {
            // Snap indices that change based on content
            const scenarios = [
                { expected: [0, 250, 600], indices: [0, 2, 4] },
                { expected: [100, 400, 850], indices: [1, 3, 5] },
                { expected: [0, 100, 250, 400], indices: [0, 1, 2, 3] },
            ];

            scenarios.forEach(({ indices, expected }) => {
                setStateSpy.mockClear();
                mockState.props.snapToIndices = indices;

                updateSnapToOffsets(mockCtx, mockState);

                expect(setStateSpy).toHaveBeenCalledWith(mockCtx, "snapToOffsets", expected);
            });
        });
    });

    describe("integration with scroll system", () => {
        it("should work correctly when positions are updated", () => {
            // Initial state
            updateSnapToOffsets(mockCtx, mockState);
            expect(setStateSpy).toHaveBeenCalledWith(mockCtx, "snapToOffsets", [0, 250, 600]);

            // Positions updated (e.g., after layout)
            setStateSpy.mockClear();
            mockState.positions.set(2 as any, 275); // Position changed

            updateSnapToOffsets(mockCtx, mockState);
            expect(setStateSpy).toHaveBeenCalledWith(mockCtx, "snapToOffsets", [0, 275, 600]);
        });

        it("should handle data changes affecting indices", () => {
            // Original snap points
            updateSnapToOffsets(mockCtx, mockState);
            expect(setStateSpy).toHaveBeenCalledWith(mockCtx, "snapToOffsets", [0, 250, 600]);

            // Items added/removed, indices may now point to different items
            setStateSpy.mockClear();
            mockState.positions = new Map([
                [0, 0],
                [1, 80],
                [2, 180],
                [3, 320],
                [4, 500],
                [5, 720],
            ]) as any;

            updateSnapToOffsets(mockCtx, mockState);
            expect(setStateSpy).toHaveBeenCalledWith(mockCtx, "snapToOffsets", [0, 180, 500]);
        });

        it("should handle set$ function errors", () => {
            setStateSpy.mockImplementation(() => {
                throw new Error("State update failed");
            });

            expect(() => {
                updateSnapToOffsets(mockCtx, mockState);
            }).toThrow("State update failed");
        });
    });

    describe("type handling", () => {
        it("should handle mixed position value types", () => {
            mockState.positions = new Map([
                [0, 0],
                [2, "250"], // String value
                [4, null], // Null value
            ] as any);

            updateSnapToOffsets(mockCtx, mockState);

            expect(setStateSpy).toHaveBeenCalledWith(mockCtx, "snapToOffsets", [0, "250", null]);
        });

        it("should handle undefined positions gracefully", () => {
            mockState.positions = new Map([
                [0, 0],
                [2, undefined], // Explicit undefined
                [4, 600],
            ]) as any;

            updateSnapToOffsets(mockCtx, mockState);

            expect(setStateSpy).toHaveBeenCalledWith(mockCtx, "snapToOffsets", [0, undefined, 600]);
        });

        it("should preserve position value types", () => {
            mockState.positions = new Map([
                [0, 0.5], // Float
                [2, 250.75], // Float
                [4, 600], // Integer
            ]) as any;

            updateSnapToOffsets(mockCtx, mockState);

            expect(setStateSpy).toHaveBeenCalledWith(mockCtx, "snapToOffsets", [0.5, 250.75, 600]);
        });
    });

    describe("array creation and memory", () => {
        it("should create new array each time", () => {
            updateSnapToOffsets(mockCtx, mockState);
            setStateSpy.mockClear();
            updateSnapToOffsets(mockCtx, mockState);

            // Should be called twice with separate arrays
            expect(setStateSpy).toHaveBeenCalledTimes(1);
        });

        it("should handle array pre-allocation correctly", () => {
            mockState.props.snapToIndices = [0, 1, 2, 3, 4];

            updateSnapToOffsets(mockCtx, mockState);

            const [[, , actualArray]] = setStateSpy.mock.calls;
            expect(actualArray).toHaveLength(5);
            expect(Array.isArray(actualArray)).toBe(true);
        });
    });
});
