import { beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import "../setup"; // Import global test setup

import { Platform } from "@/platform/Platform";
import * as calculateItemsInViewModule from "../../src/core/calculateItemsInView";
import * as doMaintainScrollAtEndModule from "../../src/core/doMaintainScrollAtEnd";
import { updateItemSize, updateOneItemSize } from "../../src/core/updateItemSize";
import type { StateContext } from "../../src/state/state";
import type { InternalState } from "../../src/types";
import { getItemSize } from "../../src/utils/getItemSize";
import { normalizeMaintainVisibleContentPosition } from "../../src/utils/normalizeMaintainVisibleContentPosition";
import { createMockContext } from "../__mocks__/createMockContext";
import { setLayoutValue } from "../helpers/layoutArrays";

describe("updateItemSize functions", () => {
    let mockCtx: StateContext;
    let mockState: InternalState;
    let onItemSizeChangedCalls: any[];

    beforeEach(() => {
        onItemSizeChangedCalls = [];

        mockCtx = createMockContext(
            {
                numContainers: 10,
                otherAxisSize: 400,
                readyToRender: true,
            },
            {
                didContainersLayout: true,
                didFinishInitialScroll: true,
                endBuffered: 4,
                firstFullyOnScreenIndex: undefined,
                hasScrolled: false,
                indexByKey: new Map([
                    ["item_0", 0],
                    ["item_1", 1],
                    ["item_2", 2],
                    ["item_3", 3],
                    ["item_4", 4],
                ]),
                isAtStart: true,
                lastLayout: { height: 600, width: 400, x: 0, y: 0 },
                otherAxisSize: 400,
                props: {
                    data: [
                        { id: "item1", name: "First" },
                        { id: "item2", name: "Second" },
                        { id: "item3", name: "Third" },
                        { id: "item4", name: "Fourth" },
                        { id: "item5", name: "Fifth" },
                    ],
                    estimatedItemSize: 100,
                    maintainVisibleContentPosition: normalizeMaintainVisibleContentPosition(false),
                    onItemSizeChanged: (event: any) => onItemSizeChangedCalls.push(event),
                },
                queuedInitialLayout: true,
                scrollLength: 600,
                totalSize: 0,
            },
        );
        mockState = mockCtx.state;
    });

    describe("updateOneItemSize", () => {
        it("should update size for new item", () => {
            const sizeObj = { height: 150, width: 400 };

            const diff = updateOneItemSize(mockCtx, "item_0", sizeObj);

            expect(diff).toBe(50); // 150 - 100 (estimated size from getItemSize)
            expect(mockState.sizesKnown.get("item_0")).toBe(150);
            expect(mockState.sizes.get("item_0")).toBe(150);
        });

        it("should call getEstimatedItemSize with the correct item", () => {
            const sizeObj = { height: 150, width: 400 };
            let calledItem: any;
            mockState.props.getEstimatedItemSize = (item) => {
                calledItem = item;
                return 100;
            };

            const diff = updateOneItemSize(mockCtx, "item_0", sizeObj);

            expect(diff).toBe(50); // 150 - 100 (estimated size from getItemSize)
            expect(mockState.sizesKnown.get("item_0")).toBe(150);
            expect(mockState.sizes.get("item_0")).toBe(150);
            expect(calledItem).toBe(mockState.props.data[0]);
        });

        it("should calculate size difference when updating existing item", () => {
            mockState.sizesKnown.set("item_0", 100);
            const sizeObj = { height: 120, width: 400 };

            const diff = updateOneItemSize(mockCtx, "item_0", sizeObj);

            expect(diff).toBe(20); // 120 - 100
            expect(mockState.sizesKnown.get("item_0")).toBe(120);
        });

        it("should return 0 when size change is minimal", () => {
            mockState.sizesKnown.set("item_0", 100);
            const sizeObj = { height: 100.05, width: 400 }; // Very small change

            const diff = updateOneItemSize(mockCtx, "item_0", sizeObj);

            expect(diff).toBe(0); // Change < 0.1 threshold
            expect(mockState.sizesKnown.get("item_0")).toBe(100); // Still updated in sizesKnown
        });

        it("should handle horizontal layout", () => {
            mockState.props.horizontal = true;
            const sizeObj = { height: 100, width: 250 };

            const diff = updateOneItemSize(mockCtx, "item_0", sizeObj);

            expect(diff).toBe(150); // 250 - 100 (estimated size)
            expect(mockState.sizesKnown.get("item_0")).toBe(250);
        });

        it("should update average sizes", () => {
            const sizeObj = { height: 120, width: 400 };

            updateOneItemSize(mockCtx, "item_0", sizeObj);

            expect(mockState.averageSizes[""]).toEqual({
                avg: 120,
                num: 1,
            });

            // Add another item
            updateOneItemSize(mockCtx, "item_1", { height: 180, width: 400 });

            expect(mockState.averageSizes[""]).toEqual({
                avg: 150, // (120 + 180) / 2
                num: 2,
            });
        });

        it("keeps averages finite after data changes with known sizes", () => {
            const ctx = createMockContext(
                {},
                {
                    averageSizes: {},
                    indexByKey: new Map([["0", 0]]),
                    props: {
                        data: [0],
                        keyExtractor: (_item, index) => String(index),
                    },
                    sizesKnown: new Map([["0", 50]]),
                },
            );

            updateOneItemSize(ctx, "0", { height: 80, width: 100 });

            const average = ctx.state.averageSizes[""];
            expect(average).toBeDefined();
            expect(average.num).toBe(1);
            expect(Number.isFinite(average.avg)).toBe(true);
            expect(average.avg).toBe(80);
        });

        it("should round sizes to quarter pixels", () => {
            const sizeObj = { height: 150.123456, width: 400 };

            updateOneItemSize(mockCtx, "item_0", sizeObj);

            const expectedSize = Math.floor(150.123456 * 8) / 8; // Quarter pixel rounding
            expect(mockState.sizesKnown.get("item_0")).toBe(expectedSize);
        });

        it("should handle zero and negative sizes", () => {
            const sizeObj = { height: 0, width: 400 };

            const diff = updateOneItemSize(mockCtx, "item_0", sizeObj);

            expect(diff).toBe(-100); // 0 - 100 (estimated size)
            expect(mockState.sizesKnown.get("item_0")).toBe(0);
        });

        it("should handle missing data gracefully", () => {
            mockState.props.data = null as any;

            const diff = updateOneItemSize(mockCtx, "item_0", { height: 150, width: 400 });

            expect(diff).toBe(0);
        });
    });

    describe("updateItemSize", () => {
        it("treats modifier-only object options as all triggers", () => {
            const doMaintainScrollAtEndSpy = spyOn(
                doMaintainScrollAtEndModule,
                "doMaintainScrollAtEnd",
            ).mockReturnValue(true);
            mockState.props.maintainScrollAtEnd = { animated: true };
            mockState.sizesKnown.set("item_0", 100);
            mockState.sizes.set("item_0", 100);

            updateItemSize(mockCtx, "item_0", { height: 150, width: 400 });

            expect(doMaintainScrollAtEndSpy).toHaveBeenCalledWith(mockCtx);
            doMaintainScrollAtEndSpy.mockRestore();
        });

        it("respects explicit itemLayout on config", () => {
            const doMaintainScrollAtEndSpy = spyOn(
                doMaintainScrollAtEndModule,
                "doMaintainScrollAtEnd",
            ).mockReturnValue(true);
            mockState.props.maintainScrollAtEnd = {
                animated: true,
                on: { itemLayout: true },
            };
            mockState.sizesKnown.set("item_0", 100);
            mockState.sizes.set("item_0", 100);

            updateItemSize(mockCtx, "item_0", { height: 150, width: 400 });

            expect(doMaintainScrollAtEndSpy).toHaveBeenCalledWith(mockCtx);
            doMaintainScrollAtEndSpy.mockRestore();
        });

        it("skips item-layout anchoring when on excludes it", () => {
            const doMaintainScrollAtEndSpy = spyOn(
                doMaintainScrollAtEndModule,
                "doMaintainScrollAtEnd",
            ).mockReturnValue(true);
            mockState.props.maintainScrollAtEnd = {
                animated: true,
                on: { dataChange: true },
            };
            mockState.sizesKnown.set("item_0", 100);
            mockState.sizes.set("item_0", 100);

            updateItemSize(mockCtx, "item_0", { height: 150, width: 400 });

            expect(doMaintainScrollAtEndSpy).not.toHaveBeenCalled();
            doMaintainScrollAtEndSpy.mockRestore();
        });

        it("keeps totalSize correct when an averaged size is cached before measurement", () => {
            const ctx = createMockContext(
                {
                    numContainers: 0,
                    readyToRender: true,
                },
                {
                    averageSizes: { "": { avg: 20, num: 1 } },
                    didContainersLayout: true,
                    didFinishInitialScroll: true,
                    endBuffered: -1,
                    indexByKey: new Map([["item_0", 0]]),
                    props: {
                        data: [{ id: "item1", name: "First" }],
                        estimatedItemSize: undefined,
                        onItemSizeChanged: undefined,
                    },
                    startBuffered: 1,
                    totalSize: 0,
                },
            );
            const state = ctx.state;

            // Prime the cache with an averaged size without touching totalSize.
            getItemSize(ctx, "item_0", 0, state.props.data[0], true);

            expect(state.totalSizeExact).toBe(20);

            updateItemSize(ctx, "item_0", { height: 100, width: 400 });

            expect(state.totalSizeExact).toBe(100);
        });

        it("should update known sizes and total size tracking", () => {
            const prevTotal = mockState.totalSizeExact;
            updateItemSize(mockCtx, "item_0", { height: 150, width: 400 });

            expect(mockState.sizesKnown.get("item_0")).toBe(150);
            expect(onItemSizeChangedCalls.length).toBe(1);
            expect(mockState.totalSizeExact).not.toBe(prevTotal);
            expect(mockCtx.values.get("totalSize")).toBe(mockState.totalSizeExact);
        });

        it("starts deferred positions for size changes before the first fully visible item", () => {
            const calculateItemsInViewSpy = spyOn(calculateItemsInViewModule, "calculateItemsInView").mockReturnValue(
                undefined as any,
            );
            mockState.props.enableDeferredOptimization = true;
            mockState.firstFullyOnScreenIndex = 2;
            mockState.startNoBuffer = 1;
            mockState.userScrollActive = true;

            for (let i = 0; i < 5; i++) {
                const itemKey = `item_${i}`;
                mockState.idCache[i] = itemKey;
                mockState.indexByKey.set(itemKey, i);
                mockState.sizes.set(itemKey, 100);
                mockState.sizesKnown.set(itemKey, 100);
                setLayoutValue(mockState, "positions", itemKey, i * 100);
            }

            updateItemSize(mockCtx, "item_0", { height: 150, width: 400 });

            expect(mockState.deferredPositions).toEqual({
                anchorKey: "item_2",
                anchorRenderPosition: 200,
                drift: 50,
                firstItemRenderPosition: -50,
                kind: "runtime",
                minInvalidatedIndex: 1,
            });
            expect(calculateItemsInViewSpy).toHaveBeenCalledTimes(1);
            expect(calculateItemsInViewSpy.mock.calls[0]).toEqual([mockCtx]);

            calculateItemsInViewSpy.mockRestore();
        });

        it("uses mvcp instead of starting deferred positions when deferred optimization is disabled", () => {
            const calculateItemsInViewSpy = spyOn(calculateItemsInViewModule, "calculateItemsInView").mockReturnValue(
                undefined as any,
            );
            mockState.firstFullyOnScreenIndex = 2;
            mockState.startNoBuffer = 1;
            mockState.userScrollActive = true;

            for (let i = 0; i < 5; i++) {
                const itemKey = `item_${i}`;
                mockState.idCache[i] = itemKey;
                mockState.indexByKey.set(itemKey, i);
                mockState.sizes.set(itemKey, 100);
                mockState.sizesKnown.set(itemKey, 100);
                setLayoutValue(mockState, "positions", itemKey, i * 100);
            }

            updateItemSize(mockCtx, "item_0", { height: 150, width: 400 });

            expect(mockState.deferredPositions).toBeUndefined();
            expect(calculateItemsInViewSpy).toHaveBeenCalledTimes(1);
            expect(calculateItemsInViewSpy.mock.calls[0]).toEqual([mockCtx, { doMVCP: true }]);

            calculateItemsInViewSpy.mockRestore();
        });

        it("skips deferred positions for size changes at or below the first visible item even if they are before the first fully visible item", () => {
            const calculateItemsInViewSpy = spyOn(calculateItemsInViewModule, "calculateItemsInView").mockReturnValue(
                undefined as any,
            );
            mockState.firstFullyOnScreenIndex = 2;
            mockState.startNoBuffer = 1;
            mockState.userScrollActive = true;

            for (let i = 0; i < 5; i++) {
                const itemKey = `item_${i}`;
                mockState.idCache[i] = itemKey;
                mockState.indexByKey.set(itemKey, i);
                mockState.sizes.set(itemKey, 100);
                mockState.sizesKnown.set(itemKey, 100);
                setLayoutValue(mockState, "positions", itemKey, i * 100);
            }

            updateItemSize(mockCtx, "item_1", { height: 150, width: 400 });

            expect(mockState.deferredPositions).toBeUndefined();
            expect(calculateItemsInViewSpy).toHaveBeenCalledTimes(1);
            expect(calculateItemsInViewSpy.mock.calls[0]).toEqual([mockCtx, { doMVCP: true }]);

            calculateItemsInViewSpy.mockRestore();
        });

        it("flushes an active non-initial deferred session before resizing an on-screen row", () => {
            const requestAdjust = mock();
            mockState.props.enableDeferredOptimization = true;
            mockState.scroll = 100;
            mockState.userScrollActive = true;
            mockState.scrollAdjustHandler = {
                getAdjust: () => 0,
                requestAdjust,
                setMounted: () => {},
            } as any;
            const triggerCalculateItemsInView = mock();
            mockState.firstFullyOnScreenIndex = 2;
            mockState.startNoBuffer = 1;
            mockState.triggerCalculateItemsInView = triggerCalculateItemsInView;

            for (let i = 0; i < 5; i++) {
                const itemKey = `item_${i}`;
                mockState.idCache[i] = itemKey;
                mockState.indexByKey.set(itemKey, i);
                mockState.sizes.set(itemKey, 100);
                mockState.sizesKnown.set(itemKey, 100);
                setLayoutValue(mockState, "positions", itemKey, i * 100);
            }

            mockState.deferredPositions = {
                anchorKey: "item_2",
                anchorRenderPosition: 200,
                drift: -40,
                minInvalidatedIndex: 1,
            };

            updateItemSize(mockCtx, "item_1", { height: 150, width: 400 });

            expect(mockState.deferredPositions).toBeUndefined();
            expect(mockState.positions[1]).toBe(100);
            expect(mockState.positions[2]).toBe(250);
            expect(mockState.positions[3]).toBe(350);
            expect(triggerCalculateItemsInView).toHaveBeenCalledTimes(1);
            expect(triggerCalculateItemsInView).toHaveBeenCalledWith({ doMVCP: false });
            expect(requestAdjust).toHaveBeenCalledTimes(1);
            expect(requestAdjust).toHaveBeenCalledWith(50);
            expect(mockState.scroll).toBe(150);
        });

        it("keeps prepend measurements in one ownership window until the tracked prepend keys are measured", () => {
            const requestAdjust = mock();
            const triggerCalculateItemsInView = mock();
            const calculateItemsInViewSpy = spyOn(calculateItemsInViewModule, "calculateItemsInView").mockReturnValue(
                undefined as any,
            );
            mockState.props.enableDeferredOptimization = true;
            mockState.scroll = 1000;
            mockState.firstFullyOnScreenIndex = 5;
            mockState.startNoBuffer = 4;
            mockState.triggerCalculateItemsInView = triggerCalculateItemsInView;
            mockState.scrollAdjustHandler = {
                getAdjust: () => 0,
                requestAdjust,
                setMounted: () => {},
            } as any;
            mockState.prependMeasurementWindow = {
                anchorIndex: 5,
                anchorKey: "item_5",
                anchorRenderPosition: 500,
                dataChangeEpoch: 1,
                minInvalidatedIndex: 4,
                pendingKeys: new Set(["item_3", "item_4"]),
            };
            mockState.props.data = Array.from({ length: 7 }, (_, i) => ({
                id: `item${i}`,
                name: `Item ${i}`,
            }));

            for (let i = 0; i < 7; i++) {
                const itemKey = `item_${i}`;
                mockState.idCache[i] = itemKey;
                mockState.indexByKey.set(itemKey, i);
                mockState.sizes.set(itemKey, 100);
                setLayoutValue(mockState, "positions", itemKey, i * 100);
            }

            updateItemSize(mockCtx, "item_4", { height: 150, width: 400 });

            expect(mockState.deferredPositions).toEqual({
                anchorKey: "item_5",
                anchorRenderPosition: 500,
                drift: 50,
                firstItemRenderPosition: -50,
                kind: "prepend_measurement",
                minInvalidatedIndex: 4,
            });
            expect(mockState.prependMeasurementWindow?.pendingKeys).toEqual(new Set(["item_3"]));
            expect(requestAdjust).not.toHaveBeenCalled();
            expect(calculateItemsInViewSpy).toHaveBeenCalledTimes(1);
            expect(calculateItemsInViewSpy.mock.calls[0]).toEqual([mockCtx]);

            updateItemSize(mockCtx, "item_3", { height: 160, width: 400 });

            expect(mockState.prependMeasurementWindow).toBeUndefined();
            expect(mockState.deferredPositions).toBeUndefined();
            expect(requestAdjust).toHaveBeenCalledTimes(1);
            expect(requestAdjust).toHaveBeenCalledWith(110);
            expect(mockState.scroll).toBe(1110);
            expect(triggerCalculateItemsInView).toHaveBeenCalledWith({ doMVCP: false });

            calculateItemsInViewSpy.mockRestore();
        });

        it("keeps deferred initial scroll active when deferred optimization is disabled", () => {
            const calculateItemsInViewSpy = spyOn(calculateItemsInViewModule, "calculateItemsInView").mockReturnValue(
                undefined as any,
            );
            mockState.firstFullyOnScreenIndex = 2;
            mockState.startNoBuffer = 1;
            mockState.userScrollActive = true;

            for (let i = 0; i < 5; i++) {
                const itemKey = `item_${i}`;
                mockState.idCache[i] = itemKey;
                mockState.indexByKey.set(itemKey, i);
                mockState.sizes.set(itemKey, 100);
                mockState.sizesKnown.set(itemKey, 100);
                setLayoutValue(mockState, "positions", itemKey, i * 100);
            }

            mockState.deferredPositions = {
                anchorKey: "item_2",
                anchorRenderPosition: 200,
                desiredScrollOffset: 200,
                drift: 0,
                kind: "initial_scroll",
                minInvalidatedIndex: 1,
            };

            updateItemSize(mockCtx, "item_0", { height: 150, width: 400 });

            expect(mockState.deferredPositions).toEqual({
                anchorKey: "item_2",
                anchorRenderPosition: 200,
                desiredScrollOffset: 200,
                drift: 50,
                firstItemRenderPosition: -50,
                kind: "initial_scroll",
                minInvalidatedIndex: 1,
            });
            expect(calculateItemsInViewSpy).toHaveBeenCalledTimes(1);
            expect(calculateItemsInViewSpy.mock.calls[0]).toEqual([mockCtx]);

            calculateItemsInViewSpy.mockRestore();
        });

        it("uses mvcp instead of starting deferred positions when scroll is idle", () => {
            const calculateItemsInViewSpy = spyOn(calculateItemsInViewModule, "calculateItemsInView").mockReturnValue(
                undefined as any,
            );
            mockState.firstFullyOnScreenIndex = 2;
            mockState.startNoBuffer = 2;
            mockState.userScrollActive = false;

            for (let i = 0; i < 5; i++) {
                const itemKey = `item_${i}`;
                mockState.idCache[i] = itemKey;
                mockState.indexByKey.set(itemKey, i);
                mockState.sizes.set(itemKey, 100);
                mockState.sizesKnown.set(itemKey, 100);
                setLayoutValue(mockState, "positions", itemKey, i * 100);
            }

            updateItemSize(mockCtx, "item_0", { height: 150, width: 400 });

            expect(mockState.deferredPositions).toBeUndefined();
            expect(calculateItemsInViewSpy).toHaveBeenCalledTimes(1);
            expect(calculateItemsInViewSpy.mock.calls[0]).toEqual([mockCtx, { doMVCP: true }]);

            calculateItemsInViewSpy.mockRestore();
        });

        it("uses mvcp instead of starting deferred positions for active Android scrolling", () => {
            const prevPlatform = Platform.OS;
            Platform.OS = "android";
            try {
                const calculateItemsInViewSpy = spyOn(
                    calculateItemsInViewModule,
                    "calculateItemsInView",
                ).mockReturnValue(undefined as any);
                mockState.props.enableDeferredOptimization = true;
                mockState.firstFullyOnScreenIndex = 2;
                mockState.startNoBuffer = 2;
                mockState.userScrollActive = true;

                for (let i = 0; i < 5; i++) {
                    const itemKey = `item_${i}`;
                    mockState.idCache[i] = itemKey;
                    mockState.indexByKey.set(itemKey, i);
                    mockState.sizes.set(itemKey, 100);
                    mockState.sizesKnown.set(itemKey, 100);
                    setLayoutValue(mockState, "positions", itemKey, i * 100);
                }

                updateItemSize(mockCtx, "item_0", { height: 150, width: 400 });

                expect(mockState.deferredPositions).toBeUndefined();
                expect(calculateItemsInViewSpy).toHaveBeenCalledTimes(1);
                expect(calculateItemsInViewSpy.mock.calls[0]).toEqual([mockCtx, { doMVCP: true }]);

                calculateItemsInViewSpy.mockRestore();
            } finally {
                Platform.OS = prevPlatform;
            }
        });

        it("keeps MVCP recalculation for size changes at or after the active anchor", () => {
            const calculateItemsInViewSpy = spyOn(calculateItemsInViewModule, "calculateItemsInView").mockReturnValue(
                undefined as any,
            );
            mockState.firstFullyOnScreenIndex = 2;
            mockState.startNoBuffer = 2;

            for (let i = 0; i < 5; i++) {
                const itemKey = `item_${i}`;
                mockState.idCache[i] = itemKey;
                mockState.indexByKey.set(itemKey, i);
                mockState.sizes.set(itemKey, 100);
                mockState.sizesKnown.set(itemKey, 100);
                setLayoutValue(mockState, "positions", itemKey, i * 100);
            }

            updateItemSize(mockCtx, "item_3", { height: 150, width: 400 });

            expect(mockState.deferredPositions).toBeUndefined();
            expect(calculateItemsInViewSpy).toHaveBeenCalledTimes(1);
            expect(calculateItemsInViewSpy.mock.calls[0]).toEqual([mockCtx, { doMVCP: true }]);

            calculateItemsInViewSpy.mockRestore();
        });

        it("should respect early return when data is missing", () => {
            mockState.props.data = null as any;

            expect(() => updateItemSize(mockCtx, "item_0", { height: 150, width: 400 })).not.toThrow();
            expect(mockState.sizesKnown.size).toBe(0);
            expect(onItemSizeChangedCalls.length).toBe(0);
        });

        it("should update other axis size when requested", () => {
            mockState.needsOtherAxisSize = true;
            mockCtx.values.set("otherAxisSize", 400);

            updateItemSize(mockCtx, "item_0", { height: 150, width: 420 });

            expect(mockCtx.values.get("otherAxisSize")).toBe(420);
        });

        it("schedules a single mvcp recalculate per frame while anchor lock is active", () => {
            const prevPlatform = Platform.OS;
            Platform.OS = "web";
            try {
                const calculateSpy = spyOn(calculateItemsInViewModule, "calculateItemsInView").mockImplementation(
                    () => undefined as any,
                );
                const rafCallbacks: Array<(time: number) => void> = [];
                const rafSpy = spyOn(globalThis, "requestAnimationFrame").mockImplementation((cb: any) => {
                    rafCallbacks.push(cb);
                    return rafCallbacks.length;
                });
                try {
                    mockState.mvcpAnchorLock = {
                        expiresAt: Date.now() + 1000,
                        id: "item_0",
                        position: 0,
                        quietPasses: 0,
                    };

                    updateItemSize(mockCtx, "item_0", { height: 150, width: 400 });
                    updateItemSize(mockCtx, "item_0", { height: 170, width: 400 });

                    expect(calculateSpy).not.toHaveBeenCalled();
                    expect(rafCallbacks.length).toBe(1);
                    expect(mockState.queuedMVCPRecalculate).toBe(1);

                    rafCallbacks[0](0);

                    expect(calculateSpy).toHaveBeenCalledTimes(1);
                    expect(calculateSpy).toHaveBeenCalledWith(mockCtx, { doMVCP: true });
                    expect(mockState.queuedMVCPRecalculate).toBeUndefined();
                } finally {
                    rafSpy.mockRestore();
                    calculateSpy.mockRestore();
                }
            } finally {
                Platform.OS = prevPlatform;
            }
        });

        it("cancels queued mvcp recalculate and runs immediately when anchor lock clears", () => {
            const prevPlatform = Platform.OS;
            Platform.OS = "web";
            try {
                const calculateSpy = spyOn(calculateItemsInViewModule, "calculateItemsInView").mockImplementation(
                    () => undefined as any,
                );
                const rafSpy = spyOn(globalThis, "requestAnimationFrame").mockImplementation((_cb: any) => 42);
                const cancelCalls: number[] = [];
                const originalCancelAnimationFrame = globalThis.cancelAnimationFrame;
                globalThis.cancelAnimationFrame = (id: number) => {
                    cancelCalls.push(id);
                };
                try {
                    mockState.mvcpAnchorLock = {
                        expiresAt: Date.now() + 1000,
                        id: "item_0",
                        position: 0,
                        quietPasses: 0,
                    };

                    updateItemSize(mockCtx, "item_0", { height: 150, width: 400 });
                    expect(mockState.queuedMVCPRecalculate).toBe(42);

                    mockState.mvcpAnchorLock = undefined;
                    updateItemSize(mockCtx, "item_0", { height: 180, width: 400 });

                    expect(cancelCalls).toEqual([42]);
                    expect(calculateSpy).toHaveBeenCalledTimes(1);
                    expect(calculateSpy).toHaveBeenCalledWith(mockCtx, { doMVCP: true });
                    expect(mockState.queuedMVCPRecalculate).toBeUndefined();
                } finally {
                    globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
                    rafSpy.mockRestore();
                    calculateSpy.mockRestore();
                }
            } finally {
                Platform.OS = prevPlatform;
            }
        });
    });
});
