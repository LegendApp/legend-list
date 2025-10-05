import { beforeEach, describe, expect, it } from "bun:test";
import "../setup"; // Import global test setup

import { updateTotalSize } from "../../src/core/updateTotalSize";
import type { StateContext } from "../../src/state/state";
import type { InternalState } from "../../src/types";
import { createMockContext } from "../__mocks__/createMockContext";
import { createMockState } from "../__mocks__/createMockState";

describe("updateTotalSize", () => {
    let mockCtx: StateContext;
    let mockState: InternalState;

    beforeEach(() => {
        mockCtx = createMockContext({
            alignItemsPaddingTop: 0,
            footerSize: 0,
            headerSize: 0,
            stylePaddingTop: 0,
            totalSize: 0,
        });

        mockState = createMockState({
            idCache: new Map(),
            positions: new Map(),
            props: {
                alignItemsAtEnd: false,
                data: [],
                keyExtractor: (item: any, index: number) => `item_${index}`,
            },
            scrollingTo: undefined,
            scrollLength: 300,
            sizes: new Map(),
            sizesKnown: new Map(),
            totalSize: 0,
        });
    });

    describe("empty data handling", () => {
        it("should set totalSize to 0 when data is empty", () => {
            mockState.props.data = [];

            updateTotalSize(mockCtx, mockState);

            expect(mockState.totalSize).toBe(0);
            expect(mockCtx.values.get("totalSize")).toBe(0);
        });

        it("should handle null data array", () => {
            mockState.props.data = null as any;

            expect(() => {
                updateTotalSize(mockCtx, mockState);
            }).toThrow();
        });

        it("should handle undefined data array", () => {
            mockState.props.data = undefined as any;

            expect(() => {
                updateTotalSize(mockCtx, mockState);
            }).toThrow();
        });
    });

    describe("single item calculations", () => {
        it("should calculate total size for single item", () => {
            const testData = [{ id: 0 }];
            mockState.props.data = testData;

            // Setup item data
            const itemId = "item_0";
            mockState.idCache.set(0, itemId);
            mockState.positions.set(itemId, 0);
            mockState.sizes.set(itemId, 50);

            updateTotalSize(mockCtx, mockState);

            expect(mockState.totalSize).toBe(50); // position 0 + size 50
            expect(mockCtx.values.get("totalSize")).toBe(50);
        });

        it("should handle item with zero size", () => {
            const testData = [{ id: 0 }];
            mockState.props.data = testData;

            const itemId = "item_0";
            mockState.idCache.set(0, itemId);
            mockState.positions.set(itemId, 0);
            mockState.sizes.set(itemId, 0);

            updateTotalSize(mockCtx, mockState);

            expect(mockState.totalSize).toBe(0);
            expect(mockCtx.values.get("totalSize")).toBe(0);
        });

        it("should handle item with non-zero position", () => {
            const testData = [{ id: 0 }];
            mockState.props.data = testData;

            const itemId = "item_0";
            mockState.idCache.set(0, itemId);
            mockState.positions.set(itemId, 100);
            mockState.sizes.set(itemId, 50);

            updateTotalSize(mockCtx, mockState);

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
                mockState.idCache.set(i, itemId);
                mockState.positions.set(itemId, i * 50);
                mockState.sizes.set(itemId, 50);
            }

            updateTotalSize(mockCtx, mockState);

            // Last item at position 200 with size 50 = total 250
            expect(mockState.totalSize).toBe(250);
            expect(mockCtx.values.get("totalSize")).toBe(250);
        });

        it("should handle varying item sizes", () => {
            const testData = Array.from({ length: 3 }, (_, i) => ({ id: i }));
            mockState.props.data = testData;

            // Setup items with different sizes
            const sizes = [100, 75, 150];
            let position = 0;

            for (let i = 0; i < 3; i++) {
                const itemId = `item_${i}`;
                mockState.idCache.set(i, itemId);
                mockState.positions.set(itemId, position);
                mockState.sizes.set(itemId, sizes[i]);
                position += sizes[i];
            }

            updateTotalSize(mockCtx, mockState);

            // Last item at position 175 with size 150 = total 325
            expect(mockState.totalSize).toBe(325);
        });

        it("should handle large datasets efficiently", () => {
            const itemCount = 10000;
            const testData = Array.from({ length: itemCount }, (_, i) => ({ id: i }));
            mockState.props.data = testData;

            // Setup last item only (function only checks last item)
            const lastId = `item_${itemCount - 1}`;
            mockState.idCache.set(itemCount - 1, lastId);
            mockState.positions.set(lastId, (itemCount - 1) * 50);
            mockState.sizes.set(lastId, 50);

            const start = Date.now();
            updateTotalSize(mockCtx, mockState);
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

            updateTotalSize(mockCtx, mockState);

            // Should not crash, totalSize should remain unchanged
            expect(mockState.totalSize).toBe(0);
        });

        it("should handle missing position data", () => {
            const testData = [{ id: 0 }];
            mockState.props.data = testData;

            const itemId = "item_0";
            mockState.idCache.set(0, itemId);
            // Don't set position - will be undefined
            mockState.sizes.set(itemId, 50);

            updateTotalSize(mockCtx, mockState);

            // Should not update totalSize when position is missing
            expect(mockState.totalSize).toBe(0);
        });

        it("should handle missing size data", () => {
            const testData = [{ id: 0 }];
            mockState.props.data = testData;

            const itemId = "item_0";
            mockState.idCache.set(0, itemId);
            mockState.positions.set(itemId, 100);
            // Don't set size - getItemSize will try to calculate it

            // Need to provide estimatedItemSize for getItemSize fallback
            mockState.props.estimatedItemSize = 50;

            updateTotalSize(mockCtx, mockState);

            expect(mockState.totalSize).toBe(150); // position 100 + estimated size 50
        });
    });

    describe("alignItemsAtEnd integration", () => {
        it("should trigger align items padding update when alignItemsAtEnd is true", () => {
            mockState.props.alignItemsAtEnd = true;
            mockState.props.data = [{ id: 0 }];
            mockState.scrollLength = 500;

            const itemId = "item_0";
            mockState.idCache.set(0, itemId);
            mockState.positions.set(itemId, 0);
            mockState.sizes.set(itemId, 100);

            // Mock the context values needed for align calculation
            mockCtx.values.set("headerSize", 0);
            mockCtx.values.set("footerSize", 0);
            mockCtx.values.set("stylePaddingTop", 0);

            updateTotalSize(mockCtx, mockState);

            expect(mockState.totalSize).toBe(100);
            expect(mockCtx.values.get("totalSize")).toBe(100);
            // Should set alignItemsPaddingTop = max(0, scrollLength - contentSize)
            // contentSize = headerSize + footerSize + totalSize + stylePaddingTop = 0 + 0 + 100 + 0 = 100
            // alignItemsPaddingTop = max(0, 500 - 100) = 400
            expect(mockCtx.values.get("alignItemsPaddingTop")).toBe(400);
        });

        it("should not trigger align items padding update when alignItemsAtEnd is false", () => {
            mockState.props.alignItemsAtEnd = false;
            mockState.props.data = [{ id: 0 }];

            const itemId = "item_0";
            mockState.idCache.set(0, itemId);
            mockState.positions.set(itemId, 0);
            mockState.sizes.set(itemId, 100);

            updateTotalSize(mockCtx, mockState);

            expect(mockState.totalSize).toBe(100);
            // When alignItemsAtEnd is false, alignItemsPaddingTop should remain at initial value (0)
            expect(mockCtx.values.get("alignItemsPaddingTop")).toBe(0);
        });

        it("should handle align items calculation with content larger than scroll area", () => {
            mockState.props.alignItemsAtEnd = true;
            mockState.props.data = [{ id: 0 }];
            mockState.scrollLength = 200; // Smaller than content

            const itemId = "item_0";
            mockState.idCache.set(0, itemId);
            mockState.positions.set(itemId, 0);
            mockState.sizes.set(itemId, 500); // Larger than scroll area

            mockCtx.values.set("headerSize", 0);
            mockCtx.values.set("footerSize", 0);
            mockCtx.values.set("stylePaddingTop", 0);

            updateTotalSize(mockCtx, mockState);

            expect(mockState.totalSize).toBe(500);
            // alignItemsPaddingTop = max(0, 200 - 500) = max(0, -300) = 0
            expect(mockCtx.values.get("alignItemsPaddingTop")).toBe(0);
        });
    });

    describe("edge cases and error handling", () => {
        it("should handle negative positions", () => {
            const testData = [{ id: 0 }];
            mockState.props.data = testData;

            const itemId = "item_0";
            mockState.idCache.set(0, itemId);
            mockState.positions.set(itemId, -50);
            mockState.sizes.set(itemId, 100);

            updateTotalSize(mockCtx, mockState);

            expect(mockState.totalSize).toBe(50); // -50 + 100 = 50
        });

        it("should handle negative sizes", () => {
            const testData = [{ id: 0 }];
            mockState.props.data = testData;

            const itemId = "item_0";
            mockState.idCache.set(0, itemId);
            mockState.positions.set(itemId, 100);
            mockState.sizes.set(itemId, -50);

            updateTotalSize(mockCtx, mockState);

            expect(mockState.totalSize).toBe(50); // 100 + (-50) = 50
        });

        it("should handle floating point values", () => {
            const testData = [{ id: 0 }];
            mockState.props.data = testData;

            const itemId = "item_0";
            mockState.idCache.set(0, itemId);
            mockState.positions.set(itemId, 100.5);
            mockState.sizes.set(itemId, 49.7);

            updateTotalSize(mockCtx, mockState);

            expect(mockState.totalSize).toBe(150.2);
        });

        it("should handle very large numbers", () => {
            const testData = [{ id: 0 }];
            mockState.props.data = testData;

            const itemId = "item_0";
            mockState.idCache.set(0, itemId);
            mockState.positions.set(itemId, Number.MAX_SAFE_INTEGER - 1000);
            mockState.sizes.set(itemId, 500);

            updateTotalSize(mockCtx, mockState);

            expect(mockState.totalSize).toBe(Number.MAX_SAFE_INTEGER - 500);
        });

        it("should handle corrupted positions map", () => {
            const testData = [{ id: 0 }];
            mockState.props.data = testData;

            const itemId = "item_0";
            mockState.idCache.set(0, itemId);
            mockState.positions = null as any;
            mockState.sizes.set(itemId, 50);

            expect(() => {
                updateTotalSize(mockCtx, mockState);
            }).toThrow();
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
            mockState.idCache.set(0, itemId);
            mockState.positions.set(itemId, 100);
            mockState.sizes.set(itemId, 50);

            expect(() => {
                updateTotalSize(corruptedCtx, mockState);
            }).toThrow(); // Just check that it throws, don't check specific message
        });
    });

    describe("performance benchmarks", () => {
        it("should update total size quickly for normal datasets", () => {
            const itemCount = 1000;
            const testData = Array.from({ length: itemCount }, (_, i) => ({ id: i }));
            mockState.props.data = testData;

            const lastId = `item_${itemCount - 1}`;
            mockState.idCache.set(itemCount - 1, lastId);
            mockState.positions.set(lastId, (itemCount - 1) * 50);
            mockState.sizes.set(lastId, 50);

            const start = Date.now();
            for (let i = 0; i < 100; i++) {
                updateTotalSize(mockCtx, mockState);
            }
            const duration = Date.now() - start;

            expect(duration).toBeLessThan(10); // Should be very fast
            expect(mockState.totalSize).toBe(itemCount * 50);
        });

        it("should handle rapid consecutive updates", () => {
            const testData = [{ id: 0 }];
            mockState.props.data = testData;

            const itemId = "item_0";
            mockState.idCache.set(0, itemId);
            mockState.positions.set(itemId, 0);

            const results: number[] = [];
            for (let i = 0; i < 100; i++) {
                mockState.sizes.set(itemId, i * 10);
                updateTotalSize(mockCtx, mockState);
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
                mockState.idCache.set(i, itemId);
                mockState.positions.set(itemId, i * 100);
                mockState.sizes.set(itemId, 100);
            }

            // Update multiple times and verify consistency
            for (let i = 0; i < 10; i++) {
                updateTotalSize(mockCtx, mockState);
                expect(mockState.totalSize).toBe(mockCtx.values.get("totalSize"));
                expect(mockState.totalSize).toBe(300); // Should remain consistent
            }
        });
    });
});
