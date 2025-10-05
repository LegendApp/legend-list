import { beforeEach, describe, expect, it } from "bun:test";
import "../setup"; // Import global test setup

import { updateItemSize, updateOneItemSize } from "../../src/core/updateItemSize";
import type { StateContext } from "../../src/state/state";
import type { InternalState } from "../../src/types";
import { createMockContext } from "../__mocks__/createMockContext";
import { createMockState } from "../__mocks__/createMockState";

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

        mockState = createMockState({
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
            timeoutSetPaddingTop: undefined,
            timeoutSizeMessage: undefined,
            totalSize: 0,
        });
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
            mockState.props.data = null as any;

            const diff = updateOneItemSize(mockState, "item_0", { height: 150, width: 400 });

            expect(diff).toBe(0);
        });
    });

    describe("updateItemSize", () => {
        it("should update known sizes and total size tracking", () => {
            const prevTotal = mockState.totalSize;
            updateItemSize(mockCtx, mockState, "item_0", { height: 150, width: 400 });

            expect(mockState.sizesKnown.get("item_0")).toBe(150);
            expect(onItemSizeChangedCalls.length).toBe(1);
            expect(mockState.totalSize).not.toBe(prevTotal);
            expect(mockCtx.values.get("totalSize")).toBe(mockState.totalSize);
        });

        it("should respect early return when data is missing", () => {
            mockState.props.data = null as any;

            expect(() => updateItemSize(mockCtx, mockState, "item_0", { height: 150, width: 400 })).not.toThrow();
            expect(mockState.sizesKnown.size).toBe(0);
            expect(onItemSizeChangedCalls.length).toBe(0);
        });

        it("should update other axis size when requested", () => {
            mockState.needsOtherAxisSize = true;
            mockCtx.values.set("otherAxisSize", 400);

            updateItemSize(mockCtx, mockState, "item_0", { height: 150, width: 420 });

            expect(mockCtx.values.get("otherAxisSize")).toBe(420);
        });
    });
});
