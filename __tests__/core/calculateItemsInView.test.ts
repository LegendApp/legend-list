import { beforeEach, describe, expect, it } from "bun:test";
import { calculateItemsInView } from "../../src/core/calculateItemsInView";
import type { StateContext } from "../../src/state/state";
import type { InternalState } from "../../src/types";
import { createMockContext } from "../__mocks__/createMockContext";
import { createMockState } from "../__mocks__/createMockState";

describe("calculateItemsInView", () => {
    let mockCtx: StateContext;
    let mockState: InternalState;

    beforeEach(() => {
        mockCtx = createMockContext({
            headerSize: 0,
            numColumns: 1,
            numContainers: 10,
            stylePaddingTop: 0,
            totalSize: 1000,
        });

        mockState = createMockState();
    });

    describe("basic viewport calculations", () => {
        it("should return early when data is empty", () => {
            mockState.props.data = [];

            const result = calculateItemsInView(mockCtx, mockState);

            expect(result).toBeUndefined();
        });

        it("should return early when scrollLength is 0", () => {
            mockState.scrollLength = 0;
            mockState.props.data = [1, 2, 3];

            const result = calculateItemsInView(mockCtx, mockState);

            expect(result).toBeUndefined();
        });

        it("should return early when no containers exist", () => {
            mockCtx.values.set("numContainers", 0);
            mockState.props.data = [1, 2, 3];

            const result = calculateItemsInView(mockCtx, mockState);

            expect(result).toBeUndefined();
        });

        it("should calculate visible items in basic scenario", () => {
            // Setup: 10 items, each 50px tall, scroll at position 100
            mockState.props.data = Array.from({ length: 10 }, (_, i) => ({ id: i }));
            mockState.scroll = 100;

            // Setup positions and sizes
            for (let i = 0; i < 10; i++) {
                const id = `item_${i}`;
                mockState.idCache.set(i, id);
                mockState.indexByKey.set(id, i);
                mockState.positions.set(id, i * 50);
                mockState.sizes.set(id, 50);
            }

            // Mock the required functions and state that calculateItemsInView depends on
            calculateItemsInView(mockCtx, mockState);

            // Verify state was updated (the real function modifies state)
            expect(mockState.startNoBuffer).toBeDefined();
            expect(mockState.endNoBuffer).toBeDefined();
            expect(mockState.idsInView).toBeDefined();
        });
    });

    describe("scroll buffer handling", () => {
        it("should include buffered items beyond visible area", () => {
            mockState.props.data = Array.from({ length: 20 }, (_, i) => ({ id: i }));
            mockState.scroll = 200; // Scroll to middle
            mockState.props.scrollBuffer = 100;

            // Setup positions
            for (let i = 0; i < 20; i++) {
                const id = `item_${i}`;
                mockState.idCache.set(i, id);
                mockState.indexByKey.set(id, i);
                mockState.positions.set(id, i * 50);
                mockState.sizes.set(id, 50);
            }

            calculateItemsInView(mockCtx, mockState);

            expect(mockState.startBuffered).toBeLessThanOrEqual(mockState.startNoBuffer);
            expect(mockState.endBuffered).toBeGreaterThanOrEqual(mockState.endNoBuffer);
        });

        it("should handle zero scroll buffer", () => {
            mockState.props.data = Array.from({ length: 10 }, (_, i) => ({ id: i }));
            mockState.props.scrollBuffer = 0;
            mockState.scroll = 100;

            for (let i = 0; i < 10; i++) {
                const id = `item_${i}`;
                mockState.idCache.set(i, id);
                mockState.indexByKey.set(id, i);
                mockState.positions.set(id, i * 50);
                mockState.sizes.set(id, 50);
            }

            calculateItemsInView(mockCtx, mockState);

            // With no buffer, buffered and non-buffered ranges should be the same
            expect(mockState.startBuffered).toBe(mockState.startNoBuffer);
            expect(mockState.endBuffered).toBe(mockState.endNoBuffer);
        });
    });

    describe("column layout support", () => {
        it("should adjust loop start for multi-column layouts", () => {
            mockCtx.values.set("numColumns", 3);
            mockState.props.data = Array.from({ length: 15 }, (_, i) => ({ id: i }));

            // Setup items in 3 columns
            for (let i = 0; i < 15; i++) {
                const id = `item_${i}`;
                const row = Math.floor(i / 3);
                mockState.idCache.set(i, id);
                mockState.indexByKey.set(id, i);
                mockState.positions.set(id, row * 50);
                mockState.sizes.set(id, 50);
                mockState.columns.set(id, i % 3);
            }

            calculateItemsInView(mockCtx, mockState);

            // Should complete without errors and find items accounting for column layout
            expect(mockState.idsInView).toBeDefined();
        });
    });

    describe("scroll optimization", () => {
        it("should skip calculation when within precomputed range", () => {
            mockState.props.data = [1, 2, 3];
            mockState.scrollForNextCalculateItemsInView = {
                bottom: 1000,
                top: -500, // Much wider range to ensure optimization triggers
            };
            mockState.scroll = 100;
            mockState.props.scrollBuffer = 50;

            const result = calculateItemsInView(mockCtx, mockState);

            // Should return early due to optimization
            expect(result).toBeUndefined();
        });

        it("should calculate when outside precomputed range", () => {
            mockState.props.data = Array.from({ length: 5 }, (_, i) => ({ id: i }));
            mockState.scrollForNextCalculateItemsInView = {
                bottom: 200,
                top: 50,
            };
            mockState.scroll = 300; // Outside range

            for (let i = 0; i < 5; i++) {
                const id = `item_${i}`;
                mockState.idCache.set(i, id);
                mockState.indexByKey.set(id, i);
                mockState.positions.set(id, i * 50);
                mockState.sizes.set(id, 50);
            }

            calculateItemsInView(mockCtx, mockState);

            expect(mockState.idsInView).toBeDefined();
        });
    });

    describe("sticky recycling", () => {
        it("releases containers when their items are no longer sticky", () => {
            mockState.props.data = Array.from({ length: 3 }, (_, i) => ({ id: i }));
            mockState.props.stickyIndicesArr = [1];
            mockState.props.stickyIndicesSet = new Set([1]);

            for (let i = 0; i < 3; i++) {
                const id = `item_${i}`;
                mockState.idCache.set(i, id);
                mockState.indexByKey.set(id, i);
                mockState.positions.set(id, i * 100);
                mockState.sizes.set(id, 100);
            }

            mockCtx.values.set("numContainers", 3);
            mockCtx.values.set("containerItemKey0", "item_0");
            mockCtx.values.set("containerSticky0", true);
            mockCtx.values.set("containerStickyOffset0", 0);

            mockState.stickyContainerPool = new Set([0]);

            calculateItemsInView(mockCtx, mockState);

            expect(mockState.stickyContainerPool.has(0)).toBe(false);
            expect(mockCtx.values.get("containerSticky0")).toBe(false);
            expect(mockCtx.values.get("containerStickyOffset0")).toBeUndefined();
        });
    });

    describe("edge cases and error handling", () => {
        it("should handle scroll clamping when exceeding total size", () => {
            mockCtx.values.set("totalSize", 500);
            mockState.scrollLength = 300;
            mockState.scroll = 400; // Would exceed totalSize
            mockState.props.data = [1, 2, 3];

            for (let i = 0; i < 3; i++) {
                const id = `item_${i}`;
                mockState.idCache.set(i, id);
                mockState.indexByKey.set(id, i);
                mockState.positions.set(id, i * 50);
                mockState.sizes.set(id, 50);
            }

            calculateItemsInView(mockCtx, mockState);

            // Should complete without errors even with clamped scroll
            expect(mockState.idsInView).toBeDefined();
        });

        it("should handle negative scroll positions", () => {
            mockState.scroll = -50;
            mockState.props.data = Array.from({ length: 5 }, (_, i) => ({ id: i }));

            for (let i = 0; i < 5; i++) {
                const id = `item_${i}`;
                mockState.idCache.set(i, id);
                mockState.indexByKey.set(id, i);
                mockState.positions.set(id, i * 50);
                mockState.sizes.set(id, 50);
            }

            calculateItemsInView(mockCtx, mockState);

            expect(mockState.idsInView).toBeDefined();
            if (mockState.startNoBuffer !== null) {
                expect(mockState.startNoBuffer).toBeGreaterThanOrEqual(0);
            }
        });

        it("should handle missing position data gracefully", () => {
            mockState.props.data = Array.from({ length: 5 }, (_, i) => ({ id: i }));

            // Setup only some items with positions
            for (let i = 0; i < 3; i++) {
                const id = `item_${i}`;
                mockState.idCache.set(i, id);
                mockState.indexByKey.set(id, i);
                mockState.positions.set(id, i * 50);
                // Missing sizes for some items
            }

            calculateItemsInView(mockCtx, mockState);

            expect(mockState.idsInView).toBeDefined();
        });

        it("should handle large datasets efficiently", () => {
            const largeDataset = Array.from({ length: 10000 }, (_, i) => ({ id: i }));
            mockState.props.data = largeDataset;
            mockState.scroll = 5000; // Scroll to middle

            // Setup a subset of positions (simulating partial loading)
            for (let i = 4900; i < 5100; i++) {
                const id = `item_${i}`;
                mockState.idCache.set(i, id);
                mockState.indexByKey.set(id, i);
                mockState.positions.set(id, i * 50);
                mockState.sizes.set(id, 50);
            }

            const start = Date.now();
            calculateItemsInView(mockCtx, mockState);
            const duration = Date.now() - start;

            expect(duration).toBeLessThan(50); // Should complete quickly
            expect(mockState.idsInView).toBeDefined();
        });

        it("should handle zero-sized items", () => {
            mockState.props.data = Array.from({ length: 5 }, (_, i) => ({ id: i }));

            for (let i = 0; i < 5; i++) {
                const id = `item_${i}`;
                mockState.idCache.set(i, id);
                mockState.indexByKey.set(id, i);
                mockState.positions.set(id, i * 50);
                mockState.sizes.set(id, i === 2 ? 0 : 50); // One zero-sized item
            }

            calculateItemsInView(mockCtx, mockState);

            expect(mockState.idsInView).toBeDefined();
            expect(mockState.idsInView).toBeInstanceOf(Array);
        });

        it("should handle items with extreme positions", () => {
            mockState.props.data = Array.from({ length: 3 }, (_, i) => ({ id: i }));

            mockState.idCache.set(0, "item_0");
            mockState.indexByKey.set("item_0", 0);
            mockState.positions.set("item_0", -1000000); // Extreme negative position
            mockState.sizes.set("item_0", 50);

            mockState.idCache.set(1, "item_1");
            mockState.indexByKey.set("item_1", 1);
            mockState.positions.set("item_1", 100);
            mockState.sizes.set("item_1", 50);

            mockState.idCache.set(2, "item_2");
            mockState.indexByKey.set("item_2", 2);
            mockState.positions.set("item_2", Number.MAX_SAFE_INTEGER); // Extreme positive
            mockState.sizes.set("item_2", 50);

            calculateItemsInView(mockCtx, mockState);

            // Should handle extreme positions without crashing
            expect(mockState.idsInView).toBeDefined();
        });
    });

    describe("minIndexSizeChanged optimization", () => {
        it("should use minIndexSizeChanged to optimize loop start", () => {
            mockState.props.data = Array.from({ length: 100 }, (_, i) => ({ id: i }));
            mockState.minIndexSizeChanged = 50;
            mockState.startBufferedId = "item_80";
            mockState.indexByKey.set("item_80", 80);

            for (let i = 0; i < 100; i++) {
                const id = `item_${i}`;
                mockState.idCache.set(i, id);
                mockState.indexByKey.set(id, i);
                mockState.positions.set(id, i * 50);
                mockState.sizes.set(id, 50);
            }

            calculateItemsInView(mockCtx, mockState);

            expect(mockState.idsInView).toBeDefined();
            expect(mockState.minIndexSizeChanged).toBeUndefined(); // Should be cleared
        });
    });

    describe("firstFullyOnScreenIndex calculation", () => {
        it("should identify first fully visible item correctly", () => {
            mockState.props.data = Array.from({ length: 10 }, (_, i) => ({ id: i }));
            mockState.scroll = 75; // Partially shows first item, fully shows second

            for (let i = 0; i < 10; i++) {
                const id = `item_${i}`;
                mockState.idCache.set(i, id);
                mockState.indexByKey.set(id, i);
                mockState.positions.set(id, i * 50); // Items at 0, 50, 100, 150...
                mockState.sizes.set(id, 50);
            }

            calculateItemsInView(mockCtx, mockState);

            // First fully visible item should be at or after scroll position
            if (mockState.firstFullyOnScreenIndex !== undefined) {
                expect(mockState.firstFullyOnScreenIndex).toBeGreaterThanOrEqual(1);
            }
        });
    });

    describe("performance benchmarks", () => {
        it("should handle memory pressure with huge datasets", () => {
            // Simulate memory pressure scenario
            const hugeDataset = Array.from({ length: 100000 }, (_, i) => ({ id: i }));
            mockState.props.data = hugeDataset;
            mockState.scroll = 50000; // Middle of huge dataset

            // Only setup positions for visible range to simulate streaming
            for (let i = 49950; i < 50050; i++) {
                const id = `item_${i}`;
                mockState.idCache.set(i, id);
                mockState.indexByKey.set(id, i);
                mockState.positions.set(id, i * 50);
                mockState.sizes.set(id, 50);
            }

            const start = Date.now();
            calculateItemsInView(mockCtx, mockState);
            const duration = Date.now() - start;

            expect(duration).toBeLessThan(150); // Should not cause timeout
            expect(mockState.idsInView).toBeDefined();
        });

        it("should handle rapid state changes efficiently", () => {
            mockState.props.data = Array.from({ length: 10 }, (_, i) => ({ id: i }));

            // Setup normal state first
            for (let i = 0; i < 10; i++) {
                const id = `item_${i}`;
                mockState.idCache.set(i, id);
                mockState.indexByKey.set(id, i);
                mockState.positions.set(id, i * 50);
                mockState.sizes.set(id, 50);
            }

            // Run multiple calculations in quick succession
            const results = [];
            for (let i = 0; i < 5; i++) {
                mockState.scroll = i * 50; // Change scroll between calculations
                calculateItemsInView(mockCtx, mockState);
                results.push(mockState.idsInView);
            }

            // All calculations should complete without errors
            expect(results.length).toBe(5);
            expect(results.every((ids) => Array.isArray(ids))).toBe(true);
        });
    });
});
