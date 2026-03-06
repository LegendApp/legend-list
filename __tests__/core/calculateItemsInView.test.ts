import { Platform } from "@/platform/Platform";
import { beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import { calculateItemsInView } from "../../src/core/calculateItemsInView";
import { finishScrollTo } from "../../src/core/finishScrollTo";
import * as mvcpModule from "../../src/core/mvcp";
import type { StateContext } from "../../src/state/state";
import type { InternalState } from "../../src/types";
import { getAlwaysRenderIndices } from "../../src/utils/getAlwaysRenderIndices";
import { createMockContext } from "../__mocks__/createMockContext";
import { clearLayoutValues, countLayoutValues, setLayoutValue } from "../helpers/layoutArrays";

describe("calculateItemsInView", () => {
    let mockCtx: StateContext;
    let mockState: InternalState;

    beforeEach(() => {
        mockCtx = createMockContext(
            {
                headerSize: 0,
                numColumns: 1,
                numContainers: 10,
                stylePaddingTop: 0,
                totalSize: 1000,
            },
            {},
        );

        mockState = mockCtx.state;
    });

    describe("basic viewport calculations", () => {
        it("should return early when data is empty", () => {
            mockState.props.data = [];

            const result = calculateItemsInView(mockCtx);

            expect(result).toBeUndefined();
        });

        it("should return early when scrollLength is 0", () => {
            mockState.scrollLength = 0;
            mockState.props.data = [1, 2, 3];

            const result = calculateItemsInView(mockCtx);

            expect(result).toBeUndefined();
        });

        it("should return early when no containers exist", () => {
            mockCtx.values.set("numContainers", 0);
            mockState.props.data = [1, 2, 3];

            const result = calculateItemsInView(mockCtx);

            expect(result).toBeUndefined();
        });

        it("should calculate visible items in basic scenario", () => {
            // Setup: 10 items, each 50px tall, scroll at position 100
            mockState.props.data = Array.from({ length: 10 }, (_, i) => ({ id: i }));
            mockState.scroll = 100;

            // Setup positions and sizes
            for (let i = 0; i < 10; i++) {
                const id = `item_${i}`;
                mockState.idCache[i] = id;
                mockState.indexByKey.set(id, i);
                setLayoutValue(mockState, "positions", id, i * 50);
                mockState.sizes.set(id, 50);
            }

            // Mock the required functions and state that calculateItemsInView depends on
            calculateItemsInView(mockCtx);

            // Verify state was updated (the real function modifies state)
            expect(mockState.startNoBuffer).toBeDefined();
            expect(mockState.endNoBuffer).toBeDefined();
            expect(mockState.idsInView).toBeDefined();
        });

        it("tracks an intersecting oversized item when no item starts inside the viewport", () => {
            mockState.props.data = Array.from({ length: 3 }, (_, i) => ({ id: i }));
            mockState.props.drawDistance = 0;
            mockState.scroll = 250;
            mockState.scrollLength = 300;

            const layout = [
                { id: "item_0", position: 0, size: 100 },
                { id: "item_1", position: 100, size: 800 },
                { id: "item_2", position: 900, size: 100 },
            ];

            for (const { id, position, size } of layout) {
                const index = Number(id.split("_")[1]);
                mockState.idCache[index] = id;
                mockState.indexByKey.set(id, index);
                setLayoutValue(mockState, "positions", id, position);
                mockState.sizes.set(id, size);
            }

            calculateItemsInView(mockCtx);

            expect(mockState.startNoBuffer).toBe(1);
            expect(mockState.endNoBuffer).toBe(1);
            expect(mockState.idsInView).toEqual(["item_1"]);
        });
    });

    describe("scroll buffer handling", () => {
        it("should include buffered items beyond visible area", () => {
            mockState.props.data = Array.from({ length: 20 }, (_, i) => ({ id: i }));
            mockState.scroll = 200; // Scroll to middle
            mockState.props.drawDistance = 100;

            // Setup positions
            for (let i = 0; i < 20; i++) {
                const id = `item_${i}`;
                mockState.idCache[i] = id;
                mockState.indexByKey.set(id, i);
                setLayoutValue(mockState, "positions", id, i * 50);
                mockState.sizes.set(id, 50);
            }

            calculateItemsInView(mockCtx);

            expect(mockState.startBuffered).toBeLessThanOrEqual(mockState.startNoBuffer);
            expect(mockState.endBuffered).toBeGreaterThanOrEqual(mockState.endNoBuffer);
        });

        it("should handle zero scroll buffer", () => {
            mockState.props.data = Array.from({ length: 10 }, (_, i) => ({ id: i }));
            mockState.props.drawDistance = 0;
            mockState.scroll = 100;

            for (let i = 0; i < 10; i++) {
                const id = `item_${i}`;
                mockState.idCache[i] = id;
                mockState.indexByKey.set(id, i);
                setLayoutValue(mockState, "positions", id, i * 50);
                mockState.sizes.set(id, 50);
            }

            calculateItemsInView(mockCtx);

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
                mockState.idCache[i] = id;
                mockState.indexByKey.set(id, i);
                setLayoutValue(mockState, "positions", id, row * 50);
                mockState.sizes.set(id, 50);
                setLayoutValue(mockState, "columns", id, (i % 3) + 1);
            }

            calculateItemsInView(mockCtx);

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
            mockState.props.drawDistance = 50;

            const result = calculateItemsInView(mockCtx);

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
                mockState.idCache[i] = id;
                mockState.indexByKey.set(id, i);
                setLayoutValue(mockState, "positions", id, i * 50);
                mockState.sizes.set(id, 50);
            }

            calculateItemsInView(mockCtx);

            expect(mockState.idsInView).toBeDefined();
        });

        it("should bypass precomputed-range early return when mvcp mode is active", () => {
            const prevPlatform = Platform.OS;
            Platform.OS = "web";
            try {
                const prepareMVCPSpy = spyOn(mvcpModule, "prepareMVCP").mockImplementation(() => undefined);
                try {
                    mockState.props.data = [1, 2, 3];
                    mockState.scrollForNextCalculateItemsInView = {
                        bottom: 1000,
                        top: -500,
                    };
                    mockState.scroll = 100;
                    mockState.props.drawDistance = 50;
                    mockState.mvcpAnchorLock = {
                        expiresAt: Date.now() + 1000,
                        id: "item_0",
                        position: 0,
                        quietPasses: 0,
                    };

                    calculateItemsInView(mockCtx, { doMVCP: true });

                    expect(prepareMVCPSpy).toHaveBeenCalledTimes(1);
                } finally {
                    prepareMVCPSpy.mockRestore();
                }
            } finally {
                Platform.OS = prevPlatform;
            }
        });

        it("should not cache null bounds when buffered viewport covers content", () => {
            mockCtx.values.set("totalSize", 100);
            mockState.props.data = Array.from({ length: 2 }, (_, i) => ({ id: i }));
            mockState.scroll = 0;
            mockState.props.drawDistance = 100;
            mockState.scrollLength = 300;

            for (let i = 0; i < 2; i++) {
                const id = `item_${i}`;
                mockState.idCache[i] = id;
                mockState.indexByKey.set(id, i);
                setLayoutValue(mockState, "positions", id, i * 50);
                mockState.sizes.set(id, 50);
            }

            calculateItemsInView(mockCtx);

            expect(mockState.scrollForNextCalculateItemsInView).toBeUndefined();
            expect(mockState.idsInView.length).toBeGreaterThan(0);
        });

        it("should ignore cached bounds when both are null", () => {
            mockState.props.data = Array.from({ length: 5 }, (_, i) => ({ id: i }));
            mockState.scrollForNextCalculateItemsInView = { bottom: null, top: null };
            mockState.scroll = 0;

            for (let i = 0; i < 5; i++) {
                const id = `item_${i}`;
                mockState.idCache[i] = id;
                mockState.indexByKey.set(id, i);
                setLayoutValue(mockState, "positions", id, i * 50);
                mockState.sizes.set(id, 50);
            }

            calculateItemsInView(mockCtx);

            expect(mockState.idsInView.length).toBeGreaterThan(0);
            const cached = mockState.scrollForNextCalculateItemsInView;
            if (cached) {
                expect(cached.top === null && cached.bottom === null).toBe(false);
            }
        });

        it("completes a full position update after optimized scrolling finishes", () => {
            const itemCount = 50;
            mockState.props.data = Array.from({ length: itemCount }, (_, index) => ({ value: index }));
            mockState.scrollLength = 600;
            mockState.scroll = 0;
            mockState.props.drawDistance = 100;
            mockState.scrollingTo = { animated: true, offset: 400 } as any;

            const now = Date.now();
            mockState.scrollHistory = [
                { scroll: 0, time: now - 16 },
                { scroll: 400, time: now },
            ];

            for (let i = 0; i < itemCount; i++) {
                const id = mockState.props.keyExtractor?.(mockState.props.data[i], i) ?? `item_${i}`;
                mockState.idCache[i] = id;
                mockState.sizesKnown.set(id, 120);
            }

            mockCtx.state = mockState;
            mockState.triggerCalculateItemsInView = (params) => calculateItemsInView(mockCtx, params);

            calculateItemsInView(mockCtx);

            const initialPositions = countLayoutValues(mockState.positions);

            finishScrollTo(mockCtx);

            expect(countLayoutValues(mockState.positions)).toBe(itemCount);
            expect(countLayoutValues(mockState.positions)).toBeGreaterThanOrEqual(initialPositions);
        });
    });

    describe("sticky recycling", () => {
        it("releases containers when their items are no longer sticky", () => {
            mockState.props.data = Array.from({ length: 3 }, (_, i) => ({ id: i }));
            mockState.props.stickyIndicesArr = [1];
            mockState.props.stickyIndicesSet = new Set<number>([1]);

            for (let i = 0; i < 3; i++) {
                const id = `item_${i}`;
                mockState.idCache[i] = id;
                mockState.indexByKey.set(id, i);
                setLayoutValue(mockState, "positions", id, i * 100);
                mockState.sizes.set(id, 100);
            }

            mockCtx.values.set("numContainers", 3);
            mockCtx.values.set("containerItemKey0", "item_0");
            mockCtx.values.set("containerSticky0", true);

            mockState.stickyContainerPool = new Set([0]);

            calculateItemsInView(mockCtx);

            expect(mockState.stickyContainerPool.has(0)).toBe(false);
            expect(mockCtx.values.get("containerSticky0")).toBe(false);
        });
    });

    describe("always render", () => {
        const setupList = (count = 50, size = 20) => {
            mockState.props.data = Array.from({ length: count }, (_, i) => ({ id: i }));
            mockState.props.drawDistance = 0;
            mockState.scrollLength = 100;
            mockCtx.values.set("numContainers", 12);
            mockCtx.values.set("totalSize", count * size);

            mockState.idCache.length = 0;
            mockState.indexByKey.clear();
            clearLayoutValues(mockState, "positions");
            mockState.sizes.clear();

            for (let i = 0; i < count; i++) {
                const id = `item_${i}`;
                mockState.idCache[i] = id;
                mockState.indexByKey.set(id, i);
                setLayoutValue(mockState, "positions", id, i * size);
                mockState.sizes.set(id, size);
            }
        };

        it("keeps top and bottom ranges mounted across scroll", () => {
            setupList(60, 10);
            const alwaysRender = { bottom: 2, top: 2 };
            mockState.props.alwaysRender = alwaysRender;
            const indices = getAlwaysRenderIndices(alwaysRender, mockState.props.data, mockState.props.keyExtractor!);
            mockState.props.alwaysRenderIndicesArr = indices;
            mockState.props.alwaysRenderIndicesSet = new Set(indices);

            mockState.scroll = 0;
            calculateItemsInView(mockCtx);

            expect(mockState.containerItemKeys.has("item_58")).toBe(true);
            expect(mockState.containerItemKeys.has("item_59")).toBe(true);

            mockState.scroll = 500;
            calculateItemsInView(mockCtx);

            expect(mockState.containerItemKeys.has("item_0")).toBe(true);
            expect(mockState.containerItemKeys.has("item_1")).toBe(true);
        });

        it("renders configured indices and keys while ignoring out-of-range values", () => {
            setupList(40, 15);
            const alwaysRender = {
                indices: [5, 12, 39, 999],
                keys: ["item_7", "missing_key"],
            };
            mockState.props.alwaysRender = alwaysRender;
            const indices = getAlwaysRenderIndices(alwaysRender, mockState.props.data, mockState.props.keyExtractor!);
            mockState.props.alwaysRenderIndicesArr = indices;
            mockState.props.alwaysRenderIndicesSet = new Set(indices);

            mockState.scroll = 0;
            calculateItemsInView(mockCtx);

            expect(mockState.containerItemKeys.has("item_5")).toBe(true);
            expect(mockState.containerItemKeys.has("item_12")).toBe(true);
            expect(mockState.containerItemKeys.has("item_39")).toBe(true);
            expect(mockState.containerItemKeys.has("item_7")).toBe(true);
            expect(mockState.containerItemKeys.has("item_999")).toBe(false);
            expect(mockState.containerItemKeys.has("missing_key")).toBe(false);
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
                mockState.idCache[i] = id;
                mockState.indexByKey.set(id, i);
                setLayoutValue(mockState, "positions", id, i * 50);
                mockState.sizes.set(id, 50);
            }

            calculateItemsInView(mockCtx);

            // Should complete without errors even with clamped scroll
            expect(mockState.idsInView).toBeDefined();
        });

        it("should handle negative scroll positions", () => {
            mockState.scroll = -50;
            mockState.props.data = Array.from({ length: 5 }, (_, i) => ({ id: i }));

            for (let i = 0; i < 5; i++) {
                const id = `item_${i}`;
                mockState.idCache[i] = id;
                mockState.indexByKey.set(id, i);
                setLayoutValue(mockState, "positions", id, i * 50);
                mockState.sizes.set(id, 50);
            }

            calculateItemsInView(mockCtx);

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
                mockState.idCache[i] = id;
                mockState.indexByKey.set(id, i);
                setLayoutValue(mockState, "positions", id, i * 50);
                // Missing sizes for some items
            }

            calculateItemsInView(mockCtx);

            expect(mockState.idsInView).toBeDefined();
        });

        it("should handle large datasets efficiently", () => {
            const largeDataset = Array.from({ length: 10000 }, (_, i) => ({ id: i }));
            mockState.props.data = largeDataset;
            mockState.scroll = 5000; // Scroll to middle

            // Setup a subset of positions (simulating partial loading)
            for (let i = 4900; i < 5100; i++) {
                const id = `item_${i}`;
                mockState.idCache[i] = id;
                mockState.indexByKey.set(id, i);
                setLayoutValue(mockState, "positions", id, i * 50);
                mockState.sizes.set(id, 50);
            }

            const start = Date.now();
            calculateItemsInView(mockCtx);
            const duration = Date.now() - start;

            expect(duration).toBeLessThan(50); // Should complete quickly
            expect(mockState.idsInView).toBeDefined();
        });

        it("should handle zero-sized items", () => {
            mockState.props.data = Array.from({ length: 5 }, (_, i) => ({ id: i }));

            for (let i = 0; i < 5; i++) {
                const id = `item_${i}`;
                mockState.idCache[i] = id;
                mockState.indexByKey.set(id, i);
                setLayoutValue(mockState, "positions", id, i * 50);
                mockState.sizes.set(id, i === 2 ? 0 : 50); // One zero-sized item
            }

            calculateItemsInView(mockCtx);

            expect(mockState.idsInView).toBeDefined();
            expect(mockState.idsInView).toBeInstanceOf(Array);
        });

        it("should handle items with extreme positions", () => {
            mockState.props.data = Array.from({ length: 3 }, (_, i) => ({ id: i }));

            mockState.idCache[0] = "item_0";
            mockState.indexByKey.set("item_0", 0);
            setLayoutValue(mockState, "positions", "item_0", -1000000); // Extreme negative position
            mockState.sizes.set("item_0", 50);

            mockState.idCache[1] = "item_1";
            mockState.indexByKey.set("item_1", 1);
            setLayoutValue(mockState, "positions", "item_1", 100);
            mockState.sizes.set("item_1", 50);

            mockState.idCache[2] = "item_2";
            mockState.indexByKey.set("item_2", 2);
            setLayoutValue(mockState, "positions", "item_2", Number.MAX_SAFE_INTEGER); // Extreme positive
            mockState.sizes.set("item_2", 50);

            calculateItemsInView(mockCtx);

            // Should handle extreme positions without crashing
            expect(mockState.idsInView).toBeDefined();
        });
    });

    describe("sticky header callbacks", () => {
        const setupStickyScenario = () => {
            mockState.props.data = [
                { id: "item0", label: "A" },
                { id: "item1", label: "B" },
                { id: "item2", label: "C" },
            ];
            mockState.props.stickyIndicesArr = [0, 1];
            mockState.props.stickyIndicesSet = new Set([0, 1]);

            mockState.idCache.length = 0;
            mockState.indexByKey.clear();
            clearLayoutValues(mockState, "positions");
            mockState.sizes.clear();

            for (let i = 0; i < mockState.props.data.length; i++) {
                const id = `item_${i}`;
                mockState.idCache[i] = id;
                mockState.indexByKey.set(id, i);
                setLayoutValue(mockState, "positions", id, i * 100);
                mockState.sizes.set(id, 100);
            }
        };

        it("should call onStickyHeaderChange when the active sticky index changes", () => {
            const onStickyHeaderChange = mock();
            setupStickyScenario();
            mockState.props.onStickyHeaderChange = onStickyHeaderChange;
            mockCtx.values.set("activeStickyIndex", 0);
            mockState.scroll = 150; // Should activate sticky index 1

            calculateItemsInView(mockCtx);

            expect(onStickyHeaderChange).toHaveBeenCalledTimes(1);
            expect(onStickyHeaderChange).toHaveBeenCalledWith({
                index: 1,
                item: mockState.props.data[1],
            });
        });

        it("should not call onStickyHeaderChange when the sticky index remains the same", () => {
            const onStickyHeaderChange = mock();
            setupStickyScenario();
            mockState.props.onStickyHeaderChange = onStickyHeaderChange;
            mockCtx.values.set("activeStickyIndex", 0);
            mockState.scroll = 10; // Keeps sticky index at 0

            calculateItemsInView(mockCtx);

            expect(onStickyHeaderChange).not.toHaveBeenCalled();
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
                mockState.idCache[i] = id;
                mockState.indexByKey.set(id, i);
                setLayoutValue(mockState, "positions", id, i * 50);
                mockState.sizes.set(id, 50);
            }

            calculateItemsInView(mockCtx);

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
                mockState.idCache[i] = id;
                mockState.indexByKey.set(id, i);
                setLayoutValue(mockState, "positions", id, i * 50); // Items at 0, 50, 100, 150...
                mockState.sizes.set(id, 50);
            }

            calculateItemsInView(mockCtx);

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
                mockState.idCache[i] = id;
                mockState.indexByKey.set(id, i);
                setLayoutValue(mockState, "positions", id, i * 50);
                mockState.sizes.set(id, 50);
            }

            const start = Date.now();
            calculateItemsInView(mockCtx);
            const duration = Date.now() - start;

            expect(duration).toBeLessThan(150); // Should not cause timeout
            expect(mockState.idsInView).toBeDefined();
        });

        it("should handle rapid state changes efficiently", () => {
            mockState.props.data = Array.from({ length: 10 }, (_, i) => ({ id: i }));

            // Setup normal state first
            for (let i = 0; i < 10; i++) {
                const id = `item_${i}`;
                mockState.idCache[i] = id;
                mockState.indexByKey.set(id, i);
                setLayoutValue(mockState, "positions", id, i * 50);
                mockState.sizes.set(id, 50);
            }

            // Run multiple calculations in quick succession
            const results = [];
            for (let i = 0; i < 5; i++) {
                mockState.scroll = i * 50; // Change scroll between calculations
                calculateItemsInView(mockCtx);
                results.push(mockState.idsInView);
            }

            // All calculations should complete without errors
            expect(results.length).toBe(5);
            expect(results.every((ids) => Array.isArray(ids))).toBe(true);
        });
    });
});
