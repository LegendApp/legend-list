import { Platform } from "@/platform/Platform";
import { beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import { calculateItemsInView } from "../../src/core/calculateItemsInView";
import { finishScrollTo } from "../../src/core/finishScrollTo";
import * as mvcpModule from "../../src/core/mvcp";
import * as viewabilityModule from "../../src/core/viewability";
import type { StateContext } from "../../src/state/state";
import type { InternalState } from "../../src/types.internal";
import { getExpandedContainerPoolSize } from "../../src/utils/containerPool";
import { getAlwaysRenderIndices } from "../../src/utils/getAlwaysRenderIndices";
import { normalizeMaintainVisibleContentPosition } from "../../src/utils/normalizeMaintainVisibleContentPosition";
import * as setDidLayoutModule from "../../src/utils/setDidLayout";
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

    function measureSteadyStateDuration(run: () => void) {
        run();
        const start = performance.now();
        run();
        return performance.now() - start;
    }

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

        it("tracks replacement container keys after a web user scroll anchor reset", () => {
            const prevPlatform = Platform.OS;
            Platform.OS = "web";
            try {
                mockState.props.data = Array.from({ length: 20 }, (_, i) => ({ id: i }));
                mockState.props.drawDistance = 0;
                mockState.scroll = 500;
                mockState.scrollLength = 100;
                mockState.userScrollAnchorResetKeys = new Set();

                for (let i = 0; i < 20; i++) {
                    const id = `item_${i}`;
                    mockState.idCache[i] = id;
                    mockState.indexByKey.set(id, i);
                    setLayoutValue(mockState, "positions", id, i * 50);
                    mockState.sizes.set(id, 50);
                }

                for (let i = 0; i < 10; i++) {
                    const id = `item_${i}`;
                    mockState.containerItemKeys.set(id, i);
                    mockCtx.values.set(`containerItemKey${i}`, id);
                }

                calculateItemsInView(mockCtx);

                expect(mockState.startNoBuffer).toBe(10);
                expect(mockState.endNoBuffer).toBe(12);
                expect(mockState.userScrollAnchorResetKeys).toEqual(new Set(["item_10", "item_11", "item_12"]));
            } finally {
                Platform.OS = prevPlatform;
            }
        });

        it("clears an empty web user scroll anchor reset when no replacement containers are needed", () => {
            const prevPlatform = Platform.OS;
            Platform.OS = "web";
            try {
                mockState.props.data = Array.from({ length: 20 }, (_, i) => ({ id: i }));
                mockState.props.drawDistance = 0;
                mockState.scroll = 500;
                mockState.scrollLength = 100;
                mockState.userScrollAnchorResetKeys = new Set();

                for (let i = 0; i < 20; i++) {
                    const id = `item_${i}`;
                    mockState.idCache[i] = id;
                    mockState.indexByKey.set(id, i);
                    setLayoutValue(mockState, "positions", id, i * 50);
                    mockState.sizes.set(id, 50);
                }

                for (let i = 10; i <= 12; i++) {
                    const id = `item_${i}`;
                    mockState.containerItemKeys.set(id, i - 10);
                    mockCtx.values.set(`containerItemKey${i - 10}`, id);
                }

                calculateItemsInView(mockCtx);

                expect(mockState.startNoBuffer).toBe(10);
                expect(mockState.endNoBuffer).toBe(12);
                expect(mockState.userScrollAnchorResetKeys).toBeUndefined();
            } finally {
                Platform.OS = prevPlatform;
            }
        });

        it("tracks only newly assigned replacement keys after a web user scroll anchor reset", () => {
            const prevPlatform = Platform.OS;
            Platform.OS = "web";
            try {
                mockState.props.data = Array.from({ length: 20 }, (_, i) => ({ id: i }));
                mockState.props.drawDistance = 0;
                mockState.scroll = 500;
                mockState.scrollLength = 100;
                mockState.userScrollAnchorResetKeys = new Set();

                for (let i = 0; i < 20; i++) {
                    const id = `item_${i}`;
                    mockState.idCache[i] = id;
                    mockState.indexByKey.set(id, i);
                    setLayoutValue(mockState, "positions", id, i * 50);
                    mockState.sizes.set(id, 50);
                }

                for (let i = 10; i <= 11; i++) {
                    const id = `item_${i}`;
                    mockState.containerItemKeys.set(id, i - 10);
                    mockCtx.values.set(`containerItemKey${i - 10}`, id);
                }

                calculateItemsInView(mockCtx);

                expect(mockState.startNoBuffer).toBe(10);
                expect(mockState.endNoBuffer).toBe(12);
                expect(mockState.userScrollAnchorResetKeys).toEqual(new Set(["item_12"]));
            } finally {
                Platform.OS = prevPlatform;
            }
        });

        it("expands the pooled container count without exceeding useful capacity", () => {
            const warnSpy = spyOn(console, "warn").mockImplementation(() => {});
            const dataLength = 25;
            try {
                mockState.props.data = Array.from({ length: dataLength }, (_, i) => ({ id: i }));
                mockState.props.drawDistance = 0;
                mockState.scroll = 0;
                mockState.scrollLength = 1_000;
                mockCtx.values.set("numContainers", 2);
                mockCtx.values.set("numContainersPooled", 2);

                for (let i = 0; i < dataLength; i++) {
                    const id = `item_${i}`;
                    mockState.idCache[i] = id;
                    mockState.indexByKey.set(id, i);
                    setLayoutValue(mockState, "positions", id, i * 10);
                    mockState.sizes.set(id, 10);
                }

                calculateItemsInView(mockCtx);

                const numContainers = mockCtx.values.get("numContainers");
                expect(numContainers).toBe(dataLength);
                expect(mockCtx.values.get("numContainersPooled")).toBe(
                    getExpandedContainerPoolSize(dataLength, numContainers),
                );
            } finally {
                warnSpy.mockRestore();
            }
        });

        it("uses bootstrap scroll while a hidden bootstrap session is active", () => {
            mockState.props.data = Array.from({ length: 10 }, (_, i) => ({ id: i }));
            mockState.scroll = 0;
            mockState.scrollLength = 200;
            mockState.initialScrollSession = {
                bootstrap: {
                    mountFrameCount: 0,
                    passCount: 0,
                    scroll: 250,
                    targetIndexSeed: 5,
                },
                kind: "bootstrap",
                previousDataLength: 0,
            } as any;

            for (let i = 0; i < 10; i++) {
                const id = `item_${i}`;
                mockState.idCache[i] = id;
                mockState.indexByKey.set(id, i);
                setLayoutValue(mockState, "positions", id, i * 50);
                mockState.sizes.set(id, 50);
            }

            calculateItemsInView(mockCtx);

            expect(mockState.startNoBuffer).toBe(5);
            expect(mockState.endNoBuffer).toBe(9);
        });

        it("ignores preserved finished initial-scroll targets and uses the current scroll", () => {
            mockState.props.data = Array.from({ length: 10 }, (_, i) => ({ id: i }));
            mockState.didFinishInitialScroll = true;
            mockState.scroll = 100;
            mockState.scrollLength = 200;
            mockState.initialScroll = {
                index: 7,
                viewOffset: 0,
                viewPosition: 0,
            };

            for (let i = 0; i < 10; i++) {
                const id = `item_${i}`;
                mockState.idCache[i] = id;
                mockState.indexByKey.set(id, i);
                setLayoutValue(mockState, "positions", id, i * 50);
                mockState.sizes.set(id, 50);
            }

            calculateItemsInView(mockCtx);

            expect(mockState.startNoBuffer).toBe(2);
            expect(mockState.endNoBuffer).toBe(6);
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

        it("preserves visible MVCP containers during a stale prepend range pass", () => {
            const itemSize = 60;
            const prependCount = 42;
            const previousItems = Array.from({ length: 12 }, (_, i) => ({ id: `old-${i}` }));
            const prependedItems = Array.from({ length: prependCount }, (_, i) => ({ id: `new-${i}` }));
            const nextItems = [...prependedItems, ...previousItems];

            mockCtx.values.set("numContainers", 12);
            mockCtx.values.set("readyToRender", true);
            mockCtx.values.set("totalSize", previousItems.length * itemSize);
            mockState.didContainersLayout = true;
            mockState.props.data = nextItems;
            mockState.props.drawDistance = 0;
            mockState.props.keyExtractor = (item: { id: string }) => item.id;
            mockState.props.maintainVisibleContentPosition = normalizeMaintainVisibleContentPosition(true);
            mockState.scroll = -4;
            mockState.scrollLength = 600;
            mockState.idsInView = previousItems.slice(0, 11).map((item) => item.id);
            mockState.scrollAdjustHandler.requestAdjust = mock(() => {});

            for (let i = 0; i < previousItems.length; i++) {
                const id = previousItems[i].id;
                mockState.idCache[i] = id;
                mockState.indexByKey.set(id, i);
                setLayoutValue(mockState, "positions", id, i * itemSize);
                mockState.sizes.set(id, itemSize);
                if (i < 11) {
                    mockState.containerItemKeys.set(id, i);
                    mockCtx.values.set(`containerItemKey${i}`, id);
                    mockCtx.values.set(`containerItemData${i}`, previousItems[i]);
                }
            }
            for (const item of prependedItems) {
                mockState.sizes.set(item.id, itemSize);
            }

            calculateItemsInView(mockCtx, { dataChanged: true, doMVCP: true });

            expect(mockState.scroll).toBe(-4 + prependCount * itemSize);
            expect(mockState.startNoBuffer).toBe(0);
            expect(mockState.endNoBuffer).toBe(10);
            expect(mockState.containerItemKeys.get("old-0")).toBe(0);
            expect(mockState.containerItemKeys.get("old-10")).toBe(10);
            expect(mockState.containerItemKeys.has("new-0")).toBe(true);
        });

        it("recomputes the visible range after MVCP adjusts a preserved initial-scroll target", () => {
            const itemSize = 100;
            const prependCount = 37;
            const previousItems = Array.from({ length: 13 }, (_, i) => ({ id: `old-${i}` }));
            const prependedItems = Array.from({ length: prependCount }, (_, i) => ({ id: `new-${i}` }));
            const nextItems = [...prependedItems, ...previousItems];

            mockCtx.values.set("numContainers", 10);
            mockCtx.values.set("readyToRender", true);
            mockCtx.values.set("totalSize", previousItems.length * itemSize);
            mockState.didContainersLayout = true;
            mockState.didFinishInitialScroll = true;
            mockState.initialScroll = {
                index: nextItems.length - 1,
                viewOffset: 0,
                viewPosition: 1,
            };
            mockState.props.data = nextItems;
            mockState.props.drawDistance = 0;
            mockState.props.keyExtractor = (item: { id: string }) => item.id;
            mockState.props.maintainVisibleContentPosition = normalizeMaintainVisibleContentPosition(true);
            mockState.scroll = previousItems.length * itemSize - 300;
            mockState.scrollLength = 300;
            mockState.idsInView = previousItems.slice(10).map((item) => item.id);
            mockState.scrollAdjustHandler.requestAdjust = mock(() => {});

            for (let i = 0; i < previousItems.length; i++) {
                const id = previousItems[i].id;
                mockState.idCache[i] = id;
                mockState.indexByKey.set(id, i);
                setLayoutValue(mockState, "positions", id, i * itemSize);
                mockState.sizes.set(id, itemSize);
            }
            for (let i = 10; i < previousItems.length; i++) {
                const id = previousItems[i].id;
                mockState.containerItemKeys.set(id, i - 10);
                mockCtx.values.set(`containerItemKey${i - 10}`, id);
                mockCtx.values.set(`containerItemData${i - 10}`, previousItems[i]);
            }
            for (const item of prependedItems) {
                mockState.sizes.set(item.id, itemSize);
            }

            calculateItemsInView(mockCtx, { dataChanged: true, doMVCP: true });

            expect(mockState.scroll).toBe(nextItems.length * itemSize - mockState.scrollLength);
            expect(mockState.startNoBuffer).toBe(47);
            expect(mockState.endNoBuffer).toBe(49);
            expect(mockState.idsInView).toEqual(["old-10", "old-11", "old-12"]);
        });

        it("does not preserve MVCP containers rejected by shouldRestorePosition", () => {
            const itemSize = 60;
            const prependCount = 42;
            const previousItems = Array.from({ length: 12 }, (_, i) => ({ id: `old-${i}` }));
            const prependedItems = Array.from({ length: prependCount }, (_, i) => ({ id: `new-${i}` }));
            const nextItems = [...prependedItems, ...previousItems];

            mockCtx.values.set("numContainers", 12);
            mockCtx.values.set("readyToRender", true);
            mockCtx.values.set("totalSize", previousItems.length * itemSize);
            mockState.didContainersLayout = true;
            mockState.props.data = nextItems;
            mockState.props.drawDistance = 0;
            mockState.props.keyExtractor = (item: { id: string }) => item.id;
            mockState.props.maintainVisibleContentPosition = normalizeMaintainVisibleContentPosition({
                data: true,
                shouldRestorePosition: (item: { id: string }) => item.id !== "old-0",
            });
            mockState.scroll = -4;
            mockState.scrollLength = 600;
            mockState.idsInView = previousItems.slice(0, 11).map((item) => item.id);
            mockState.scrollAdjustHandler.requestAdjust = mock(() => {});

            for (let i = 0; i < previousItems.length; i++) {
                const id = previousItems[i].id;
                mockState.idCache[i] = id;
                mockState.indexByKey.set(id, i);
                setLayoutValue(mockState, "positions", id, i * itemSize);
                mockState.sizes.set(id, itemSize);
                if (i < 11) {
                    mockState.containerItemKeys.set(id, i);
                    mockCtx.values.set(`containerItemKey${i}`, id);
                    mockCtx.values.set(`containerItemData${i}`, previousItems[i]);
                }
            }
            for (const item of prependedItems) {
                mockState.sizes.set(item.id, itemSize);
            }

            calculateItemsInView(mockCtx, { dataChanged: true, doMVCP: true });

            expect(mockState.containerItemKeys.get("old-0")).toBeUndefined();
            expect(mockState.containerItemKeys.get("old-1")).toBe(1);
        });

        it("does not publish viewability from the stale range when MVCP adjusts a prepend", () => {
            const itemSize = 60;
            const prependCount = 42;
            const previousItems = Array.from({ length: 12 }, (_, i) => ({ id: `old-${i}` }));
            const prependedItems = Array.from({ length: prependCount }, (_, i) => ({ id: `new-${i}` }));
            const nextItems = [...prependedItems, ...previousItems];
            const updateViewableItemsSpy = spyOn(viewabilityModule, "updateViewableItems");

            try {
                mockCtx.values.set("numContainers", 12);
                mockCtx.values.set("readyToRender", true);
                mockCtx.values.set("totalSize", previousItems.length * itemSize);
                mockState.didContainersLayout = true;
                mockState.props.data = nextItems;
                mockState.props.drawDistance = 0;
                mockState.props.keyExtractor = (item: { id: string }) => item.id;
                mockState.props.maintainVisibleContentPosition = normalizeMaintainVisibleContentPosition(true);
                mockState.scroll = -4;
                mockState.scrollLength = 600;
                mockState.idsInView = previousItems.slice(0, 11).map((item) => item.id);
                mockState.scrollAdjustHandler.requestAdjust = mock(() => {});
                mockState.viewabilityConfigCallbackPairs = [
                    {
                        onViewableItemsChanged: mock(() => {}),
                        viewabilityConfig: { id: "default", viewAreaCoveragePercentThreshold: 0 },
                    },
                ];

                for (let i = 0; i < previousItems.length; i++) {
                    const id = previousItems[i].id;
                    mockState.idCache[i] = id;
                    mockState.indexByKey.set(id, i);
                    setLayoutValue(mockState, "positions", id, i * itemSize);
                    mockState.sizes.set(id, itemSize);
                    if (i < 11) {
                        mockState.containerItemKeys.set(id, i);
                        mockCtx.values.set(`containerItemKey${i}`, id);
                        mockCtx.values.set(`containerItemData${i}`, previousItems[i]);
                    }
                }
                for (const item of prependedItems) {
                    mockState.sizes.set(item.id, itemSize);
                }

                calculateItemsInView(mockCtx, { dataChanged: true, doMVCP: true });

                expect(updateViewableItemsSpy).not.toHaveBeenCalled();
            } finally {
                updateViewableItemsSpy.mockRestore();
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

        it("does not take the cached-range early return while bootstrap scroll is active", () => {
            mockState.props.data = Array.from({ length: 10 }, (_, i) => ({ id: i }));
            mockState.scroll = 0;
            mockState.scrollLength = 200;
            mockState.scrollForNextCalculateItemsInView = {
                bottom: 1000,
                top: -500,
            };
            mockState.initialScrollSession = {
                bootstrap: {
                    mountFrameCount: 0,
                    passCount: 0,
                    scroll: 250,
                    targetIndexSeed: 5,
                },
                kind: "bootstrap",
                previousDataLength: 0,
            } as any;

            for (let i = 0; i < 10; i++) {
                const id = `item_${i}`;
                mockState.idCache[i] = id;
                mockState.indexByKey.set(id, i);
                setLayoutValue(mockState, "positions", id, i * 50);
                mockState.sizes.set(id, 50);
            }

            calculateItemsInView(mockCtx);

            expect(mockState.startNoBuffer).toBe(5);
        });
    });

    describe("bootstrap side-effect suppression", () => {
        it("suppresses mvcp, didLayout, and viewability updates during bootstrap", () => {
            const prepareMVCPSpy = spyOn(mvcpModule, "prepareMVCP");
            const setDidLayoutSpy = spyOn(setDidLayoutModule, "setDidLayout");
            const updateViewableItemsSpy = spyOn(viewabilityModule, "updateViewableItems");

            mockState.props.data = Array.from({ length: 10 }, (_, i) => ({ id: i }));
            mockState.scrollLength = 200;
            mockState.queuedInitialLayout = false;
            mockState.initialScrollSession = {
                bootstrap: {
                    mountFrameCount: 0,
                    passCount: 0,
                    scroll: 250,
                    targetIndexSeed: 5,
                },
                kind: "bootstrap",
                previousDataLength: 0,
            } as any;
            mockState.viewabilityConfigCallbackPairs = [{ onViewableItemsChanged: () => {}, viewabilityConfig: {} }];

            for (let i = 0; i < 10; i++) {
                const id = `item_${i}`;
                mockState.idCache[i] = id;
                mockState.indexByKey.set(id, i);
                setLayoutValue(mockState, "positions", id, i * 50);
                mockState.sizes.set(id, 50);
                mockState.sizesKnown.set(id, 50);
            }

            calculateItemsInView(mockCtx, { doMVCP: true });

            expect(prepareMVCPSpy).not.toHaveBeenCalled();
            expect(setDidLayoutSpy).not.toHaveBeenCalled();
            expect(updateViewableItemsSpy).not.toHaveBeenCalled();
        });
    });

    describe("initial layout readiness", () => {
        it("finishes layout once mounted no-buffer items are measured when there is no active initial scroll", () => {
            const setDidLayoutSpy = spyOn(setDidLayoutModule, "setDidLayout");

            mockState.props.data = Array.from({ length: 4 }, (_, i) => ({ id: i }));
            mockState.scrollLength = 60;
            mockState.queuedInitialLayout = false;

            for (let i = 0; i < 4; i++) {
                const id = `item_${i}`;
                mockState.idCache[i] = id;
                mockState.indexByKey.set(id, i);
                mockState.containerItemKeys.set(id, i);
                setLayoutValue(mockState, "positions", id, i * 50);
                mockState.sizes.set(id, 50);
            }

            mockState.sizesKnown.set("item_0", 50);
            mockState.sizesKnown.set("item_1", 50);

            calculateItemsInView(mockCtx);

            expect(mockState.startNoBuffer).toBe(0);
            expect(mockState.endNoBuffer).toBe(1);
            expect(mockState.startBuffered).toBe(0);
            expect(mockState.endBuffered).toBe(3);
            expect(setDidLayoutSpy).toHaveBeenCalledTimes(1);
        });

        it("still waits for mounted buffered items while initial scroll is active", () => {
            const setDidLayoutSpy = spyOn(setDidLayoutModule, "setDidLayout");

            mockState.props.data = Array.from({ length: 4 }, (_, i) => ({ id: i }));
            mockState.scrollLength = 60;
            mockState.initialScroll = {
                index: 0,
                viewOffset: 0,
                viewPosition: 0,
            } as any;
            mockState.queuedInitialLayout = false;

            for (let i = 0; i < 4; i++) {
                const id = `item_${i}`;
                mockState.idCache[i] = id;
                mockState.indexByKey.set(id, i);
                mockState.containerItemKeys.set(id, i);
                setLayoutValue(mockState, "positions", id, i * 50);
                mockState.sizes.set(id, 50);
            }

            mockState.sizesKnown.set("item_0", 50);
            mockState.sizesKnown.set("item_1", 50);

            calculateItemsInView(mockCtx);

            expect(mockState.startNoBuffer).toBe(0);
            expect(mockState.endNoBuffer).toBe(1);
            expect(mockState.startBuffered).toBe(0);
            expect(mockState.endBuffered).toBe(3);
            expect(setDidLayoutSpy).not.toHaveBeenCalled();
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

        it("keeps the anchored end space tail mounted through alwaysRender indices", () => {
            setupList(60, 10);
            mockState.props.anchoredEndSpace = { anchorIndex: 58 };
            const indices = getAlwaysRenderIndices(
                mockState.props.alwaysRender,
                mockState.props.data,
                mockState.props.keyExtractor!,
                mockState.props.anchoredEndSpace.anchorIndex,
            );
            mockState.props.alwaysRenderIndicesArr = indices;
            mockState.props.alwaysRenderIndicesSet = new Set(indices);

            mockState.scroll = 0;
            calculateItemsInView(mockCtx);

            expect(mockState.containerItemKeys.has("item_58")).toBe(true);
            expect(mockState.containerItemKeys.has("item_59")).toBe(true);
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

            const duration = measureSteadyStateDuration(() => calculateItemsInView(mockCtx));

            expect(duration).toBeLessThan(150); // Keep this resilient under combined-suite load
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

        it("should call onStickyHeaderChange when the active sticky index changes inside the cached scroll range", () => {
            const onStickyHeaderChange = mock();
            setupStickyScenario();
            mockState.props.onStickyHeaderChange = onStickyHeaderChange;
            mockState.props.drawDistance = 50;
            mockState.scrollForNextCalculateItemsInView = {
                bottom: 2000,
                top: -1000,
            };
            mockState.idsInView = ["cached"];
            mockCtx.values.set("activeStickyIndex", 0);
            mockState.scroll = 150; // Should activate sticky index 1

            calculateItemsInView(mockCtx);

            expect(onStickyHeaderChange).toHaveBeenCalledTimes(1);
            expect(onStickyHeaderChange).toHaveBeenCalledWith({
                index: 1,
                item: mockState.props.data[1],
            });
            expect(mockState.idsInView).toEqual(["cached"]);
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

            const duration = measureSteadyStateDuration(() => calculateItemsInView(mockCtx));

            expect(duration).toBeLessThan(300); // Keep this as a local smoke budget, not a load-sensitive benchmark
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
