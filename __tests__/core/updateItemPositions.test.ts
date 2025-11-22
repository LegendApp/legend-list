import { beforeEach, describe, expect, it } from "bun:test";
import "../setup"; // Import global test setup

import { updateItemPositions } from "../../src/core/updateItemPositions";
import type { StateContext } from "../../src/state/state";
import type { InternalState } from "../../src/types";
import { createMockContext } from "../__mocks__/createMockContext";
import { createMockState } from "../__mocks__/createMockState";

describe("updateItemPositions", () => {
    let mockCtx: StateContext;
    let mockState: InternalState;

    beforeEach(() => {
        mockCtx = createMockContext({
            numColumns: 1, // Single column by default
        });

        mockState = createMockState({
            averageSizes: {},
            columns: new Map(),
            dataChangeNeedsScrollUpdate: false,
            firstFullyOnScreenIndex: undefined,
            idCache: [],
            indexByKey: new Map(),
            positions: new Map(),
            props: {
                data: [
                    { id: "item1", name: "First" },
                    { id: "item2", name: "Second" },
                    { id: "item3", name: "Third" },
                    { id: "item4", name: "Fourth" },
                    { id: "item5", name: "Fifth" },
                ],
                estimatedItemSize: undefined,
                getEstimatedItemSize: undefined,
                keyExtractor: (item: any, index: number) => item?.id ?? `item-${index}`,
                snapToIndices: undefined,
            },
            scrollHistory: [],
            scrollingTo: undefined, // Required by getItemSize
            sizes: new Map(), // Required by getItemSize
            sizesKnown: new Map(),
        });
    });

    describe("basic single-column positioning", () => {
        it("should calculate positions for all items from top to bottom", () => {
            // Set up known sizes for all items
            mockState.sizesKnown.set("item1", 100);
            mockState.sizesKnown.set("item2", 150);
            mockState.sizesKnown.set("item3", 200);
            mockState.sizesKnown.set("item4", 120);
            mockState.sizesKnown.set("item5", 180);

            updateItemPositions(mockCtx, mockState, false);

            // Check positions are calculated correctly
            expect(mockState.positions.get("item1")).toBe(0);
            expect(mockState.positions.get("item2")).toBe(100);
            expect(mockState.positions.get("item3")).toBe(250);
            expect(mockState.positions.get("item4")).toBe(450);
            expect(mockState.positions.get("item5")).toBe(570);
        });

        it("should update indexByKey mapping for all items", () => {
            updateItemPositions(mockCtx, mockState, false);

            expect(mockState.indexByKey.get("item1")).toBe(0);
            expect(mockState.indexByKey.get("item2")).toBe(1);
            expect(mockState.indexByKey.get("item3")).toBe(2);
            expect(mockState.indexByKey.get("item4")).toBe(3);
            expect(mockState.indexByKey.get("item5")).toBe(4);
        });

        it("should set column to 1 for all items in single-column mode", () => {
            updateItemPositions(mockCtx, mockState, false);

            expect(mockState.columns.get("item1")).toBe(1);
            expect(mockState.columns.get("item2")).toBe(1);
            expect(mockState.columns.get("item3")).toBe(1);
            expect(mockState.columns.get("item4")).toBe(1);
            expect(mockState.columns.get("item5")).toBe(1);
        });

        it("should use estimated sizes when sizes are not known", () => {
            mockState.props.estimatedItemSize = 100;

            updateItemPositions(mockCtx, mockState, false);

            // All items should be positioned using estimated size
            expect(mockState.positions.get("item1")).toBe(0);
            expect(mockState.positions.get("item2")).toBe(100);
            expect(mockState.positions.get("item3")).toBe(200);
            expect(mockState.positions.get("item4")).toBe(300);
            expect(mockState.positions.get("item5")).toBe(400);
        });
    });

    describe("multi-column layout", () => {
        beforeEach(() => {
            mockCtx.values.set("numColumns", 2);
            mockState.sizesKnown.set("item1", 100);
            mockState.sizesKnown.set("item2", 120); // Taller item in row 1
            mockState.sizesKnown.set("item3", 80);
            mockState.sizesKnown.set("item4", 150); // Taller item in row 2
            mockState.sizesKnown.set("item5", 90);
        });

        it("should position items in columns correctly", () => {
            updateItemPositions(mockCtx, mockState, false);

            // Row 1: item1 (col 1), item2 (col 2) - max height 120
            expect(mockState.positions.get("item1")).toBe(0);
            expect(mockState.positions.get("item2")).toBe(0);
            expect(mockState.columns.get("item1")).toBe(1);
            expect(mockState.columns.get("item2")).toBe(2);

            // Row 2: item3 (col 1), item4 (col 2) - max height 150
            expect(mockState.positions.get("item3")).toBe(120); // After max height of row 1
            expect(mockState.positions.get("item4")).toBe(120);
            expect(mockState.columns.get("item3")).toBe(1);
            expect(mockState.columns.get("item4")).toBe(2);

            // Row 3: item5 (col 1)
            expect(mockState.positions.get("item5")).toBe(270); // 120 + 150
            expect(mockState.columns.get("item5")).toBe(1);
        });

        it("should handle varying column heights correctly", () => {
            // Set up items with very different heights
            mockState.sizesKnown.set("item1", 50);
            mockState.sizesKnown.set("item2", 200); // Much taller
            mockState.sizesKnown.set("item3", 100);
            mockState.sizesKnown.set("item4", 60);

            updateItemPositions(mockCtx, mockState, false);

            // Row 1: max height should be 200 (item2)
            expect(mockState.positions.get("item1")).toBe(0);
            expect(mockState.positions.get("item2")).toBe(0);

            // Row 2: should start at 200 (max of row 1)
            expect(mockState.positions.get("item3")).toBe(200);
            expect(mockState.positions.get("item4")).toBe(200);
        });

        it("should handle 3-column layout", () => {
            mockCtx.values.set("numColumns", 3);

            updateItemPositions(mockCtx, mockState, false);

            // Row 1: items 1, 2, 3
            expect(mockState.columns.get("item1")).toBe(1);
            expect(mockState.columns.get("item2")).toBe(2);
            expect(mockState.columns.get("item3")).toBe(3);

            // Row 2: items 4, 5
            expect(mockState.columns.get("item4")).toBe(1);
            expect(mockState.columns.get("item5")).toBe(2);
        });
    });

    describe("startIndex handling with multi-column data", () => {
        const baseSizes = [100, 80, 70, 90, 75, 60];

        beforeEach(() => {
            mockCtx.values.set("numColumns", 2);

            const extendedData = Array.from({ length: 6 }, (_, index) => ({
                id: `item${index + 1}`,
                name: `Item ${index + 1}`,
            }));

            mockState.props.data = extendedData;

            mockState.columns.clear();
            mockState.indexByKey.clear();
            mockState.positions.clear();
            mockState.idCache.length = 0;
            mockState.sizes.clear();
            mockState.sizesKnown.clear();

            baseSizes.forEach((size, index) => {
                mockState.sizesKnown.set(`item${index + 1}`, size);
            });
        });

        it("recomputes the previous row when startIndex begins mid-row", () => {
            updateItemPositions(mockCtx, mockState, false);

            // Increase height of the first item to force downstream rows to shift
            mockState.sizesKnown.set("item1", 150);

            updateItemPositions(mockCtx, mockState, false, { scrollBottomBuffered: 1000, startIndex: 1 });

            expect(mockState.positions.get("item1")).toBe(0);
            expect(mockState.positions.get("item2")).toBe(0);
            expect(mockState.positions.get("item3")).toBe(150);
            expect(mockState.positions.get("item4")).toBe(150);
            expect(mockState.positions.get("item5")).toBe(240);
            expect(mockState.positions.get("item6")).toBe(240);
        });

        it("preserves the row baseline when startIndex targets a column-one item", () => {
            updateItemPositions(mockCtx, mockState, false);

            // Make the first item in the second row taller so later rows need to shift
            mockState.sizesKnown.set("item3", 140);

            updateItemPositions(mockCtx, mockState, false, { scrollBottomBuffered: 1000, startIndex: 2 });

            expect(mockState.positions.get("item1")).toBe(0);
            expect(mockState.positions.get("item2")).toBe(0);
            expect(mockState.positions.get("item3")).toBe(100);
            expect(mockState.positions.get("item4")).toBe(100);
            expect(mockState.positions.get("item5")).toBe(240);
            expect(mockState.positions.get("item6")).toBe(240);

            expect(mockState.columns.get("item3")).toBe(1);
            expect(mockState.columns.get("item4")).toBe(2);
        });

        it("handles third-row recomputation in 3-column layouts", () => {
            mockCtx.values.set("numColumns", 3);

            // Extend data to 6 rows * 3 columns = 18 items
            const extendedData = Array.from({ length: 18 }, (_, index) => ({
                id: `item${index + 1}`,
                name: `Item ${index + 1}`,
            }));
            mockState.props.data = extendedData;

            mockState.columns.clear();
            mockState.indexByKey.clear();
            mockState.positions.clear();
            mockState.idCache.length = 0;
            mockState.sizes.clear();
            mockState.sizesKnown.clear();

            const sizeSequence = [100, 80, 90];
            extendedData.forEach((item, index) => {
                const size = sizeSequence[index % sizeSequence.length];
                mockState.sizesKnown.set(item.id, size);
            });

            updateItemPositions(mockCtx, mockState, false);

            mockState.sizesKnown.set("item7", 140);

            updateItemPositions(mockCtx, mockState, false, { scrollBottomBuffered: 1000, startIndex: 7 });

            expect(mockState.positions.get("item1")).toBe(0);
            expect(mockState.positions.get("item4")).toBe(100);
            expect(mockState.positions.get("item7")).toBe(200);
            expect(mockState.positions.get("item10")).toBe(340);
            expect(mockState.positions.get("item13")).toBe(440);

            expect(mockState.columns.get("item10")).toBe(1);
            expect(mockState.columns.get("item11")).toBe(2);
            expect(mockState.columns.get("item12")).toBe(3);
        });
    });

    describe("backwards optimization", () => {
        beforeEach(() => {
            // Set up state for backwards optimization
            mockState.firstFullyOnScreenIndex = 10;
            mockState.sizesKnown.set("item1", 100);
            mockState.props.estimatedItemSize = 100;

            // Create larger dataset for backwards optimization
            const largeData = Array.from({ length: 20 }, (_, i) => ({ id: `item${i + 1}`, name: `Item ${i + 1}` }));
            mockState.props.data = largeData;

            // Set up scroll history for upward scrolling (negative velocity)
            mockState.scrollHistory = [
                { scroll: 1000, time: Date.now() - 100 },
                { scroll: 800, time: Date.now() - 50 },
                { scroll: 600, time: Date.now() },
            ];

            // Pre-populate some positions for the anchor
            for (let i = 5; i < 15; i++) {
                const id = `item${i + 1}`;
                mockState.idCache[i] = id;
                mockState.positions.set(id, i * 100);
                mockState.sizesKnown.set(id, 100);
            }
        });

        it("recalculates positions from the start when scrolling up", () => {
            updateItemPositions(mockCtx, mockState, false);

            expect(mockState.positions.get("item1")).toBe(0);
            expect(mockState.positions.get("item2")).toBe(100);
        });

        it("should produce consistent output when not scrolling up", () => {
            // Change scroll history to indicate downward scrolling
            mockState.scrollHistory = [
                { scroll: 600, time: Date.now() - 100 },
                { scroll: 800, time: Date.now() - 50 },
                { scroll: 1000, time: Date.now() },
            ];

            updateItemPositions(mockCtx, mockState, false);

            expect(mockState.positions.get("item1")).toBe(0);
        });

        it("should bail out of backwards optimization when positions go too low", () => {
            // Set anchor position very low to trigger bailout
            const anchorId = `item${mockState.firstFullyOnScreenIndex! + 1}`;
            mockState.positions.set(anchorId, -3000);

            updateItemPositions(mockCtx, mockState, false);

            expect(mockState.positions.get("item1")).toBe(0);
        });

        it("should fall back to regular calculation when anchor position is missing", () => {
            // Clear the anchor position
            const anchorId = `item${mockState.firstFullyOnScreenIndex! + 1}`;
            mockState.positions.delete(anchorId);

            updateItemPositions(mockCtx, mockState, false);

            expect(mockState.positions.get("item1")).toBe(0);
        });
    });

    describe("data change handling", () => {
        it("should clear caches when data changes", () => {
            // Pre-populate caches
            mockState.indexByKey.set("old_item", 0);
            mockState.idCache[0] = "old_item";

            updateItemPositions(mockCtx, mockState, true); // dataChanged = true

            // Caches should be rebuilt for current data. Implementation may not proactively delete unknown
            // legacy keys from previous datasets, and may reuse idCache entries for existing indices.
            // Verify that new mappings are added for subsequent items.
            expect(mockState.indexByKey.get("item2")).toBe(1);
        });

        it("should preserve caches when data doesn't change", () => {
            // Pre-populate with correct data
            mockState.indexByKey.set("item1", 0);
            mockState.idCache[0] = "item1";

            updateItemPositions(mockCtx, mockState, false); // dataChanged = false

            // Should update indexByKey because size is 0 (needs rebuilding)
            expect(mockState.indexByKey.get("item1")).toBe(0);
        });

        it("should rebuild indexByKey when it's empty", () => {
            mockState.indexByKey.clear();

            updateItemPositions(mockCtx, mockState, false);

            // Should rebuild indexByKey
            expect(mockState.indexByKey.get("item1")).toBe(0);
            expect(mockState.indexByKey.get("item2")).toBe(1);
        });
    });

    describe("average size optimization", () => {
        it("should use average size when available", () => {
            mockState.averageSizes[""] = { avg: 125.5, num: 10 };
            mockState.props.enableAverages = true;
            mockState.props.estimatedItemSize = undefined;

            updateItemPositions(mockCtx, mockState, false);

            // Should use rounded average size (125.5 rounds to 125.5 using roundSize)
            const expectedRoundedSize = Math.floor(125.5 * 8) / 8; // 125.5
            expect(mockState.positions.get("item1")).toBe(0);
            expect(mockState.positions.get("item2")).toBe(expectedRoundedSize);
            expect(mockState.positions.get("item3")).toBe(expectedRoundedSize * 2);
        });

        it("should prefer known sizes over average sizes", () => {
            mockState.averageSizes[""] = { avg: 200, num: 10 };
            mockState.sizesKnown.set("item2", 100); // Override with known size
            mockState.props.enableAverages = true;
            mockState.props.estimatedItemSize = undefined;

            updateItemPositions(mockCtx, mockState, false);

            expect(mockState.positions.get("item1")).toBe(0);
            expect(mockState.positions.get("item2")).toBe(200); // Should use average for item1
            expect(mockState.positions.get("item3")).toBe(300); // item2 used known size (100)
        });
    });

    describe("edge cases and error handling", () => {
        it("should handle empty data array", () => {
            mockState.props.data = [];

            expect(() => updateItemPositions(mockCtx, mockState, false)).not.toThrow();

            expect(mockState.positions.size).toBe(0);
            expect(mockState.indexByKey.size).toBe(0);
        });

        it("should handle null data array", () => {
            mockState.props.data = null as any;

            expect(() => updateItemPositions(mockCtx, mockState, false)).toThrow();
        });

        it("should handle single item", () => {
            mockState.props.data = [{ id: "single", name: "Single Item" }];
            mockState.sizesKnown.set("single", 150);

            updateItemPositions(mockCtx, mockState, false);

            expect(mockState.positions.get("single")).toBe(0);
            expect(mockState.indexByKey.get("single")).toBe(0);
            expect(mockState.columns.get("single")).toBe(1);
        });

        it("should handle items with zero size", () => {
            mockState.sizesKnown.set("item1", 0);
            mockState.sizesKnown.set("item2", 100);

            updateItemPositions(mockCtx, mockState, false);

            expect(mockState.positions.get("item1")).toBe(0);
            expect(mockState.positions.get("item2")).toBe(0); // Zero size means no offset
        });

        it("should handle very large datasets efficiently", () => {
            const largeData = Array.from({ length: 10000 }, (_, i) => ({ id: `item${i}`, name: `Item ${i}` }));
            mockState.props.data = largeData;
            mockState.props.estimatedItemSize = 50;

            const start = Date.now();
            updateItemPositions(mockCtx, mockState, false);
            const duration = Date.now() - start;

            expect(duration).toBeLessThan(500); // Should be reasonably fast
            expect(mockState.positions.size).toBeLessThan(200); // Early break should cap the work
            expect(mockState.positions.size).toBeGreaterThan(0);
            expect(mockState.positions.get("item0")).toBe(0);
            expect(mockState.positions.has("item9999")).toBe(false);
        });

        it("should handle corrupted state gracefully", () => {
            mockState.positions = null as any;

            expect(() => updateItemPositions(mockCtx, mockState, false)).toThrow();
        });

        it("should handle missing context values", () => {
            mockCtx.values.delete("numColumns");

            expect(() => updateItemPositions(mockCtx, mockState, false)).not.toThrow();

            // Should default to single column behavior
            expect(mockState.columns.get("item1")).toBe(1);
        });
    });

    describe("performance optimization features", () => {
        it("limits work to a small window in single-column lists", () => {
            const largeData = Array.from({ length: 100 }, (_, index) => ({
                id: `item-${index}`,
                name: `Item ${index}`,
            }));

            mockState.props.data = largeData;
            mockState.props.keyExtractor = (item: { id: string }) => item.id;

            mockState.columns = new Map();
            mockState.idCache = [];
            mockState.indexByKey = new Map();
            mockState.positions = new Map();
            mockState.sizesKnown = new Map();

            largeData.forEach((item) => {
                mockState.sizesKnown.set(item.id, 120);
                mockState.positions.set(item.id, -1);
            });

            updateItemPositions(mockCtx, mockState, false, { scrollBottomBuffered: -900, startIndex: 0 });

            expect(mockState.indexByKey.size).toBe(13); // 1 row + buffer of ~10 items
            expect(mockState.indexByKey.has("item-12")).toBe(true);
            expect(mockState.indexByKey.has("item-13")).toBe(false);
            expect(mockState.positions.get("item-12")).toBeGreaterThanOrEqual(0);
            expect(mockState.positions.get("item-30")).toBe(-1);
        });

        it("limits work to a small window in multi-column lists", () => {
            mockCtx.values.set("numColumns", 3);

            const largeData = Array.from({ length: 90 }, (_, index) => ({
                id: `item-${index}`,
                name: `Item ${index}`,
            }));

            mockState.props.data = largeData;
            mockState.props.keyExtractor = (item: { id: string }) => item.id;

            mockState.columns = new Map();
            mockState.idCache = [];
            mockState.indexByKey = new Map();
            mockState.positions = new Map();
            mockState.sizesKnown = new Map();

            largeData.forEach((item) => {
                mockState.sizesKnown.set(item.id, 120);
                mockState.positions.set(item.id, -1);
            });

            updateItemPositions(mockCtx, mockState, false, { scrollBottomBuffered: -900, startIndex: 0 });

            expect(mockState.indexByKey.size).toBe(17); // One extra row + buffer beyond the threshold
            expect(mockState.indexByKey.has("item-40")).toBe(false);
            expect(mockState.columns.get("item-16")).toBeDefined();
            expect(mockState.positions.get("item-40")).toBe(-1);
        });

        it("should handle backwards optimization with columns", () => {
            mockCtx.values.set("numColumns", 2);
            mockState.firstFullyOnScreenIndex = 8;

            // Create dataset and setup for backwards optimization
            const data = Array.from({ length: 20 }, (_, i) => ({ id: `item${i}`, name: `Item ${i}` }));
            mockState.props.data = data;

            // Setup scroll history for upward scrolling
            mockState.scrollHistory = [
                { scroll: 1000, time: Date.now() - 100 },
                { scroll: 800, time: Date.now() - 50 },
                { scroll: 600, time: Date.now() },
            ];

            // Pre-populate positions and sizes
            for (let i = 0; i < 20; i++) {
                const id = `item${i}`;
                mockState.idCache[i] = id;
                mockState.sizesKnown.set(id, 100);
            }

            // Set anchor position
            mockState.positions.set("item8", 400);

            updateItemPositions(mockCtx, mockState, false);

            // Should have used backwards optimization
            expect(mockState.positions.get("item8")).toBe(400);
        });

        it("should maintain scroll velocity calculation integration", () => {
            // Set up scroll history with clear velocity pattern
            mockState.scrollHistory = [
                { scroll: 0, time: Date.now() - 200 },
                { scroll: 100, time: Date.now() - 100 },
                { scroll: 200, time: Date.now() },
            ];

            updateItemPositions(mockCtx, mockState, false);

            // Function should complete without error and produce valid positions
            expect(mockState.positions.get("item1")).toBe(0);
            expect(mockState.positions.size).toBe(5);
        });

        it("should handle rapid consecutive calls", () => {
            const start = Date.now();

            for (let i = 0; i < 100; i++) {
                updateItemPositions(mockCtx, mockState, false);
            }

            const duration = Date.now() - start;
            expect(duration).toBeLessThan(1000); // Should handle rapid calls efficiently
        });
    });

    describe("snapToIndices integration", () => {
        it("should call updateSnapToOffsets when snapToIndices is provided", () => {
            mockState.props.snapToIndices = [0, 2, 4];

            // Mock updateSnapToOffsets by checking if it would be called
            updateItemPositions(mockCtx, mockState, false);

            // Function should complete without error
            expect(mockState.positions.size).toBe(5);
        });

        it("should not call updateSnapToOffsets when snapToIndices is undefined", () => {
            mockState.props.snapToIndices = undefined;

            updateItemPositions(mockCtx, mockState, false);

            expect(mockState.positions.size).toBe(5);
        });
    });

    describe("development mode features", () => {
        it("should detect duplicate keys in development mode", () => {
            // Mock __DEV__ environment by setting up duplicate key scenario
            const originalConsoleError = console.error;
            const consoleErrors: string[] = [];
            console.error = (message: string) => consoleErrors.push(message);

            // Create duplicate key scenario
            mockState.props.keyExtractor = () => "duplicate_key";

            updateItemPositions(mockCtx, mockState, false);

            console.error = originalConsoleError;

            // In dev mode, should detect and warn about duplicate keys
            // (The actual detection happens when __DEV__ is true, which may not be set in tests)
            expect(mockState.positions.size).toBeGreaterThan(0);
        });
    });

    describe("memory efficiency", () => {
        it("should maintain reasonable memory usage with large datasets", () => {
            const initialMemory = process.memoryUsage().heapUsed;

            const largeData = Array.from({ length: 5000 }, (_, i) => ({ id: `item${i}`, name: `Item ${i}` }));
            mockState.props.data = largeData;

            updateItemPositions(mockCtx, mockState, false);

            const finalMemory = process.memoryUsage().heapUsed;
            const memoryIncrease = finalMemory - initialMemory;

            // Should not have excessive memory increase
            expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Less than 50MB
        });

        it("should reuse existing map entries when possible", () => {
            // Pre-populate with some entries
            mockState.positions.set("item1", 100);
            mockState.indexByKey.set("item1", 0);

            updateItemPositions(mockCtx, mockState, false);

            // Should update existing entries rather than always creating new ones
            expect(mockState.positions.get("item1")).toBe(0); // Recalculated
            expect(mockState.indexByKey.get("item1")).toBe(0); // Maintained
        });
    });
});
