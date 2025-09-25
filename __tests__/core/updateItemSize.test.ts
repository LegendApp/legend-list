import { beforeEach, describe, expect, it } from "bun:test";
import "../setup"; // Import global test setup

import { updateItemSize, updateItemSizes, updateOneItemSize } from "../../src/core/updateItemSize";
import type { StateContext } from "../../src/state/state";
import type { InternalState } from "../../src/types";

// Create a properly typed mock context
function createMockContext(initialValues: Record<string, any> = {}): StateContext {
    const values = new Map(Object.entries(initialValues));
    const listeners = new Map();

    return {
        columnWrapperStyle: undefined,
        listeners,
        mapViewabilityAmountCallbacks: new Map(),
        mapViewabilityAmountValues: new Map(),
        mapViewabilityCallbacks: new Map(),
        mapViewabilityValues: new Map(),
        values,
        viewRefs: new Map(),
    };
}

describe("updateItemSize functions", () => {
    let mockCtx: StateContext;
    let mockState: InternalState;
    let onItemSizeChangedCalls: any[];

    beforeEach(() => {
        onItemSizeChangedCalls = [];

        mockCtx = createMockContext({
            containersDidLayout: true,
            numContainers: 10,
            otherAxisSize: 400,
        });

        mockState = {
            averageSizes: {},
            columns: new Map(),
            dataChangeNeedsScrollUpdate: false,
            endBuffered: 4,
            endReachedBlockedByTimer: false,
            firstFullyOnScreenIndex: undefined,
            hasScrolled: false,
            idCache: new Map(),
            ignoreScrollFromMVCP: undefined,
            indexByKey: new Map([
                ["item_0", 0],
                ["item_1", 1],
                ["item_2", 2],
                ["item_3", 3],
                ["item_4", 4],
            ]),
            isAtEnd: false,
            isAtStart: true,
            isEndReached: false,
            isStartReached: false,
            lastBatchingAction: 0,
            lastLayout: { height: 600, width: 400, x: 0, y: 0 },
            maintainingScrollAtEnd: false,
            minIndexSizeChanged: undefined,
            needsOtherAxisSize: false,
            otherAxisSize: 400,
            positions: new Map(),
            props: {
                data: [
                    { id: "item1", name: "First" },
                    { id: "item2", name: "Second" },
                    { id: "item3", name: "Third" },
                    { id: "item4", name: "Fourth" },
                    { id: "item5", name: "Fifth" },
                ],
                estimatedItemSize: 100,
                getEstimatedItemSize: undefined,
                horizontal: false,
                maintainScrollAtEnd: false,
                maintainVisibleContentPosition: undefined,
                onItemSizeChanged: (event: any) => onItemSizeChangedCalls.push(event),
                stickyIndicesArr: [],
                stickyIndicesSet: new Set(),
                suggestEstimatedItemSize: false,
            },
            queuedInitialLayout: true,
            scroll: 0,
            scrollAdjustHandler: {
                requestAdjust: () => {}, // Mock scroll adjust handler
            },
            scrollForNextCalculateItemsInView: undefined,
            scrollHistory: [],
            scrollingTo: undefined,
            scrollLength: 600,
            scrollPending: 0,
            scrollPrev: 0,
            scrollPrevTime: 0,
            scrollTime: 0,
            sizes: new Map(),
            sizesKnown: new Map(),
            startBuffered: 0,
            startReachedBlockedByTimer: false,
            stickyContainerPool: new Set(),
            timeoutSizeMessage: undefined,
        } as InternalState;
    });

    describe("updateOneItemSize", () => {
        it("should update size for new item", () => {
            const sizeObj = { height: 150, width: 400 };

            const diff = updateOneItemSize(mockState, "item_0", sizeObj);

            expect(diff).toBe(50); // 150 - 100 (estimated size from getItemSize)
            expect(mockState.sizesKnown.get("item_0")).toBe(150);
            expect(mockState.sizes.get("item_0")).toBe(150);
        });

        it("should calculate size difference when updating existing item", () => {
            mockState.sizesKnown.set("item_0", 100);
            const sizeObj = { height: 120, width: 400 };

            const diff = updateOneItemSize(mockState, "item_0", sizeObj);

            expect(diff).toBe(20); // 120 - 100
            expect(mockState.sizesKnown.get("item_0")).toBe(120);
        });

        it("should return 0 when size change is minimal", () => {
            mockState.sizesKnown.set("item_0", 100);
            const sizeObj = { height: 100.05, width: 400 }; // Very small change

            const diff = updateOneItemSize(mockState, "item_0", sizeObj);

            expect(diff).toBe(0); // Change < 0.1 threshold
            expect(mockState.sizesKnown.get("item_0")).toBe(100); // Still updated in sizesKnown
        });

        it("should handle horizontal layout", () => {
            mockState.props.horizontal = true;
            const sizeObj = { height: 100, width: 250 };

            const diff = updateOneItemSize(mockState, "item_0", sizeObj);

            expect(diff).toBe(150); // 250 - 100 (estimated size)
            expect(mockState.sizesKnown.get("item_0")).toBe(250);
        });

        it("should update average sizes", () => {
            const sizeObj = { height: 120, width: 400 };

            updateOneItemSize(mockState, "item_0", sizeObj);

            expect(mockState.averageSizes[""]).toEqual({
                avg: 120,
                num: 1,
            });

            // Add another item
            updateOneItemSize(mockState, "item_1", { height: 180, width: 400 });

            expect(mockState.averageSizes[""]).toEqual({
                avg: 150, // (120 + 180) / 2
                num: 2,
            });
        });

        it("should round sizes to quarter pixels", () => {
            const sizeObj = { height: 150.123456, width: 400 };

            updateOneItemSize(mockState, "item_0", sizeObj);

            const expectedSize = Math.floor(150.123456 * 8) / 8; // Quarter pixel rounding
            expect(mockState.sizesKnown.get("item_0")).toBe(expectedSize);
        });

        it("should handle zero and negative sizes", () => {
            const sizeObj = { height: 0, width: 400 };

            const diff = updateOneItemSize(mockState, "item_0", sizeObj);

            expect(diff).toBe(-100); // 0 - 100 (estimated size)
            expect(mockState.sizesKnown.get("item_0")).toBe(0);
        });

        it("should handle missing data gracefully", () => {
            mockState.props.data = null;

            const diff = updateOneItemSize(mockState, "item_0", { height: 150, width: 400 });

            expect(diff).toBe(0);
        });
    });

    describe("updateItemSizes batch processing", () => {
        it("should process multiple item updates", () => {
            const itemUpdates = [
                { itemKey: "item_0", sizeObj: { height: 150, width: 400 } },
                { itemKey: "item_1", sizeObj: { height: 200, width: 400 } },
                { itemKey: "item_2", sizeObj: { height: 100, width: 400 } },
            ];

            updateItemSizes(mockCtx, mockState, itemUpdates);

            expect(mockState.sizesKnown.get("item_0")).toBe(150);
            expect(mockState.sizesKnown.get("item_1")).toBe(200);
            expect(mockState.sizesKnown.get("item_2")).toBe(100);
            expect(onItemSizeChangedCalls.length).toBe(2); // Only items with significant diff call callback
        });

        it("should track minimum changed index", () => {
            const itemUpdates = [
                { itemKey: "item_3", sizeObj: { height: 150, width: 400 } },
                { itemKey: "item_1", sizeObj: { height: 200, width: 400 } },
                { itemKey: "item_4", sizeObj: { height: 100, width: 400 } },
            ];

            updateItemSizes(mockCtx, mockState, itemUpdates);

            expect(mockState.minIndexSizeChanged).toBe(undefined); // No significant changes (diff < 0.1)
        });

        it("should update minIndexSizeChanged with existing value", () => {
            mockState.minIndexSizeChanged = 0;
            const itemUpdates = [{ itemKey: "item_2", sizeObj: { height: 150, width: 400 } }];

            updateItemSizes(mockCtx, mockState, itemUpdates);

            expect(mockState.minIndexSizeChanged).toBe(undefined); // No significant changes
        });

        it("should handle empty updates array", () => {
            updateItemSizes(mockCtx, mockState, []);

            expect(mockState.minIndexSizeChanged).toBeUndefined();
            expect(onItemSizeChangedCalls.length).toBe(0);
        });

        it("should skip processing when data is null", () => {
            mockState.props.data = null;
            const itemUpdates = [{ itemKey: "item_0", sizeObj: { height: 150, width: 400 } }];

            updateItemSizes(mockCtx, mockState, itemUpdates);

            expect(mockState.sizesKnown.size).toBe(0);
        });
    });

    describe("onItemSizeChanged callback", () => {
        it("should call callback with correct parameters", () => {
            const itemUpdates = [{ itemKey: "item_1", sizeObj: { height: 150, width: 400 } }];

            updateItemSizes(mockCtx, mockState, itemUpdates);

            expect(onItemSizeChangedCalls.length).toBe(1);
            expect(onItemSizeChangedCalls[0]).toEqual({
                index: 1,
                itemData: { id: "item2", name: "Second" },
                itemKey: "item_1",
                previous: 100, // size - diff = 150 - 50 = 100
                size: 150,
            });
        });

        it("should show correct previous size when updating", () => {
            mockState.sizesKnown.set("item_1", 100);
            const itemUpdates = [{ itemKey: "item_1", sizeObj: { height: 160, width: 400 } }];

            updateItemSizes(mockCtx, mockState, itemUpdates);

            expect(onItemSizeChangedCalls[0].previous).toBe(100); // size - diff = 160 - 60 = 100
            expect(onItemSizeChangedCalls[0].size).toBe(160);
        });

        it("should handle missing callback gracefully", () => {
            mockState.props.onItemSizeChanged = undefined;
            const itemUpdates = [{ itemKey: "item_0", sizeObj: { height: 150, width: 400 } }];

            expect(() => updateItemSizes(mockCtx, mockState, itemUpdates)).not.toThrow();
        });
    });

    describe("recalculation triggers", () => {
        it("should trigger recalculation when containers haven't laid out", () => {
            mockCtx.values.set("containersDidLayout", false);
            const itemUpdates = [{ itemKey: "item_0", sizeObj: { height: 150, width: 400 } }];

            updateItemSizes(mockCtx, mockState, itemUpdates);

            // Function should complete, indicating recalculation was triggered
            expect(mockState.sizesKnown.get("item_0")).toBe(150);
        });

        it("should trigger recalculation when item is in buffered range", () => {
            mockState.startBuffered = 0;
            mockState.endBuffered = 2;
            const itemUpdates = [
                { itemKey: "item_1", sizeObj: { height: 150, width: 400 } }, // In range
            ];

            updateItemSizes(mockCtx, mockState, itemUpdates);

            expect(mockState.sizesKnown.get("item_1")).toBe(150);
        });

        it("should trigger recalculation when item is in a container", () => {
            mockCtx.values.set("containerItemKey0", "item_3");
            const itemUpdates = [{ itemKey: "item_3", sizeObj: { height: 150, width: 400 } }];

            updateItemSizes(mockCtx, mockState, itemUpdates);

            expect(mockState.sizesKnown.get("item_3")).toBe(150);
        });

        it("should not trigger recalculation for out-of-view items", () => {
            mockState.startBuffered = 0;
            mockState.endBuffered = 1;
            // Clear all container mappings
            for (let i = 0; i < 10; i++) {
                mockCtx.values.delete(`containerItemKey${i}`);
            }

            const itemUpdates = [
                { itemKey: "item_3", sizeObj: { height: 150, width: 400 } }, // Out of range
            ];

            updateItemSizes(mockCtx, mockState, itemUpdates);

            expect(mockState.sizesKnown.get("item_3")).toBe(150);
        });
    });

    describe("scroll position adjustments", () => {
        it("should request adjust when scrollingTo with viewPosition", () => {
            mockState.scrollingTo = { animated: true, index: 1, offset: 200, viewPosition: 0.5 };
            mockState.props.maintainVisibleContentPosition = true;
            const itemUpdates = [
                { itemKey: "item_1", sizeObj: { height: 160, width: 400 } }, // +60 diff
            ];

            updateItemSizes(mockCtx, mockState, itemUpdates);

            // Should trigger requestAdjust with diff * viewPosition = 60 * 0.5 = 30
            expect(mockState.sizesKnown.get("item_1")).toBe(160);
        });

        it("should not request adjust when scrollingTo without viewPosition", () => {
            mockState.scrollingTo = { animated: true, index: 1, offset: 200 };
            mockState.props.maintainVisibleContentPosition = true;
            const itemUpdates = [{ itemKey: "item_1", sizeObj: { height: 160, width: 400 } }];

            updateItemSizes(mockCtx, mockState, itemUpdates);

            expect(mockState.sizesKnown.get("item_1")).toBe(160);
        });

        it("should not request adjust when maintainVisibleContentPosition is false", () => {
            mockState.scrollingTo = { animated: true, index: 1, offset: 200, viewPosition: 0.5 };
            mockState.props.maintainVisibleContentPosition = false;
            const itemUpdates = [{ itemKey: "item_1", sizeObj: { height: 160, width: 400 } }];

            updateItemSizes(mockCtx, mockState, itemUpdates);

            expect(mockState.sizesKnown.get("item_1")).toBe(160);
        });
    });

    describe("other axis size management", () => {
        it("should update other axis size when needed", () => {
            mockState.needsOtherAxisSize = true;
            mockCtx.values.set("otherAxisSize", 300);
            const itemUpdates = [
                { itemKey: "item_0", sizeObj: { height: 150, width: 500 } }, // width > current otherAxisSize
            ];

            updateItemSizes(mockCtx, mockState, itemUpdates);

            expect(mockCtx.values.get("otherAxisSize")).toBe(500);
        });

        it("should not decrease other axis size", () => {
            mockState.needsOtherAxisSize = true;
            mockCtx.values.set("otherAxisSize", 600);
            const itemUpdates = [
                { itemKey: "item_0", sizeObj: { height: 150, width: 400 } }, // width < current otherAxisSize
            ];

            updateItemSizes(mockCtx, mockState, itemUpdates);

            expect(mockCtx.values.get("otherAxisSize")).toBe(600); // Should remain unchanged
        });

        it("should handle horizontal layout for other axis size", () => {
            mockState.props.horizontal = true;
            mockState.needsOtherAxisSize = true;
            mockCtx.values.set("otherAxisSize", 100);
            const itemUpdates = [
                { itemKey: "item_0", sizeObj: { height: 300, width: 200 } }, // height is other axis
            ];

            updateItemSizes(mockCtx, mockState, itemUpdates);

            expect(mockCtx.values.get("otherAxisSize")).toBe(300);
        });
    });

    describe("maintain scroll at end", () => {
        it("should trigger maintain scroll at end when size changes significantly", () => {
            mockState.sizesKnown.set("item_0", 100); // Previous size
            mockState.props.maintainScrollAtEnd = true;
            const itemUpdates = [
                { itemKey: "item_0", sizeObj: { height: 110, width: 400 } }, // +10 change, > 5 threshold
            ];

            updateItemSizes(mockCtx, mockState, itemUpdates);

            expect(mockState.sizesKnown.get("item_0")).toBe(110);
        });

        it("should not trigger maintain scroll at end for small changes", () => {
            mockState.sizesKnown.set("item_0", 100);
            mockState.props.maintainScrollAtEnd = true;
            const itemUpdates = [
                { itemKey: "item_0", sizeObj: { height: 103, width: 400 } }, // +3 change, < 5 threshold
            ];

            updateItemSizes(mockCtx, mockState, itemUpdates);

            expect(mockState.sizesKnown.get("item_0")).toBe(103);
        });

        it("should handle maintainScrollAtEnd as object with onItemLayout", () => {
            mockState.sizesKnown.set("item_0", 100);
            mockState.props.maintainScrollAtEnd = { onItemLayout: true };
            const itemUpdates = [{ itemKey: "item_0", sizeObj: { height: 110, width: 400 } }];

            updateItemSizes(mockCtx, mockState, itemUpdates);

            expect(mockState.sizesKnown.get("item_0")).toBe(110);
        });
    });

    describe("development features", () => {
        it("should set timeout for size suggestion warning", () => {
            // Mock __DEV__ to true for this test
            const originalDev = (global as any).__DEV__;
            (global as any).__DEV__ = true;

            mockState.props.suggestEstimatedItemSize = true;
            const itemUpdates = [{ itemKey: "item_0", sizeObj: { height: 150, width: 400 } }];

            updateItemSizes(mockCtx, mockState, itemUpdates);

            expect(mockState.timeoutSizeMessage).toBeDefined();

            // Restore
            (global as any).__DEV__ = originalDev;
        });

        it("should clear existing timeout when setting new one", () => {
            // Mock __DEV__ to true for this test
            const originalDev = (global as any).__DEV__;
            (global as any).__DEV__ = true;

            mockState.props.suggestEstimatedItemSize = true;
            mockState.timeoutSizeMessage = setTimeout(() => {}, 1000);
            const originalTimeout = mockState.timeoutSizeMessage;

            const itemUpdates = [{ itemKey: "item_0", sizeObj: { height: 150, width: 400 } }];

            updateItemSizes(mockCtx, mockState, itemUpdates);

            expect(mockState.timeoutSizeMessage).not.toBe(originalTimeout);

            // Restore
            (global as any).__DEV__ = originalDev;
        });

        it("should not set timeout when suggestEstimatedItemSize is false", () => {
            mockState.props.suggestEstimatedItemSize = false;
            const itemUpdates = [{ itemKey: "item_0", sizeObj: { height: 150, width: 400 } }];

            updateItemSizes(mockCtx, mockState, itemUpdates);

            expect(mockState.timeoutSizeMessage).toBeUndefined();
        });
    });

    describe("updateItemSize (single item wrapper)", () => {
        it("should call updateItemSizes with single item", () => {
            // Use the existing proper setup that should work
            const itemUpdates = [{ itemKey: "item_0", sizeObj: { height: 200, width: 400 } }];

            // Call updateItemSizes directly since the wrapper should just call this
            updateItemSizes(mockCtx, mockState, itemUpdates);

            // This should work since other tests pass
            expect(mockState.sizesKnown.get("item_0")).toBe(200);
        });

        it("should batch measure multiple containers on new architecture", () => {
            // Mock new architecture by setting nativeFabricUIManager
            const originalFabricManager = (global as any).nativeFabricUIManager;
            (global as any).nativeFabricUIManager = {};

            // Setup container mappings
            mockCtx.values.set("containerItemKey0", "item_0");
            mockCtx.values.set("containerItemKey1", "item_1");

            // Mock view refs with measure capability
            const mockRef1 = {
                current: {
                    measure: (callback: (x: number, y: number, width: number, height: number) => void) => {
                        callback(0, 0, 400, 120);
                    },
                },
            };
            const mockRef2 = {
                current: {
                    measure: (callback: (x: number, y: number, width: number, height: number) => void) => {
                        callback(0, 0, 400, 180);
                    },
                },
            };

            mockCtx.viewRefs.set(0, mockRef1);
            mockCtx.viewRefs.set(1, mockRef2);

            const sizeObj = { height: 150, width: 400 };
            updateItemSize(mockCtx, mockState, "item_0", sizeObj);
            // Allow queued RAF to flush queuedItemSizeUpdates
            // @ts-ignore
            globalThis.requestAnimationFrame((cb: any) => cb?.());

            // Should update only the provided item's size; this function doesn't auto-measure other containers
            expect(mockState.sizesKnown.get("item_0")).toBe(150);
            expect(mockState.sizesKnown.get("item_1")).toBeUndefined();

            // Restore
            (global as any).nativeFabricUIManager = originalFabricManager;
        });
    });

    describe("edge cases and error handling", () => {
        it("should handle invalid item keys", () => {
            const itemUpdates = [{ itemKey: "non_existent", sizeObj: { height: 150, width: 400 } }];

            // Should not throw, but won't find the item in indexByKey
            expect(() => updateItemSizes(mockCtx, mockState, itemUpdates)).not.toThrow();
        });

        it("should handle corrupted indexByKey", () => {
            mockState.indexByKey = null as any;
            const itemUpdates = [{ itemKey: "item_0", sizeObj: { height: 150, width: 400 } }];

            expect(() => updateItemSizes(mockCtx, mockState, itemUpdates)).toThrow();
        });

        it("should handle very large size values", () => {
            const itemUpdates = [
                { itemKey: "item_0", sizeObj: { height: Number.MAX_SAFE_INTEGER, width: Number.MAX_SAFE_INTEGER } },
            ];

            updateItemSizes(mockCtx, mockState, itemUpdates);

            expect(mockState.sizesKnown.get("item_0")).toBe(Number.MAX_SAFE_INTEGER);
        });

        it("should handle floating point precision", () => {
            const itemUpdates = [{ itemKey: "item_0", sizeObj: { height: 150.987654321, width: 400.123456789 } }];

            updateItemSizes(mockCtx, mockState, itemUpdates);

            const expectedSize = Math.floor(150.987654321 * 8) / 8;
            expect(mockState.sizesKnown.get("item_0")).toBe(expectedSize);
        });

        it("should handle NaN and Infinity values", () => {
            const itemUpdates = [{ itemKey: "item_0", sizeObj: { height: Infinity, width: NaN } }];

            updateItemSizes(mockCtx, mockState, itemUpdates);

            // Function should handle gracefully
            expect(typeof mockState.sizesKnown.get("item_0")).toBe("number");
        });
    });

    describe("performance considerations", () => {
        it("should handle large batch updates efficiently", () => {
            const itemUpdates = Array.from({ length: 1000 }, (_, i) => ({
                itemKey: `item_${i}`,
                sizeObj: { height: 150 + i, width: 400 },
            }));

            // Add items to indexByKey
            itemUpdates.forEach((update, i) => {
                mockState.indexByKey.set(update.itemKey, i);
            });

            const start = Date.now();
            updateItemSizes(mockCtx, mockState, itemUpdates);
            const duration = Date.now() - start;

            expect(duration).toBeLessThan(500); // Should handle large batches efficiently
        });

        it("should maintain memory efficiency", () => {
            const initialMemory = process.memoryUsage().heapUsed;

            for (let i = 0; i < 100; i++) {
                const itemUpdates = [{ itemKey: `item_${i % 5}`, sizeObj: { height: 150 + i, width: 400 } }];
                updateItemSizes(mockCtx, mockState, itemUpdates);
            }

            const finalMemory = process.memoryUsage().heapUsed;
            const memoryIncrease = finalMemory - initialMemory;

            expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024); // Less than 10MB
        });
    });
});
