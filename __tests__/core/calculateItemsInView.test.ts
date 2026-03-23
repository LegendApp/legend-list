import { Platform } from "@/platform/Platform";
import { beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import { calculateItemsInView } from "../../src/core/calculateItemsInView";
import { finishScrollTo } from "../../src/core/finishScrollTo";
import * as mvcpModule from "../../src/core/mvcp";
import { updateScroll } from "../../src/core/updateScroll";
import type { StateContext } from "../../src/state/state";
import type { InternalState } from "../../src/types";
import { getAlwaysRenderIndices } from "../../src/utils/getAlwaysRenderIndices";
import { normalizeMaintainVisibleContentPosition } from "../../src/utils/normalizeMaintainVisibleContentPosition";
import * as requestAdjustModule from "../../src/utils/requestAdjust";
import { createMockContext } from "../__mocks__/createMockContext";
import { clearLayoutValues, countLayoutValues, setLayoutValue } from "../helpers/layoutArrays";

const originalNavigator = globalThis.navigator;

function seedLinearItems(state: InternalState, count: number, size: number) {
    state.props.data = Array.from({ length: count }, (_, i) => ({ id: i }));

    for (let i = 0; i < count; i++) {
        const id = `item_${i}`;
        state.idCache[i] = id;
        state.indexByKey.set(id, i);
        setLayoutValue(state, "positions", id, i * size);
        state.sizes.set(id, size);
        state.sizesKnown.set(id, size);
    }
}

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

        it("uses the updated content size when caching bounds after appending at the end", () => {
            mockCtx.values.set("totalSize", 1000);
            mockState.totalSize = 1000;
            mockState.props.data = Array.from({ length: 20 }, (_, i) => ({ id: i }));
            mockState.scroll = 700;
            mockState.scrollLength = 300;
            mockState.props.drawDistance = 100;

            for (let i = 0; i < 24; i++) {
                const id = `item_${i}`;
                if (i < 20) {
                    mockState.idCache[i] = id;
                    mockState.indexByKey.set(id, i);
                    setLayoutValue(mockState, "positions", id, i * 50);
                }
                mockState.sizes.set(id, 50);
                mockState.sizesKnown.set(id, 50);
            }

            mockState.props.data = Array.from({ length: 24 }, (_, i) => ({ id: i }));

            calculateItemsInView(mockCtx, { dataChanged: true });

            expect(mockCtx.values.get("totalSize")).toBe(1200);
            expect(mockState.scrollForNextCalculateItemsInView).toEqual({
                bottom: 1100,
                top: 550,
            });
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

        it("keeps deferred visual compensation stable when consuming an above-viewport deferred shift", () => {
            mockState.props.data = Array.from({ length: 15 }, (_, i) => ({ id: i }));
            mockState.props.drawDistance = 0;
            mockState.didFinishInitialScroll = true;
            mockState.scroll = 550;
            mockState.scrollLength = 100;

            for (let i = 0; i < 15; i++) {
                const id = `item_${i}`;
                mockState.idCache[i] = id;
                mockState.indexByKey.set(id, i);
                setLayoutValue(mockState, "positions", id, i * 50);
                mockState.sizes.set(id, 50);
                mockState.sizesKnown.set(id, 50);
            }

            calculateItemsInView(mockCtx);

            const positionsBefore = new Map<string, number>();
            for (let i = 0; i < 10; i++) {
                const itemKey = mockCtx.values.get(`containerItemKey${i}`);
                const position = mockCtx.values.get(`containerPosition${i}`);
                if (itemKey !== undefined && typeof position === "number") {
                    positionsBefore.set(itemKey, position);
                }
            }

            mockState.sizes.set("item_0", 150);
            mockState.sizesKnown.set("item_0", 150);
            mockState.minIndexSizeChanged = 0;
            mockState.pendingDeferredSizeShift = 100;

            calculateItemsInView(mockCtx);

            expect(mockState.deferredPositionDelta).toBe(100);
            expect(mockState.pendingDeferredSizeShift).toBe(0);
            expect(mockCtx.values.get("containerPosition0")).toBe(positionsBefore.get("item_11"));
            expect(mockCtx.values.get("containerPosition1")).toBe(positionsBefore.get("item_12"));
            expect(mockCtx.values.get("containerPosition2")).toBe(positionsBefore.get("item_13"));
        });

        it("discards queued deferred shifts when the layout shape is unsupported", () => {
            mockCtx.values.set("numColumns", 2);
            mockState.props.data = Array.from({ length: 6 }, (_, i) => ({ id: i }));
            mockState.didContainersLayout = true;
            mockState.didFinishInitialScroll = true;
            mockState.pendingDeferredSizeShift = 40;

            for (let i = 0; i < 6; i++) {
                const id = `item_${i}`;
                mockState.idCache[i] = id;
                mockState.indexByKey.set(id, i);
                setLayoutValue(mockState, "positions", id, i * 50);
                setLayoutValue(mockState, "columns", id, (i % 2) + 1);
                mockState.sizes.set(id, 50);
                mockState.sizesKnown.set(id, 50);
            }

            calculateItemsInView(mockCtx);

            expect(mockState.deferredPositionDelta).toBe(0);
            expect(mockState.pendingDeferredSizeShift).toBe(0);
        });

        it("defers unsupported-layout rebases until containers layout is ready", () => {
            const requestAdjustSpy = spyOn(requestAdjustModule, "requestAdjust");
            try {
                mockCtx.values.set("numColumns", 2);
                mockState.props.data = Array.from({ length: 6 }, (_, i) => ({ id: i }));
                mockState.didContainersLayout = false;
                mockState.didFinishInitialScroll = true;
                mockState.pendingDeferredSizeShift = 40;

                for (let i = 0; i < 6; i++) {
                    const id = `item_${i}`;
                    mockState.idCache[i] = id;
                    mockState.indexByKey.set(id, i);
                    setLayoutValue(mockState, "positions", id, i * 50);
                    setLayoutValue(mockState, "columns", id, (i % 2) + 1);
                    mockState.sizes.set(id, 50);
                    mockState.sizesKnown.set(id, 50);
                }

                calculateItemsInView(mockCtx, { doMVCP: true });

                expect(requestAdjustSpy).not.toHaveBeenCalled();
                expect(mockState.deferredPositionDelta).toBe(0);
                expect(mockState.pendingDeferredSizeShift).toBe(40);
            } finally {
                requestAdjustSpy.mockRestore();
            }
        });

        it("defers unsupported-layout rebases while a fresh native mvcp adjust is active", () => {
            const requestAdjustSpy = spyOn(requestAdjustModule, "requestAdjust");
            const previousPlatform = Platform.OS;
            Platform.OS = "ios";
            try {
                mockCtx.values.set("numColumns", 2);
                mockState.props.data = Array.from({ length: 6 }, (_, i) => ({ id: i }));
                mockState.didContainersLayout = true;
                mockState.didFinishInitialScroll = true;
                mockState.deferredPositionDelta = 90;
                mockState.pendingNativeMVCPAdjust = {
                    amount: -20,
                    furthestProgressTowardAmount: 0,
                    manualApplied: 0,
                    startScroll: 100,
                };

                for (let i = 0; i < 6; i++) {
                    const id = `item_${i}`;
                    mockState.idCache[i] = id;
                    mockState.indexByKey.set(id, i);
                    setLayoutValue(mockState, "positions", id, i * 50);
                    setLayoutValue(mockState, "columns", id, (i % 2) + 1);
                    mockState.sizes.set(id, 50);
                    mockState.sizesKnown.set(id, 50);
                }

                calculateItemsInView(mockCtx, { doMVCP: true });

                expect(requestAdjustSpy).not.toHaveBeenCalled();
                expect(mockState.deferredPositionDelta).toBe(90);
                expect(mockState.scroll).toBe(0);
            } finally {
                Platform.OS = previousPlatform;
                requestAdjustSpy.mockRestore();
            }
        });

        it("rebases committed deferred delta on data-change passes", () => {
            const requestAdjustSpy = spyOn(requestAdjustModule, "requestAdjust");
            try {
                mockState.props.data = Array.from({ length: 3 }, (_, i) => ({ id: i }));
                mockState.didFinishInitialScroll = true;
                mockState.deferredPositionDelta = 120;

                for (let i = 0; i < 3; i++) {
                    const id = `item_${i}`;
                    mockState.idCache[i] = id;
                    mockState.indexByKey.set(id, i);
                    mockState.sizes.set(id, 50);
                    mockState.sizesKnown.set(id, 50);
                }

                calculateItemsInView(mockCtx, { dataChanged: true });

                expect(requestAdjustSpy).toHaveBeenCalledWith(mockCtx, 120);
                expect(mockState.deferredPositionDelta).toBe(0);
                expect(mockState.pendingDeferredSizeShift).toBe(0);
                expect(mockState.scroll).toBe(120);
            } finally {
                requestAdjustSpy.mockRestore();
            }
        });

        it("runs mvcp in the same data-change pass after rebasing a committed deferred delta", () => {
            const requestAdjustSpy = spyOn(requestAdjustModule, "requestAdjust");
            try {
                mockState.props.data = Array.from({ length: 3 }, (_, i) => ({ id: i }));
                mockState.props.maintainVisibleContentPosition = normalizeMaintainVisibleContentPosition(true);
                mockState.deferredPositionDelta = 120;
                mockState.didContainersLayout = true;
                mockState.idsInView = ["item_1"];

                setLayoutValue(mockState, "positions", "item_0", 0);
                setLayoutValue(mockState, "positions", "item_1", 100);
                setLayoutValue(mockState, "positions", "item_2", 200);

                for (let i = 0; i < 3; i++) {
                    const id = `item_${i}`;
                    mockState.idCache[i] = id;
                    mockState.indexByKey.set(id, i);
                }

                mockState.sizes.set("item_0", 2100);
                mockState.sizes.set("item_1", 100);
                mockState.sizes.set("item_2", 100);
                mockState.sizesKnown.set("item_0", 2100);
                mockState.sizesKnown.set("item_1", 100);
                mockState.sizesKnown.set("item_2", 100);

                calculateItemsInView(mockCtx, { dataChanged: true, doMVCP: true });

                expect(requestAdjustSpy).toHaveBeenNthCalledWith(1, mockCtx, 120);
                expect(requestAdjustSpy).toHaveBeenNthCalledWith(2, mockCtx, 2000, true);
                expect(mockState.deferredPositionDelta).toBe(0);
            } finally {
                requestAdjustSpy.mockRestore();
            }
        });

        it("rebases committed deferred delta when deferred geometry becomes unsupported", () => {
            const requestAdjustSpy = spyOn(requestAdjustModule, "requestAdjust");
            try {
                mockCtx.values.set("numColumns", 2);
                mockState.props.data = Array.from({ length: 4 }, (_, i) => ({ id: i }));
                mockState.didContainersLayout = true;
                mockState.didFinishInitialScroll = true;
                mockState.deferredPositionDelta = 90;

                for (let i = 0; i < 4; i++) {
                    const id = `item_${i}`;
                    mockState.idCache[i] = id;
                    mockState.indexByKey.set(id, i);
                    setLayoutValue(mockState, "positions", id, i * 50);
                    setLayoutValue(mockState, "columns", id, (i % 2) + 1);
                    mockState.sizes.set(id, 50);
                    mockState.sizesKnown.set(id, 50);
                }

                calculateItemsInView(mockCtx);

                expect(requestAdjustSpy).toHaveBeenCalledWith(mockCtx, 90);
                expect(mockState.deferredPositionDelta).toBe(0);
                expect(mockState.scroll).toBe(90);
            } finally {
                requestAdjustSpy.mockRestore();
            }
        });

        it("still runs mvcp when unsupported-layout rebase only clears queued pending shifts", () => {
            const prepareMVCPSpy = spyOn(mvcpModule, "prepareMVCP").mockImplementation(() => undefined);
            try {
                mockCtx.values.set("numColumns", 2);
                mockState.props.data = Array.from({ length: 6 }, (_, i) => ({ id: i }));
                mockState.didContainersLayout = true;
                mockState.didFinishInitialScroll = true;
                mockState.pendingDeferredSizeShift = 40;

                for (let i = 0; i < 6; i++) {
                    const id = `item_${i}`;
                    mockState.idCache[i] = id;
                    mockState.indexByKey.set(id, i);
                    setLayoutValue(mockState, "positions", id, i * 50);
                    setLayoutValue(mockState, "columns", id, (i % 2) + 1);
                    mockState.sizes.set(id, 50);
                    mockState.sizesKnown.set(id, 50);
                }

                calculateItemsInView(mockCtx, { doMVCP: true });

                expect(prepareMVCPSpy).toHaveBeenCalledTimes(1);
            } finally {
                prepareMVCPSpy.mockRestore();
            }
        });

        it("runs mvcp on force-full-position rebases even when doMVCP was not explicitly requested", () => {
            const requestAdjustSpy = spyOn(requestAdjustModule, "requestAdjust");
            try {
                mockState.props.data = Array.from({ length: 3 }, (_, i) => ({ id: i }));
                mockState.props.maintainVisibleContentPosition = normalizeMaintainVisibleContentPosition(true);
                mockState.didContainersLayout = true;
                mockState.idsInView = ["item_1"];
                mockState.pendingDeferredSizeShift = 50;

                setLayoutValue(mockState, "positions", "item_0", 0);
                setLayoutValue(mockState, "positions", "item_1", 100);
                setLayoutValue(mockState, "positions", "item_2", 200);

                for (let i = 0; i < 3; i++) {
                    const id = `item_${i}`;
                    mockState.idCache[i] = id;
                    mockState.indexByKey.set(id, i);
                }

                mockState.sizes.set("item_0", 150);
                mockState.sizes.set("item_1", 100);
                mockState.sizes.set("item_2", 100);
                mockState.sizesKnown.set("item_0", 150);
                mockState.sizesKnown.set("item_1", 100);
                mockState.sizesKnown.set("item_2", 100);

                calculateItemsInView(mockCtx, { forceFullItemPositions: true });

                expect(requestAdjustSpy).toHaveBeenCalledWith(mockCtx, 50, undefined);
                expect(mockState.pendingDeferredSizeShift).toBe(0);
            } finally {
                requestAdjustSpy.mockRestore();
            }
        });

        it("keeps deferred bootstrap ownership on force-full-position passes", () => {
            const requestAdjustSpy = spyOn(requestAdjustModule, "requestAdjust");
            try {
                seedLinearItems(mockState, 6, 100);
                mockState.deferredPositionDelta = 140;
                mockState.initialBootstrap = {
                    active: true,
                    bootstrapVisualOffset: 140,
                    desiredOffset: 300,
                    desiredAnchorOffset: 300,
                    stableFrames: 0,
                    observedNativeScroll: false,
                    pendingRebase: false,
                    anchorIndexHint: 3,
                    anchorKey: "item_3",
                    anchorViewOffset: 0,
                    anchorViewPosition: 0,
                    targetIndexHint: 3,
                    targetKey: "item_3",
                    viewOffset: 0,
                    viewPosition: 0,
                };
                mockState.scroll = 160;
                mockState.scrollLength = 200;

                calculateItemsInView(mockCtx, { forceFullItemPositions: true });

                expect(requestAdjustSpy).not.toHaveBeenCalled();
                expect(mockState.deferredPositionDelta).toBe(140);
                expect(mockState.initialBootstrap?.bootstrapVisualOffset).toBe(140);
                expect(mockState.initialBootstrap?.stableFrames).toBe(1);
            } finally {
                requestAdjustSpy.mockRestore();
            }
        });

        it("recomputes bootstrap deferred delta from target drift and finishes after stable passes", () => {
            const requestAdjustSpy = spyOn(requestAdjustModule, "requestAdjust");
            try {
                seedLinearItems(mockState, 6, 100);
                mockState.initialBootstrap = {
                    active: true,
                    bootstrapVisualOffset: 0,
                    desiredOffset: 160,
                    desiredAnchorOffset: 160,
                    stableFrames: 0,
                    observedNativeScroll: false,
                    pendingRebase: false,
                    anchorIndexHint: 3,
                    anchorKey: "item_3",
                    anchorViewOffset: 0,
                    anchorViewPosition: 0,
                    targetIndexHint: 3,
                    targetKey: "item_3",
                    viewOffset: 0,
                    viewPosition: 0,
                };
                mockState.scroll = 160;
                mockState.scrollLength = 200;

                calculateItemsInView(mockCtx);

                expect(mockState.initialBootstrap?.bootstrapVisualOffset).toBe(140);
                expect(mockState.initialBootstrap?.desiredOffset).toBe(300);
                expect(mockState.initialBootstrap?.desiredAnchorOffset).toBe(300);
                expect(mockState.initialBootstrap?.stableFrames).toBe(1);
                expect(mockState.didFinishInitialScroll).not.toBe(true);

                calculateItemsInView(mockCtx);

                expect(requestAdjustSpy).not.toHaveBeenCalled();
                expect(mockState.initialBootstrap?.bootstrapVisualOffset).toBe(140);
                expect(mockState.initialBootstrap?.active).toBe(false);
                expect(mockState.initialBootstrap?.stableFrames).toBe(2);
                expect(mockState.didFinishInitialScroll).toBe(true);
            } finally {
                requestAdjustSpy.mockRestore();
            }
        });

        it("schedules a follow-up bootstrap pass so readiness can open without user scroll", () => {
            const requestAdjustSpy = spyOn(requestAdjustModule, "requestAdjust");
            const originalRaf = globalThis.requestAnimationFrame;
            const originalCancelRaf = globalThis.cancelAnimationFrame;
            const originalSetTimeout = globalThis.setTimeout;
            const originalClearTimeout = globalThis.clearTimeout;
            const queuedFrames: Array<FrameRequestCallback> = [];
            const queuedTimeouts: Array<() => void> = [];
            try {
                globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
                    queuedFrames.push(cb);
                    return queuedFrames.length;
                }) as typeof requestAnimationFrame;
                globalThis.cancelAnimationFrame = (() => undefined) as typeof cancelAnimationFrame;
                globalThis.setTimeout = ((callback: TimerHandler) => {
                    queuedTimeouts.push(callback as () => void);
                    return queuedTimeouts.length as unknown as ReturnType<typeof setTimeout>;
                }) as typeof setTimeout;
                globalThis.clearTimeout = (() => undefined) as typeof clearTimeout;

                seedLinearItems(mockState, 6, 100);
                mockState.initialBootstrap = {
                    active: true,
                    bootstrapVisualOffset: 0,
                    desiredOffset: 160,
                    desiredAnchorOffset: 160,
                    stableFrames: 0,
                    observedNativeScroll: false,
                    pendingRebase: false,
                    anchorIndexHint: 3,
                    anchorKey: "item_3",
                    anchorViewOffset: 0,
                    anchorViewPosition: 0,
                    targetIndexHint: 3,
                    targetKey: "item_3",
                    viewOffset: 0,
                    viewPosition: 0,
                };
                mockState.scroll = 160;
                mockState.scrollLength = 200;
                mockState.didContainersLayout = true;
                mockState.triggerCalculateItemsInView = (params) => calculateItemsInView(mockCtx, params);

                calculateItemsInView(mockCtx);

                expect(requestAdjustSpy).not.toHaveBeenCalled();
                expect(mockState.initialBootstrap?.stableFrames).toBe(1);
                expect(mockState.didFinishInitialScroll).not.toBe(true);
                expect(queuedFrames).toHaveLength(1);
                expect(queuedTimeouts).toHaveLength(1);

                queuedFrames.shift()?.(Date.now());

                expect(mockState.initialBootstrap?.active).toBe(false);
                expect(mockState.initialBootstrap?.stableFrames).toBe(2);
                expect(mockState.initialBootstrap?.bootstrapVisualOffset).toBe(140);
                expect(mockState.didFinishInitialScroll).toBe(true);
            } finally {
                globalThis.requestAnimationFrame = originalRaf;
                globalThis.cancelAnimationFrame = originalCancelRaf;
                globalThis.setTimeout = originalSetTimeout;
                globalThis.clearTimeout = originalClearTimeout;
                requestAdjustSpy.mockRestore();
            }
        });

        it("falls back to a timeout-backed bootstrap pass when the recalculate RAF never fires", () => {
            const requestAdjustSpy = spyOn(requestAdjustModule, "requestAdjust");
            const originalRaf = globalThis.requestAnimationFrame;
            const originalCancelRaf = globalThis.cancelAnimationFrame;
            const originalSetTimeout = globalThis.setTimeout;
            const originalClearTimeout = globalThis.clearTimeout;
            const queuedFrames: Array<FrameRequestCallback> = [];
            const queuedTimeouts: Array<() => void> = [];
            try {
                globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
                    queuedFrames.push(cb);
                    return queuedFrames.length;
                }) as typeof requestAnimationFrame;
                globalThis.cancelAnimationFrame = (() => undefined) as typeof cancelAnimationFrame;
                globalThis.setTimeout = ((callback: TimerHandler) => {
                    queuedTimeouts.push(callback as () => void);
                    return queuedTimeouts.length as unknown as ReturnType<typeof setTimeout>;
                }) as typeof setTimeout;
                globalThis.clearTimeout = (() => undefined) as typeof clearTimeout;

                seedLinearItems(mockState, 6, 100);
                mockState.initialBootstrap = {
                    active: true,
                    bootstrapVisualOffset: 0,
                    desiredOffset: 160,
                    desiredAnchorOffset: 160,
                    stableFrames: 0,
                    observedNativeScroll: false,
                    pendingRebase: false,
                    anchorIndexHint: 3,
                    anchorKey: "item_3",
                    anchorViewOffset: 0,
                    anchorViewPosition: 0,
                    targetIndexHint: 3,
                    targetKey: "item_3",
                    viewOffset: 0,
                    viewPosition: 0,
                };
                mockState.scroll = 160;
                mockState.scrollLength = 200;
                mockState.didContainersLayout = true;
                mockState.triggerCalculateItemsInView = (params) => calculateItemsInView(mockCtx, params);

                calculateItemsInView(mockCtx);

                expect(requestAdjustSpy).not.toHaveBeenCalled();
                expect(mockState.initialBootstrap?.stableFrames).toBe(1);
                expect(mockState.didFinishInitialScroll).not.toBe(true);
                expect(queuedFrames).toHaveLength(1);
                expect(queuedTimeouts).toHaveLength(1);

                queuedTimeouts.shift()?.();

                expect(mockState.initialBootstrap?.active).toBe(false);
                expect(mockState.initialBootstrap?.stableFrames).toBe(2);
                expect(mockState.initialBootstrap?.bootstrapVisualOffset).toBe(140);
                expect(mockState.didFinishInitialScroll).toBe(true);
            } finally {
                globalThis.requestAnimationFrame = originalRaf;
                globalThis.cancelAnimationFrame = originalCancelRaf;
                globalThis.setTimeout = originalSetTimeout;
                globalThis.clearTimeout = originalClearTimeout;
                requestAdjustSpy.mockRestore();
            }
        });

        it("settles bootstrap against the end clamp without retrying native scroll", () => {
            const requestAdjustSpy = spyOn(requestAdjustModule, "requestAdjust");
            try {
                seedLinearItems(mockState, 4, 100);
                mockCtx.values.set("totalSize", 400);
                mockState.initialBootstrap = {
                    active: true,
                    bootstrapVisualOffset: 0,
                    desiredOffset: 100,
                    desiredAnchorOffset: 100,
                    stableFrames: 0,
                    observedNativeScroll: false,
                    pendingRebase: false,
                    anchorIndexHint: 3,
                    anchorKey: "item_3",
                    anchorViewOffset: 0,
                    anchorViewPosition: 0,
                    targetIndexHint: 3,
                    targetKey: "item_3",
                    viewOffset: 0,
                    viewPosition: 0,
                };
                mockState.scroll = 100;
                mockState.scrollLength = 250;

                calculateItemsInView(mockCtx);
                calculateItemsInView(mockCtx);

                expect(requestAdjustSpy).not.toHaveBeenCalled();
                expect(mockState.initialBootstrap?.desiredOffset).toBe(150);
                expect(mockState.initialBootstrap?.active).toBe(false);
                expect(mockState.initialBootstrap?.bootstrapVisualOffset).toBe(50);
                expect(mockState.didFinishInitialScroll).toBe(true);
            } finally {
                requestAdjustSpy.mockRestore();
            }
        });

        it("rebases committed deferred delta when it exceeds the cap near the top of the list", () => {
            const requestAdjustSpy = spyOn(requestAdjustModule, "requestAdjust");
            const prepareMVCPSpy = spyOn(mvcpModule, "prepareMVCP");
            try {
                mockState.props.data = Array.from({ length: 20 }, (_, i) => ({ id: i }));
                mockState.didFinishInitialScroll = true;
                mockState.scroll = 200;
                mockState.scrollLength = 300;
                mockState.deferredPositionDelta = 250;

                for (let i = 0; i < 20; i++) {
                    const id = `item_${i}`;
                    mockState.idCache[i] = id;
                    mockState.indexByKey.set(id, i);
                    setLayoutValue(mockState, "positions", id, i * 50);
                    mockState.sizes.set(id, 50);
                    mockState.sizesKnown.set(id, 50);
                }

                calculateItemsInView(mockCtx, { doMVCP: true });

                expect(requestAdjustSpy).toHaveBeenCalledWith(mockCtx, 250);
                expect(prepareMVCPSpy).toHaveBeenCalledTimes(1);
                expect(mockState.deferredPositionDelta).toBe(0);
                expect(mockState.scroll).toBe(450);
            } finally {
                prepareMVCPSpy.mockRestore();
                requestAdjustSpy.mockRestore();
            }
        });

        it("does not rebase deferred cap state on mobile Safari web", () => {
            const requestAdjustSpy = spyOn(requestAdjustModule, "requestAdjust");
            const prepareMVCPSpy = spyOn(mvcpModule, "prepareMVCP");
            const previousPlatform = Platform.OS;
            Platform.OS = "web";
            Object.defineProperty(globalThis, "navigator", {
                configurable: true,
                value: {
                    userAgent:
                        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Mobile/15E148 Safari/604.1",
                },
                writable: true,
            });
            try {
                mockState.props.data = Array.from({ length: 20 }, (_, i) => ({ id: i }));
                mockState.didFinishInitialScroll = true;
                mockState.scroll = 200;
                mockState.scrollLength = 300;
                mockState.deferredPositionDelta = 250;

                for (let i = 0; i < 20; i++) {
                    const id = `item_${i}`;
                    mockState.idCache[i] = id;
                    mockState.indexByKey.set(id, i);
                    setLayoutValue(mockState, "positions", id, i * 50);
                    mockState.sizes.set(id, 50);
                    mockState.sizesKnown.set(id, 50);
                }

                calculateItemsInView(mockCtx, { doMVCP: true });

                expect(requestAdjustSpy).not.toHaveBeenCalled();
                expect(prepareMVCPSpy).toHaveBeenCalledTimes(1);
                expect(mockState.deferredPositionDelta).toBe(250);
                expect(mockState.scroll).toBe(200);
            } finally {
                Platform.OS = previousPlatform;
                if (originalNavigator === undefined) {
                    delete (globalThis as typeof globalThis & { navigator?: Navigator }).navigator;
                } else {
                    Object.defineProperty(globalThis, "navigator", {
                        configurable: true,
                        value: originalNavigator,
                        writable: true,
                    });
                }
                prepareMVCPSpy.mockRestore();
                requestAdjustSpy.mockRestore();
            }
        });

        it("defers cap rebases while a fresh native mvcp adjust is active", () => {
            const requestAdjustSpy = spyOn(requestAdjustModule, "requestAdjust");
            const prepareMVCPSpy = spyOn(mvcpModule, "prepareMVCP");
            const previousPlatform = Platform.OS;
            Platform.OS = "ios";
            try {
                mockState.props.data = Array.from({ length: 20 }, (_, i) => ({ id: i }));
                mockState.didFinishInitialScroll = true;
                mockState.scroll = 200;
                mockState.scrollLength = 300;
                mockState.deferredPositionDelta = 250;
                mockState.pendingNativeMVCPAdjust = {
                    amount: -20,
                    furthestProgressTowardAmount: 0,
                    manualApplied: 0,
                    startScroll: 100,
                };

                for (let i = 0; i < 20; i++) {
                    const id = `item_${i}`;
                    mockState.idCache[i] = id;
                    mockState.indexByKey.set(id, i);
                    setLayoutValue(mockState, "positions", id, i * 50);
                    mockState.sizes.set(id, 50);
                    mockState.sizesKnown.set(id, 50);
                }

                calculateItemsInView(mockCtx, { doMVCP: true });

                expect(requestAdjustSpy).not.toHaveBeenCalled();
                expect(prepareMVCPSpy).toHaveBeenCalledTimes(1);
                expect(mockState.deferredPositionDelta).toBe(250);
                expect(mockState.scroll).toBe(200);
            } finally {
                Platform.OS = previousPlatform;
                prepareMVCPSpy.mockRestore();
                requestAdjustSpy.mockRestore();
            }
        });

        it("defers cap rebases while a fresh web mvcp adjust is active", () => {
            const requestAdjustSpy = spyOn(requestAdjustModule, "requestAdjust");
            const prepareMVCPSpy = spyOn(mvcpModule, "prepareMVCP");
            const previousPlatform = Platform.OS;
            Platform.OS = "web";
            try {
                mockState.props.data = Array.from({ length: 20 }, (_, i) => ({ id: i }));
                mockState.didFinishInitialScroll = true;
                mockState.scroll = 200;
                mockState.scrollLength = 300;
                mockState.deferredPositionDelta = 250;
                mockState.ignoreScrollFromMVCP = { lt: 20 };

                for (let i = 0; i < 20; i++) {
                    const id = `item_${i}`;
                    mockState.idCache[i] = id;
                    mockState.indexByKey.set(id, i);
                    setLayoutValue(mockState, "positions", id, i * 50);
                    mockState.sizes.set(id, 50);
                    mockState.sizesKnown.set(id, 50);
                }

                calculateItemsInView(mockCtx, { doMVCP: true });

                expect(requestAdjustSpy).not.toHaveBeenCalled();
                expect(prepareMVCPSpy).toHaveBeenCalledTimes(1);
                expect(mockState.deferredPositionDelta).toBe(250);
                expect(mockState.scroll).toBe(200);
            } finally {
                Platform.OS = previousPlatform;
                prepareMVCPSpy.mockRestore();
                requestAdjustSpy.mockRestore();
            }
        });

        it("flushes a deferred cap rebase on the first pass after native mvcp settling resolves", () => {
            const requestAdjustSpy = spyOn(requestAdjustModule, "requestAdjust");
            const previousPlatform = Platform.OS;
            Platform.OS = "ios";
            try {
                mockCtx.values.set("totalSize", 220);
                mockState.props.data = Array.from({ length: 20 }, (_, i) => ({ id: i }));
                mockState.didFinishInitialScroll = true;
                mockState.scroll = 200;
                mockState.scrollLastCalculate = 200;
                mockState.scrollLength = 300;
                mockState.deferredPositionDelta = 250;
                mockState.dataChangeNeedsScrollUpdate = true;
                mockState.pendingNativeMVCPAdjust = {
                    amount: -300,
                    furthestProgressTowardAmount: 0,
                    manualApplied: 0,
                    startScroll: 420,
                };

                for (let i = 0; i < 20; i++) {
                    const id = `item_${i}`;
                    mockState.idCache[i] = id;
                    mockState.indexByKey.set(id, i);
                    setLayoutValue(mockState, "positions", id, i * 50);
                    mockState.sizes.set(id, 50);
                    mockState.sizesKnown.set(id, 50);
                }

                calculateItemsInView(mockCtx, { doMVCP: true });

                expect(mockState.deferredPositionDelta).toBe(250);
                expect(mockState.pendingNativeMVCPAdjust).toBeDefined();

                updateScroll(mockCtx, 120);

                expect(mockState.pendingNativeMVCPAdjust).toBeUndefined();
                expect(mockState.ignoreScrollFromMVCP).toBeUndefined();

                calculateItemsInView(mockCtx, { doMVCP: true });

                expect(requestAdjustSpy).toHaveBeenCalledWith(mockCtx, 250);
                expect(mockState.deferredPositionDelta).toBe(0);
            } finally {
                Platform.OS = previousPlatform;
                requestAdjustSpy.mockRestore();
            }
        });

        it("passes the latest deferred delta to mvcp when a cap rebase flushes", () => {
            const requestAdjustSpy = spyOn(requestAdjustModule, "requestAdjust");
            const prepareMVCPSpy = spyOn(mvcpModule, "prepareMVCP");
            const previousPlatform = Platform.OS;
            Platform.OS = "web";
            try {
                mockState.props.data = Array.from({ length: 20 }, (_, i) => ({ id: i }));
                mockState.didFinishInitialScroll = true;
                mockState.scroll = 1000;
                mockState.scrollLength = 300;
                mockState.deferredPositionDelta = 550;
                mockState.pendingDeferredSizeShift = 100;

                for (let i = 0; i < 20; i++) {
                    const id = `item_${i}`;
                    mockState.idCache[i] = id;
                    mockState.indexByKey.set(id, i);
                    setLayoutValue(mockState, "positions", id, i * 50);
                    mockState.sizes.set(id, 50);
                    mockState.sizesKnown.set(id, 50);
                }

                calculateItemsInView(mockCtx, { doMVCP: true });

                expect(requestAdjustSpy).toHaveBeenCalledWith(mockCtx, 650);
                expect(prepareMVCPSpy).toHaveBeenCalledTimes(1);
                expect(prepareMVCPSpy.mock.calls[0]?.[2]).toEqual({
                    deferredPositionDeltaAfter: 650,
                    deferredPositionDeltaBefore: 550,
                });
            } finally {
                Platform.OS = previousPlatform;
                prepareMVCPSpy.mockRestore();
                requestAdjustSpy.mockRestore();
            }
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

            expect(duration).toBeLessThan(250); // Should not cause timeout
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
