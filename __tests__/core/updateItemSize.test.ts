import { beforeEach, describe, expect, it, spyOn } from "bun:test";
import "../setup"; // Import global test setup

import * as calculateItemsInViewModule from "../../src/core/calculateItemsInView";
import { Platform } from "@/platform/Platform";
import { updateItemSize, updateOneItemSize } from "../../src/core/updateItemSize";
import type { StateContext } from "../../src/state/state";
import type { InternalState } from "../../src/types";
import { getItemSize } from "../../src/utils/getItemSize";
import { normalizeMaintainVisibleContentPosition } from "../../src/utils/normalizeMaintainVisibleContentPosition";
import { createMockContext } from "../__mocks__/createMockContext";

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

            expect(state.totalSize).toBe(20);

            updateItemSize(ctx, "item_0", { height: 100, width: 400 });

            expect(state.totalSize).toBe(100);
        });

        it("should update known sizes and total size tracking", () => {
            const prevTotal = mockState.totalSize;
            updateItemSize(mockCtx, "item_0", { height: 150, width: 400 });

            expect(mockState.sizesKnown.get("item_0")).toBe(150);
            expect(onItemSizeChangedCalls.length).toBe(1);
            expect(mockState.totalSize).not.toBe(prevTotal);
            expect(mockCtx.values.get("totalSize")).toBe(mockState.totalSize);
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
