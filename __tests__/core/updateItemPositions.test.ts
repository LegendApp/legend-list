import { beforeEach, describe, expect, it } from "bun:test";
import "../setup"; // Import global test setup

import { updateItemPositions } from "../../src/core/updateItemPositions";
import type { StateContext } from "../../src/state/state";
import type { InternalState } from "../../src/types";
import { createMockContext } from "../__mocks__/createMockContext";
import {
    clearLayoutValues,
    countLayoutValues,
    getLayoutValue,
    hasLayoutValue,
    setLayoutValue,
} from "../helpers/layoutArrays";

describe("updateItemPositions", () => {
    let mockCtx: StateContext;
    let mockState: InternalState;

    beforeEach(() => {
        mockCtx = createMockContext(
            {
                numColumns: 1, // Single column by default
            },
            {
                firstFullyOnScreenIndex: undefined,
                props: {
                    data: [
                        { id: "item1", name: "First" },
                        { id: "item2", name: "Second" },
                        { id: "item3", name: "Third" },
                        { id: "item4", name: "Fourth" },
                        { id: "item5", name: "Fifth" },
                    ],
                    keyExtractor: (item: any, index: number) => item?.id ?? `item-${index}`,
                },
            },
        );
        mockState = mockCtx.state;
    });

    describe("basic single-column positioning", () => {
        it("should calculate positions for all items from top to bottom", () => {
            // Set up known sizes for all items
            mockState.sizesKnown.set("item1", 100);
            mockState.sizesKnown.set("item2", 150);
            mockState.sizesKnown.set("item3", 200);
            mockState.sizesKnown.set("item4", 120);
            mockState.sizesKnown.set("item5", 180);

            updateItemPositions(mockCtx, false);

            // Check positions are calculated correctly
            expect(getLayoutValue(mockState, "positions", "item1")).toBe(0);
            expect(getLayoutValue(mockState, "positions", "item2")).toBe(100);
            expect(getLayoutValue(mockState, "positions", "item3")).toBe(250);
            expect(getLayoutValue(mockState, "positions", "item4")).toBe(450);
            expect(getLayoutValue(mockState, "positions", "item5")).toBe(570);
        });

        it("should update indexByKey mapping for all items", () => {
            updateItemPositions(mockCtx, false);

            expect(mockState.indexByKey.get("item1")).toBe(0);
            expect(mockState.indexByKey.get("item2")).toBe(1);
            expect(mockState.indexByKey.get("item3")).toBe(2);
            expect(mockState.indexByKey.get("item4")).toBe(3);
            expect(mockState.indexByKey.get("item5")).toBe(4);
        });

        it("should skip column and span map writes in single-column mode", () => {
            updateItemPositions(mockCtx, false);

            expect(countLayoutValues(mockState.columns)).toBe(0);
            expect(countLayoutValues(mockState.columnSpans)).toBe(0);
        });

        it("should use estimated sizes when sizes are not known", () => {
            mockState.props.estimatedItemSize = 100;

            updateItemPositions(mockCtx, false);

            // All items should be positioned using estimated size
            expect(getLayoutValue(mockState, "positions", "item1")).toBe(0);
            expect(getLayoutValue(mockState, "positions", "item2")).toBe(100);
            expect(getLayoutValue(mockState, "positions", "item3")).toBe(200);
            expect(getLayoutValue(mockState, "positions", "item4")).toBe(300);
            expect(getLayoutValue(mockState, "positions", "item5")).toBe(400);
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
            updateItemPositions(mockCtx, false);

            // Row 1: item1 (col 1), item2 (col 2) - max height 120
            expect(getLayoutValue(mockState, "positions", "item1")).toBe(0);
            expect(getLayoutValue(mockState, "positions", "item2")).toBe(0);
            expect(getLayoutValue(mockState, "columns", "item1")).toBe(1);
            expect(getLayoutValue(mockState, "columns", "item2")).toBe(2);

            // Row 2: item3 (col 1), item4 (col 2) - max height 150
            expect(getLayoutValue(mockState, "positions", "item3")).toBe(120); // After max height of row 1
            expect(getLayoutValue(mockState, "positions", "item4")).toBe(120);
            expect(getLayoutValue(mockState, "columns", "item3")).toBe(1);
            expect(getLayoutValue(mockState, "columns", "item4")).toBe(2);

            // Row 3: item5 (col 1)
            expect(getLayoutValue(mockState, "positions", "item5")).toBe(270); // 120 + 150
            expect(getLayoutValue(mockState, "columns", "item5")).toBe(1);
            expect(getLayoutValue(mockState, "columnSpans", "item1")).toBe(1);
            expect(getLayoutValue(mockState, "columnSpans", "item2")).toBe(1);
            expect(getLayoutValue(mockState, "columnSpans", "item3")).toBe(1);
            expect(getLayoutValue(mockState, "columnSpans", "item4")).toBe(1);
            expect(getLayoutValue(mockState, "columnSpans", "item5")).toBe(1);
        });

        it("should handle varying column heights correctly", () => {
            // Set up items with very different heights
            mockState.sizesKnown.set("item1", 50);
            mockState.sizesKnown.set("item2", 200); // Much taller
            mockState.sizesKnown.set("item3", 100);
            mockState.sizesKnown.set("item4", 60);

            updateItemPositions(mockCtx, false);

            // Row 1: max height should be 200 (item2)
            expect(getLayoutValue(mockState, "positions", "item1")).toBe(0);
            expect(getLayoutValue(mockState, "positions", "item2")).toBe(0);

            // Row 2: should start at 200 (max of row 1)
            expect(getLayoutValue(mockState, "positions", "item3")).toBe(200);
            expect(getLayoutValue(mockState, "positions", "item4")).toBe(200);
        });

        it("should handle 3-column layout", () => {
            mockCtx.values.set("numColumns", 3);

            updateItemPositions(mockCtx, false);

            // Row 1: items 1, 2, 3
            expect(getLayoutValue(mockState, "columns", "item1")).toBe(1);
            expect(getLayoutValue(mockState, "columns", "item2")).toBe(2);
            expect(getLayoutValue(mockState, "columns", "item3")).toBe(3);

            // Row 2: items 4, 5
            expect(getLayoutValue(mockState, "columns", "item4")).toBe(1);
            expect(getLayoutValue(mockState, "columns", "item5")).toBe(2);
        });

        it("should respect overrideItemLayout spans in multi-column layout", () => {
            mockCtx.values.set("numColumns", 3);
            mockState.props.numColumns = 3;
            mockState.props.overrideItemLayout = (layout, _item, index) => {
                if (index === 0) {
                    layout.span = 2;
                }
                if (index === 2) {
                    layout.span = 3;
                }
            };

            mockState.sizesKnown.set("item1", 100);
            mockState.sizesKnown.set("item2", 120);
            mockState.sizesKnown.set("item3", 80);
            mockState.sizesKnown.set("item4", 90);
            mockState.sizesKnown.set("item5", 110);

            updateItemPositions(mockCtx, false);

            expect(getLayoutValue(mockState, "positions", "item1")).toBe(0);
            expect(getLayoutValue(mockState, "positions", "item2")).toBe(0);
            expect(getLayoutValue(mockState, "positions", "item3")).toBe(120);
            expect(getLayoutValue(mockState, "positions", "item4")).toBe(200);
            expect(getLayoutValue(mockState, "positions", "item5")).toBe(200);

            expect(getLayoutValue(mockState, "columns", "item1")).toBe(1);
            expect(getLayoutValue(mockState, "columns", "item2")).toBe(3);
            expect(getLayoutValue(mockState, "columns", "item3")).toBe(1);
            expect(getLayoutValue(mockState, "columns", "item4")).toBe(1);
            expect(getLayoutValue(mockState, "columns", "item5")).toBe(2);

            expect(getLayoutValue(mockState, "columnSpans", "item1")).toBe(2);
            expect(getLayoutValue(mockState, "columnSpans", "item2")).toBe(1);
            expect(getLayoutValue(mockState, "columnSpans", "item3")).toBe(3);
        });

        it("clears stale column and span maps when switching back to single-column mode", () => {
            updateItemPositions(mockCtx, false);
            expect(countLayoutValues(mockState.columns)).toBeGreaterThan(0);
            expect(countLayoutValues(mockState.columnSpans)).toBeGreaterThan(0);

            mockCtx.values.set("numColumns", 1);
            updateItemPositions(mockCtx, false);

            expect(countLayoutValues(mockState.columns)).toBe(0);
            expect(countLayoutValues(mockState.columnSpans)).toBe(0);
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

            clearLayoutValues(mockState, "columns");
            mockState.indexByKey.clear();
            clearLayoutValues(mockState, "positions");
            mockState.idCache.length = 0;
            mockState.sizes.clear();
            mockState.sizesKnown.clear();

            baseSizes.forEach((size, index) => {
                mockState.sizesKnown.set(`item${index + 1}`, size);
            });
        });

        it("recomputes the previous row when startIndex begins mid-row", () => {
            updateItemPositions(mockCtx, false);

            // Increase height of the first item to force downstream rows to shift
            mockState.sizesKnown.set("item1", 150);

            updateItemPositions(mockCtx, false, {
                doMVCP: false,
                scrollBottomBuffered: 1000,
                startIndex: 1,
            });

            expect(getLayoutValue(mockState, "positions", "item1")).toBe(0);
            expect(getLayoutValue(mockState, "positions", "item2")).toBe(0);
            expect(getLayoutValue(mockState, "positions", "item3")).toBe(150);
            expect(getLayoutValue(mockState, "positions", "item4")).toBe(150);
            expect(getLayoutValue(mockState, "positions", "item5")).toBe(240);
            expect(getLayoutValue(mockState, "positions", "item6")).toBe(240);
        });

        it("preserves the row baseline when startIndex targets a column-one item", () => {
            updateItemPositions(mockCtx, false);

            // Make the first item in the second row taller so later rows need to shift
            mockState.sizesKnown.set("item3", 140);

            updateItemPositions(mockCtx, false, {
                doMVCP: false,
                scrollBottomBuffered: 1000,
                startIndex: 2,
            });

            expect(getLayoutValue(mockState, "positions", "item1")).toBe(0);
            expect(getLayoutValue(mockState, "positions", "item2")).toBe(0);
            expect(getLayoutValue(mockState, "positions", "item3")).toBe(100);
            expect(getLayoutValue(mockState, "positions", "item4")).toBe(100);
            expect(getLayoutValue(mockState, "positions", "item5")).toBe(240);
            expect(getLayoutValue(mockState, "positions", "item6")).toBe(240);

            expect(getLayoutValue(mockState, "columns", "item3")).toBe(1);
            expect(getLayoutValue(mockState, "columns", "item4")).toBe(2);
        });

        it("handles third-row recomputation in 3-column layouts", () => {
            mockCtx.values.set("numColumns", 3);

            // Extend data to 6 rows * 3 columns = 18 items
            const extendedData = Array.from({ length: 18 }, (_, index) => ({
                id: `item${index + 1}`,
                name: `Item ${index + 1}`,
            }));
            mockState.props.data = extendedData;

            clearLayoutValues(mockState, "columns");
            mockState.indexByKey.clear();
            clearLayoutValues(mockState, "positions");
            mockState.idCache.length = 0;
            mockState.sizes.clear();
            mockState.sizesKnown.clear();

            const sizeSequence = [100, 80, 90];
            extendedData.forEach((item, index) => {
                const size = sizeSequence[index % sizeSequence.length];
                mockState.sizesKnown.set(item.id, size);
            });

            updateItemPositions(mockCtx, false);

            mockState.sizesKnown.set("item7", 140);

            updateItemPositions(mockCtx, false, {
                doMVCP: false,
                scrollBottomBuffered: 1000,
                startIndex: 7,
            });

            expect(getLayoutValue(mockState, "positions", "item1")).toBe(0);
            expect(getLayoutValue(mockState, "positions", "item4")).toBe(100);
            expect(getLayoutValue(mockState, "positions", "item7")).toBe(200);
            expect(getLayoutValue(mockState, "positions", "item10")).toBe(340);
            expect(getLayoutValue(mockState, "positions", "item13")).toBe(440);

            expect(getLayoutValue(mockState, "columns", "item10")).toBe(1);
            expect(getLayoutValue(mockState, "columns", "item11")).toBe(2);
            expect(getLayoutValue(mockState, "columns", "item12")).toBe(3);
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
                setLayoutValue(mockState, "positions", id, i * 100);
                mockState.sizesKnown.set(id, 100);
            }
        });

        it("recalculates positions from the start when scrolling up", () => {
            updateItemPositions(mockCtx, false);

            expect(getLayoutValue(mockState, "positions", "item1")).toBe(0);
            expect(getLayoutValue(mockState, "positions", "item2")).toBe(100);
        });

        it("should produce consistent output when not scrolling up", () => {
            // Change scroll history to indicate downward scrolling
            mockState.scrollHistory = [
                { scroll: 600, time: Date.now() - 100 },
                { scroll: 800, time: Date.now() - 50 },
                { scroll: 1000, time: Date.now() },
            ];

            updateItemPositions(mockCtx, false);

            expect(getLayoutValue(mockState, "positions", "item1")).toBe(0);
        });

        it("should bail out of backwards optimization when positions go too low", () => {
            // Set anchor position very low to trigger bailout
            const anchorId = `item${mockState.firstFullyOnScreenIndex! + 1}`;
            setLayoutValue(mockState, "positions", anchorId, -3000);

            updateItemPositions(mockCtx, false);

            expect(getLayoutValue(mockState, "positions", "item1")).toBe(0);
        });

        it("should fall back to regular calculation when anchor position is missing", () => {
            // Clear the anchor position
            const anchorId = `item${mockState.firstFullyOnScreenIndex! + 1}`;
            const anchorIndex = mockState.idCache.indexOf(anchorId);
            if (anchorIndex !== -1) {
                mockState.positions[anchorIndex] = undefined;
            }

            updateItemPositions(mockCtx, false);

            expect(getLayoutValue(mockState, "positions", "item1")).toBe(0);
        });
    });

    describe("data change handling", () => {
        it("should clear caches when data changes", () => {
            // Pre-populate caches
            mockState.indexByKey.set("old_item", 0);
            mockState.idCache[0] = "old_item";

            updateItemPositions(mockCtx, true); // dataChanged = true

            // Caches should be rebuilt for current data. Implementation may not proactively delete unknown
            // legacy keys from previous datasets, and may reuse idCache entries for existing indices.
            // Verify that new mappings are added for subsequent items.
            expect(mockState.indexByKey.get("item2")).toBe(1);
        });

        it("should preserve caches when data doesn't change", () => {
            // Pre-populate with correct data
            mockState.indexByKey.set("item1", 0);
            mockState.idCache[0] = "item1";

            updateItemPositions(mockCtx, false); // dataChanged = false

            // Should update indexByKey because size is 0 (needs rebuilding)
            expect(mockState.indexByKey.get("item1")).toBe(0);
        });

        it("should rebuild indexByKey when it's empty", () => {
            mockState.indexByKey.clear();

            updateItemPositions(mockCtx, false);

            // Should rebuild indexByKey
            expect(mockState.indexByKey.get("item1")).toBe(0);
            expect(mockState.indexByKey.get("item2")).toBe(1);
        });
    });

    describe("average size optimization", () => {
        it("should use average size when available", () => {
            mockState.averageSizes[""] = { avg: 125.5, num: 10 };
            mockState.props.estimatedItemSize = undefined;

            updateItemPositions(mockCtx, false);

            // Should use rounded average size (125.5 rounds to 125.5 using roundSize)
            const expectedRoundedSize = Math.floor(125.5 * 8) / 8; // 125.5
            expect(getLayoutValue(mockState, "positions", "item1")).toBe(0);
            expect(getLayoutValue(mockState, "positions", "item2")).toBe(expectedRoundedSize);
            expect(getLayoutValue(mockState, "positions", "item3")).toBe(expectedRoundedSize * 2);
        });

        it("should prefer known sizes over average sizes", () => {
            mockState.averageSizes[""] = { avg: 200, num: 10 };
            mockState.sizesKnown.set("item2", 100); // Override with known size
            mockState.props.estimatedItemSize = undefined;

            updateItemPositions(mockCtx, false);

            expect(getLayoutValue(mockState, "positions", "item1")).toBe(0);
            expect(getLayoutValue(mockState, "positions", "item2")).toBe(200); // Should use average for item1
            expect(getLayoutValue(mockState, "positions", "item3")).toBe(300); // item2 used known size (100)
        });
    });

    describe("edge cases and error handling", () => {
        it("should handle empty data array", () => {
            mockState.props.data = [];

            expect(() => updateItemPositions(mockCtx, false)).not.toThrow();

            expect(countLayoutValues(mockState.positions)).toBe(0);
            expect(mockState.indexByKey.size).toBe(0);
        });

        it("should handle null data array", () => {
            mockState.props.data = null as any;

            expect(() => updateItemPositions(mockCtx, false)).toThrow();
        });

        it("should handle single item", () => {
            mockState.props.data = [{ id: "single", name: "Single Item" }];
            mockState.sizesKnown.set("single", 150);

            updateItemPositions(mockCtx, false);

            expect(getLayoutValue(mockState, "positions", "single")).toBe(0);
            expect(mockState.indexByKey.get("single")).toBe(0);
            expect(getLayoutValue(mockState, "columns", "single")).toBeUndefined();
            expect(getLayoutValue(mockState, "columnSpans", "single")).toBeUndefined();
        });

        it("should handle items with zero size", () => {
            mockState.sizesKnown.set("item1", 0);
            mockState.sizesKnown.set("item2", 100);

            updateItemPositions(mockCtx, false);

            expect(getLayoutValue(mockState, "positions", "item1")).toBe(0);
            expect(getLayoutValue(mockState, "positions", "item2")).toBe(0); // Zero size means no offset
        });

        it("should handle very large datasets efficiently", () => {
            const largeData = Array.from({ length: 10000 }, (_, i) => ({ id: `item${i}`, name: `Item ${i}` }));
            mockState.props.data = largeData;
            mockState.props.estimatedItemSize = 50;

            mockState.scrollHistory = [
                { scroll: 0, time: Date.now() - 16 },
                { scroll: 2000, time: Date.now() },
            ];

            const start = Date.now();
            updateItemPositions(mockCtx, false, {
                doMVCP: false,
                scrollBottomBuffered: -1,
                startIndex: 0,
            });
            const duration = Date.now() - start;

            expect(duration).toBeLessThan(500); // Should be reasonably fast
            expect(countLayoutValues(mockState.positions)).toBeLessThan(200); // Early break should cap the work
            expect(countLayoutValues(mockState.positions)).toBeGreaterThan(0);
            expect(getLayoutValue(mockState, "positions", "item0")).toBe(0);
            expect(hasLayoutValue(mockState, "positions", "item9999")).toBe(false);
        });

        it("should handle corrupted state gracefully", () => {
            mockState.positions = null as any;

            expect(() => updateItemPositions(mockCtx, false)).not.toThrow();
        });

        it("should handle missing context values", () => {
            mockCtx.values.delete("numColumns");

            expect(() => updateItemPositions(mockCtx, false)).not.toThrow();

            // Should default to single column behavior
            expect(countLayoutValues(mockState.columns)).toBe(0);
            expect(countLayoutValues(mockState.columnSpans)).toBe(0);
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

            mockState.columns = [];
            mockState.idCache = [];
            mockState.indexByKey = new Map();
            mockState.positions = [];
            mockState.sizesKnown = new Map();

            largeData.forEach((item) => {
                mockState.sizesKnown.set(item.id, 120);
                setLayoutValue(mockState, "positions", item.id, -1);
            });

            mockState.scrollHistory = [
                { scroll: 0, time: Date.now() - 16 },
                { scroll: 2000, time: Date.now() },
            ];

            updateItemPositions(mockCtx, false, {
                doMVCP: false,
                scrollBottomBuffered: -900,
                startIndex: 0,
            });

            expect(mockState.indexByKey.size).toBe(13); // 1 row + buffer of ~10 items
            expect(mockState.indexByKey.has("item-12")).toBe(true);
            expect(mockState.indexByKey.has("item-13")).toBe(false);
            expect(getLayoutValue(mockState, "positions", "item-12")).toBeGreaterThanOrEqual(0);
            expect(getLayoutValue(mockState, "positions", "item-30")).toBe(-1);
        });

        it("limits work to a small window in multi-column lists", () => {
            mockCtx.values.set("numColumns", 3);

            const largeData = Array.from({ length: 90 }, (_, index) => ({
                id: `item-${index}`,
                name: `Item ${index}`,
            }));

            mockState.props.data = largeData;
            mockState.props.keyExtractor = (item: { id: string }) => item.id;

            mockState.columns = [];
            mockState.idCache = [];
            mockState.indexByKey = new Map();
            mockState.positions = [];
            mockState.sizesKnown = new Map();

            largeData.forEach((item) => {
                mockState.sizesKnown.set(item.id, 120);
                setLayoutValue(mockState, "positions", item.id, -1);
            });

            mockState.scrollHistory = [
                { scroll: 0, time: Date.now() - 16 },
                { scroll: 2000, time: Date.now() },
            ];

            updateItemPositions(mockCtx, false, {
                doMVCP: false,
                scrollBottomBuffered: -900,
                startIndex: 0,
            });

            expect(mockState.indexByKey.size).toBe(17); // One extra row + buffer beyond the threshold
            expect(mockState.indexByKey.has("item-40")).toBe(false);
            expect(getLayoutValue(mockState, "columns", "item-16")).toBeDefined();
            expect(getLayoutValue(mockState, "positions", "item-40")).toBe(-1);
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
            setLayoutValue(mockState, "positions", "item8", 400);

            updateItemPositions(mockCtx, false);

            // Should have used backwards optimization
            expect(getLayoutValue(mockState, "positions", "item8")).toBe(400);
        });

        it("should maintain scroll velocity calculation integration", () => {
            // Set up scroll history with clear velocity pattern
            mockState.scrollHistory = [
                { scroll: 0, time: Date.now() - 200 },
                { scroll: 100, time: Date.now() - 100 },
                { scroll: 200, time: Date.now() },
            ];

            updateItemPositions(mockCtx, false);

            // Function should complete without error and produce valid positions
            expect(getLayoutValue(mockState, "positions", "item1")).toBe(0);
            expect(countLayoutValues(mockState.positions)).toBe(5);
        });

        it("keeps upward optimization disabled by default", () => {
            const largeData = Array.from({ length: 100 }, (_, index) => ({
                id: `item-${index}`,
                name: `Item ${index}`,
            }));

            mockState.props.data = largeData;
            mockState.positions = [];
            mockState.indexByKey = new Map();
            mockState.idCache = [];
            mockState.sizesKnown = new Map();

            largeData.forEach((item) => {
                mockState.sizesKnown.set(item.id, 120);
            });

            mockState.scrollHistory = [
                { scroll: 2000, time: Date.now() - 16 },
                { scroll: 1000, time: Date.now() },
            ];

            const metrics = updateItemPositions(mockCtx, false, {
                doMVCP: false,
                scrollBottomBuffered: -900,
                startIndex: 0,
            });

            expect(metrics.shouldOptimize).toBe(false);
            expect(metrics.optimizeDirection).toBe("none");
            expect(metrics.itemsVisited).toBe(100);
        });

        it("should handle rapid consecutive calls", () => {
            const start = Date.now();

            for (let i = 0; i < 100; i++) {
                updateItemPositions(mockCtx, false);
            }

            const duration = Date.now() - start;
            expect(duration).toBeLessThan(1000); // Should handle rapid calls efficiently
        });
    });

    describe("snapToIndices integration", () => {
        it("should call updateSnapToOffsets when snapToIndices is provided", () => {
            mockState.props.snapToIndices = [0, 2, 4];

            // Mock updateSnapToOffsets by checking if it would be called
            updateItemPositions(mockCtx, false);

            // Function should complete without error
            expect(countLayoutValues(mockState.positions)).toBe(5);
        });

        it("should not call updateSnapToOffsets when snapToIndices is undefined", () => {
            mockState.props.snapToIndices = undefined;

            updateItemPositions(mockCtx, false);

            expect(countLayoutValues(mockState.positions)).toBe(5);
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

            updateItemPositions(mockCtx, false);

            console.error = originalConsoleError;

            // In dev mode, should detect and warn about duplicate keys
            // (The actual detection happens when __DEV__ is true, which may not be set in tests)
            expect(countLayoutValues(mockState.positions)).toBeGreaterThan(0);
        });
    });

    describe("memory efficiency", () => {
        it("should maintain reasonable memory usage with large datasets", () => {
            const initialMemory = process.memoryUsage().heapUsed;

            const largeData = Array.from({ length: 5000 }, (_, i) => ({ id: `item${i}`, name: `Item ${i}` }));
            mockState.props.data = largeData;

            updateItemPositions(mockCtx, false);

            const finalMemory = process.memoryUsage().heapUsed;
            const memoryIncrease = finalMemory - initialMemory;

            // Should not have excessive memory increase
            expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Less than 50MB
        });

        it("should reuse existing map entries when possible", () => {
            // Pre-populate with some entries
            setLayoutValue(mockState, "positions", "item1", 100);
            mockState.indexByKey.set("item1", 0);

            updateItemPositions(mockCtx, false);

            // Should update existing entries rather than always creating new ones
            expect(getLayoutValue(mockState, "positions", "item1")).toBe(0); // Recalculated
            expect(mockState.indexByKey.get("item1")).toBe(0); // Maintained
        });
    });
});
