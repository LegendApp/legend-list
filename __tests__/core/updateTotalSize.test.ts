import { beforeEach, describe, expect, it } from "bun:test";
import "../setup"; // Import global test setup

import { updateTotalSize } from "../../src/core/updateTotalSize";
import type { StateContext } from "../../src/state/state";
import type { InternalState } from "../../src/types";
import { createMockContext } from "../__mocks__/createMockContext";
import { setLayoutValue } from "../helpers/layoutArrays";

describe("updateTotalSize", () => {
    let mockCtx: StateContext;
    let mockState: InternalState;

    beforeEach(() => {
        mockCtx = createMockContext(
            {
                footerSize: 0,
                headerSize: 0,
                stylePaddingTop: 0,
                totalSize: 0,
            },
            { totalSize: 0 },
        );

        mockState = mockCtx.state;
    });

    describe("empty data handling", () => {
        it("should set totalSize to 0 when data is empty", () => {
            mockState.props.data = [];

            updateTotalSize(mockCtx);

            expect(mockState.totalSize).toBe(0);
            expect(mockCtx.values.get("totalSize")).toBe(0);
        });

        it("should handle null data array", () => {
            mockState.props.data = null as any;

            expect(() => {
                updateTotalSize(mockCtx);
            }).toThrow();
        });

        it("should handle undefined data array", () => {
            mockState.props.data = undefined as any;

            expect(() => {
                updateTotalSize(mockCtx);
            }).toThrow();
        });
    });

    describe("single item calculations", () => {
        it("should calculate total size for single item", () => {
            const testData = [{ id: 0 }];
            mockState.props.data = testData;

            // Setup item data
            const itemId = "item_0";
            mockState.idCache[0] = itemId;
            setLayoutValue(mockState, "positions", itemId, 0);
            mockState.sizes.set(itemId, 50);

            updateTotalSize(mockCtx);

            expect(mockState.totalSize).toBe(50); // position 0 + size 50
            expect(mockCtx.values.get("totalSize")).toBe(50);
        });

        it("should handle item with zero size", () => {
            const testData = [{ id: 0 }];
            mockState.props.data = testData;

            const itemId = "item_0";
            mockState.idCache[0] = itemId;
            setLayoutValue(mockState, "positions", itemId, 0);
            mockState.sizes.set(itemId, 0);

            updateTotalSize(mockCtx);

            expect(mockState.totalSize).toBe(0);
            expect(mockCtx.values.get("totalSize")).toBe(0);
        });

        it("should handle item with non-zero position", () => {
            const testData = [{ id: 0 }];
            mockState.props.data = testData;

            const itemId = "item_0";
            mockState.idCache[0] = itemId;
            setLayoutValue(mockState, "positions", itemId, 100);
            mockState.sizes.set(itemId, 50);

            updateTotalSize(mockCtx);

            expect(mockState.totalSize).toBe(150); // position 100 + size 50
        });
    });

    describe("multiple items calculations", () => {
        it("should calculate total size for multiple items", () => {
            const testData = Array.from({ length: 5 }, (_, i) => ({ id: i }));
            mockState.props.data = testData;

            // Setup items with increasing positions
            for (let i = 0; i < 5; i++) {
                const itemId = `item_${i}`;
                mockState.idCache[i] = itemId;
                setLayoutValue(mockState, "positions", itemId, i * 50);
                mockState.sizes.set(itemId, 50);
            }

            updateTotalSize(mockCtx);

            // Last item at position 200 with size 50 = total 250
            expect(mockState.totalSize).toBe(250);
            expect(mockCtx.values.get("totalSize")).toBe(250);
        });

        it("should use the max size of the last row in multi-column layouts", () => {
            mockCtx.values.set("numColumns", 2);
            mockState.props.data = Array.from({ length: 4 }, (_, i) => ({ id: i }));

            const sizes = [50, 120, 200, 100];
            const positions = [0, 0, 120, 120];

            for (let i = 0; i < 4; i++) {
                const itemId = `item_${i}`;
                mockState.idCache[i] = itemId;
                setLayoutValue(mockState, "positions", itemId, positions[i]);
                mockState.sizes.set(itemId, sizes[i]);
                setLayoutValue(mockState, "columns", itemId, (i % 2) + 1);
            }

            updateTotalSize(mockCtx);

            // Last row starts at 120 and has max size 200
            expect(mockState.totalSize).toBe(320);
        });

        it("should handle varying item sizes", () => {
            const testData = Array.from({ length: 3 }, (_, i) => ({ id: i }));
            mockState.props.data = testData;

            // Setup items with different sizes
            const sizes = [100, 75, 150];
            let position = 0;

            for (let i = 0; i < 3; i++) {
                const itemId = `item_${i}`;
                mockState.idCache[i] = itemId;
                setLayoutValue(mockState, "positions", itemId, position);
                mockState.sizes.set(itemId, sizes[i]);
                position += sizes[i];
            }

            updateTotalSize(mockCtx);

            // Last item at position 175 with size 150 = total 325
            expect(mockState.totalSize).toBe(325);
        });

        it("should handle large datasets efficiently", () => {
            const itemCount = 10000;
            const testData = Array.from({ length: itemCount }, (_, i) => ({ id: i }));
            mockState.props.data = testData;

            // Setup last item only (function only checks last item)
            const lastId = `item_${itemCount - 1}`;
            mockState.idCache[itemCount - 1] = lastId;
            setLayoutValue(mockState, "positions", lastId, (itemCount - 1) * 50);
            mockState.sizes.set(lastId, 50);

            const start = Date.now();
            updateTotalSize(mockCtx);
            const duration = Date.now() - start;

            expect(duration).toBeLessThan(10); // Should be very fast
            expect(mockState.totalSize).toBe(itemCount * 50);
        });
    });

    describe("missing data handling", () => {
        it("should handle missing item ID", () => {
            const testData = [{ id: 0 }];
            mockState.props.data = testData;

            // Don't set up idCache - getId will return undefined

            updateTotalSize(mockCtx);

            // Should not crash, totalSize should remain unchanged
            expect(mockState.totalSize).toBe(0);
        });

        it("should handle missing position data", () => {
            const testData = [{ id: 0 }];
            mockState.props.data = testData;

            const itemId = "item_0";
            mockState.idCache[0] = itemId;
            // Don't set position - will be undefined
            mockState.sizes.set(itemId, 50);

            updateTotalSize(mockCtx);

            // Should not update totalSize when position is missing
            expect(mockState.totalSize).toBe(0);
        });

        it("should handle missing size data", () => {
            const testData = [{ id: 0 }];
            mockState.props.data = testData;

            const itemId = "item_0";
            mockState.idCache[0] = itemId;
            setLayoutValue(mockState, "positions", itemId, 100);
            // Don't set size - getItemSize will try to calculate it

            // Need to provide estimatedItemSize for getItemSize fallback
            mockState.props.estimatedItemSize = 50;

            updateTotalSize(mockCtx);

            expect(mockState.totalSize).toBe(150); // position 100 + estimated size 50
        });
    });

    describe("edge cases and error handling", () => {
        it("should handle negative positions", () => {
            const testData = [{ id: 0 }];
            mockState.props.data = testData;

            const itemId = "item_0";
            mockState.idCache[0] = itemId;
            setLayoutValue(mockState, "positions", itemId, -50);
            mockState.sizes.set(itemId, 100);

            updateTotalSize(mockCtx);

            expect(mockState.totalSize).toBe(50); // -50 + 100 = 50
        });

        it("should handle negative sizes", () => {
            const testData = [{ id: 0 }];
            mockState.props.data = testData;

            const itemId = "item_0";
            mockState.idCache[0] = itemId;
            setLayoutValue(mockState, "positions", itemId, 100);
            mockState.sizes.set(itemId, -50);

            updateTotalSize(mockCtx);

            expect(mockState.totalSize).toBe(50); // 100 + (-50) = 50
        });

        it("should handle floating point values", () => {
            const testData = [{ id: 0 }];
            mockState.props.data = testData;

            const itemId = "item_0";
            mockState.idCache[0] = itemId;
            setLayoutValue(mockState, "positions", itemId, 100.5);
            mockState.sizes.set(itemId, 49.7);

            updateTotalSize(mockCtx);

            expect(mockState.totalSize).toBe(150.2);
        });

        it("should handle very large numbers", () => {
            const testData = [{ id: 0 }];
            mockState.props.data = testData;

            const itemId = "item_0";
            mockState.idCache[0] = itemId;
            setLayoutValue(mockState, "positions", itemId, Number.MAX_SAFE_INTEGER - 1000);
            mockState.sizes.set(itemId, 500);

            updateTotalSize(mockCtx);

            expect(mockState.totalSize).toBe(Number.MAX_SAFE_INTEGER - 500);
        });

        it("should handle corrupted positions map", () => {
            const testData = [{ id: 0 }];
            mockState.props.data = testData;

            const itemId = "item_0";
            mockState.idCache[0] = itemId;
            mockState.positions = null as any;
            mockState.sizes.set(itemId, 50);

            expect(() => {
                updateTotalSize(mockCtx);
            }).not.toThrow();
        });

        it("should handle corrupted state context", () => {
            const testData = [{ id: 0 }];
            mockState.props.data = testData;

            const corruptedCtx = {
                ...mockCtx,
                values: {
                    set: () => {
                        throw new Error("Context corrupted");
                    },
                },
            } as any;

            const itemId = "item_0";
            mockState.idCache[0] = itemId;
            setLayoutValue(mockState, "positions", itemId, 100);
            mockState.sizes.set(itemId, 50);

            expect(() => {
                updateTotalSize(corruptedCtx);
            }).toThrow(); // Just check that it throws, don't check specific message
        });
    });

    describe("performance benchmarks", () => {
        it("should update total size quickly for normal datasets", () => {
            const itemCount = 1000;
            const testData = Array.from({ length: itemCount }, (_, i) => ({ id: i }));
            mockState.props.data = testData;

            const lastId = `item_${itemCount - 1}`;
            mockState.idCache[itemCount - 1] = lastId;
            setLayoutValue(mockState, "positions", lastId, (itemCount - 1) * 50);
            mockState.sizes.set(lastId, 50);

            const start = Date.now();
            for (let i = 0; i < 100; i++) {
                updateTotalSize(mockCtx);
            }
            const duration = Date.now() - start;

            expect(duration).toBeLessThan(10); // Should be very fast
            expect(mockState.totalSize).toBe(itemCount * 50);
        });

        it("should handle rapid consecutive updates", () => {
            const testData = [{ id: 0 }];
            mockState.props.data = testData;

            const itemId = "item_0";
            mockState.idCache[0] = itemId;
            setLayoutValue(mockState, "positions", itemId, 0);

            const results: number[] = [];
            for (let i = 0; i < 100; i++) {
                mockState.sizes.set(itemId, i * 10);
                updateTotalSize(mockCtx);
                results.push(mockState.totalSize);
            }

            expect(results.length).toBe(100);
            expect(results[0]).toBe(0);
            expect(results[99]).toBe(990);
            expect(mockCtx.values.get("totalSize")).toBe(990);
        });

        it("should maintain state consistency during updates", () => {
            const testData = Array.from({ length: 3 }, (_, i) => ({ id: i }));
            mockState.props.data = testData;

            // Setup items
            for (let i = 0; i < 3; i++) {
                const itemId = `item_${i}`;
                mockState.idCache[i] = itemId;
                setLayoutValue(mockState, "positions", itemId, i * 100);
                mockState.sizes.set(itemId, 100);
            }

            // Update multiple times and verify consistency
            for (let i = 0; i < 10; i++) {
                updateTotalSize(mockCtx);
                expect(mockState.totalSize).toBe(mockCtx.values.get("totalSize"));
                expect(mockState.totalSize).toBe(300); // Should remain consistent
            }
        });
    });
});
