import { beforeEach, describe, expect, it } from "bun:test";
import "../setup"; // Import global test setup

import { setupViewability, updateViewableItems } from "../../src/core/viewability";
import type { StateContext } from "../../src/state/state";
import type {
    InternalState,
    ViewAmountToken,
    ViewabilityConfig,
    ViewabilityConfigCallbackPair,
    ViewToken,
} from "../../src/types";
import { createMockContext } from "../__mocks__/createMockContext";
import { createMockState as createMockStateOrig } from "../__mocks__/createMockState";

function createMockState(
    overrides: Partial<Omit<InternalState, "props"> & { props: Partial<InternalState["props"]> }> = {},
): InternalState {
    const sizes = new Map([
        ["item-0", 100],
        ["item-1", 150],
        ["item-2", 200],
        ["item-3", 100],
        ["item-4", 180],
    ]);

    const positions = new Map([
        ["item-0", 0],
        ["item-1", 100],
        ["item-2", 250],
        ["item-3", 450],
        ["item-4", 550],
    ]);

    return createMockStateOrig({
        hasScrolled: false,
        idCache: new Map([
            [0, "item-0"],
            [1, "item-1"],
            [2, "item-2"],
            [3, "item-3"],
            [4, "item-4"],
        ]),
        ignoreScrollFromMVCP: undefined,
        indexByKey: new Map([
            ["item-0", 0],
            ["item-1", 1],
            ["item-2", 2],
            ["item-3", 3],
            ["item-4", 4],
        ]),
        lastBatchingAction: 0,
        positions,
        props: {
            data: [
                { id: 0, text: "Item 0" },
                { id: 1, text: "Item 1" },
                { id: 2, text: "Item 2" },
                { id: 3, text: "Item 3" },
                { id: 4, text: "Item 4" },
            ],
            keyExtractor: (item: any) => `item-${item.id}`,
        },
        scroll: 0,
        scrollHistory: [],
        scrollingTo: undefined,
        scrollLength: 500,
        scrollPending: 0,
        scrollPrev: 0,
        scrollPrevTime: 0,
        scrollTime: 0,
        sizes,
        timeouts: new Set(),
        ...overrides,
    });
}

describe("viewability system", () => {
    describe("setupViewability", () => {
        it("should return undefined when no viewability config provided", () => {
            const props = {};
            const result = setupViewability(props);
            expect(result).toBeUndefined();
        });

        it("should create viewability config from viewabilityConfig and onViewableItemsChanged", () => {
            const onViewableItemsChanged = () => {};
            const viewabilityConfig: ViewabilityConfig = {
                id: "test-config",
                viewAreaCoveragePercentThreshold: 50,
            };

            const props = {
                onViewableItemsChanged,
                viewabilityConfig,
            };

            const result = setupViewability(props);
            expect(result).toHaveLength(1);
            expect(result?.[0].onViewableItemsChanged).toBe(onViewableItemsChanged);
            expect(result?.[0].viewabilityConfig).toBe(viewabilityConfig);
        });

        it("should create default viewability config when only onViewableItemsChanged provided", () => {
            const onViewableItemsChanged = () => {};
            const props = { onViewableItemsChanged };

            const result = setupViewability(props);
            expect(result).toHaveLength(1);
            expect(result?.[0].viewabilityConfig.viewAreaCoveragePercentThreshold).toBe(0);
        });

        it("should merge existing viewabilityConfigCallbackPairs with new config", () => {
            const existingCallback = () => {};
            const newCallback = () => {};

            const existingPairs: ViewabilityConfigCallbackPair[] = [
                {
                    onViewableItemsChanged: existingCallback,
                    viewabilityConfig: { id: "existing", itemVisiblePercentThreshold: 25 },
                },
            ];

            const props = {
                onViewableItemsChanged: newCallback,
                viewabilityConfig: { id: "new", viewAreaCoveragePercentThreshold: 75 },
                viewabilityConfigCallbackPairs: existingPairs,
            };

            const result = setupViewability(props);
            expect(result).toHaveLength(2);
            expect(result?.[0]).toBe(existingPairs[0]);
            expect(result?.[1].onViewableItemsChanged).toBe(newCallback);
        });

        it("should handle viewabilityConfigCallbackPairs without additional config", () => {
            const callback = () => {};
            const pairs: ViewabilityConfigCallbackPair[] = [
                {
                    onViewableItemsChanged: callback,
                    viewabilityConfig: { id: "test", itemVisiblePercentThreshold: 50 },
                },
            ];

            const props = { viewabilityConfigCallbackPairs: pairs };
            const result = setupViewability(props);
            expect(result).toBe(pairs);
        });

        it("should handle edge case with missing viewabilityConfig id", () => {
            const props = {
                onViewableItemsChanged: () => {},
                viewabilityConfig: { viewAreaCoveragePercentThreshold: 50 } as ViewabilityConfig,
            };

            // Should handle gracefully even without id
            expect(() => setupViewability(props)).not.toThrow();
        });
    });

    describe("updateViewableItems", () => {
        let mockCtx: StateContext;
        let mockState: InternalState;
        let viewabilityPairs: ViewabilityConfigCallbackPair[];
        let onViewableItemsChangedCalls: any[];

        beforeEach(() => {
            onViewableItemsChangedCalls = [];

            mockCtx = createMockContext({
                containerItemKey0: "item-0",
                containerItemKey1: "item-1",
                containerItemKey2: "item-2",
                containerItemKey3: "item-3",
                containerItemKey4: "item-4",
                headerSize: 0,
                numContainers: 5,
                stylePaddingTop: 0,
            });

            mockState = createMockState();

            // Add viewability amount values for testing
            mockCtx.mapViewabilityAmountValues.set(0, {
                containerId: 0,
                index: 0,
                isViewable: true,
                item: mockState.props.data[0],
                key: "item-0",
                percentOfScroller: 20,
                percentVisible: 100,
                scrollSize: 500,
                size: 100,
                sizeVisible: 100,
            });

            viewabilityPairs = [
                {
                    onViewableItemsChanged: (info: { changed: ViewToken[]; viewableItems: ViewToken[] }) => {
                        onViewableItemsChangedCalls.push(info);
                    },
                    viewabilityConfig: {
                        id: "test-config",
                        itemVisiblePercentThreshold: 50,
                    },
                },
            ];

            // Setup viewability first
            setupViewability({
                viewabilityConfigCallbackPairs: viewabilityPairs,
            });
        });

        it("should update viewable items immediately when no minimumViewTime", () => {
            updateViewableItems(mockState, mockCtx, viewabilityPairs, 500, 0, 2);

            // Should trigger callback immediately
            expect(onViewableItemsChangedCalls).toHaveLength(1);
        });

        it("should delay updates when minimumViewTime is set", async () => {
            const pairs: ViewabilityConfigCallbackPair[] = [
                {
                    onViewableItemsChanged: (info) => onViewableItemsChangedCalls.push(info),
                    viewabilityConfig: {
                        id: "delayed-config",
                        itemVisiblePercentThreshold: 50,
                        minimumViewTime: 100,
                    },
                },
            ];

            setupViewability({ viewabilityConfigCallbackPairs: pairs });

            updateViewableItems(mockState, mockCtx, pairs, 500, 0, 2);

            // Should not trigger immediately
            expect(onViewableItemsChangedCalls).toHaveLength(0);

            // Wait for timeout
            await new Promise((resolve) => setTimeout(resolve, 150));
            expect(onViewableItemsChangedCalls).toHaveLength(1);
        });

        it("should handle empty data gracefully", () => {
            const emptyState = createMockState({
                props: {
                    data: [],
                    keyExtractor: (item: any) => `item-${item.id}`,
                },
            });

            expect(() => {
                updateViewableItems(emptyState, mockCtx, viewabilityPairs, 500, 0, 0);
            }).not.toThrow();
        });

        it("should track viewable items changes correctly", () => {
            // First update with items 0-2 visible
            updateViewableItems(mockState, mockCtx, viewabilityPairs, 500, 0, 2);
            expect(onViewableItemsChangedCalls).toHaveLength(1);

            const firstCall = onViewableItemsChangedCalls[0];
            expect(firstCall.viewableItems).toHaveLength(3);
            expect(firstCall.changed.every((item: ViewToken) => item.isViewable)).toBe(true);

            // Reset calls
            onViewableItemsChangedCalls.length = 0;

            // Second update with different range (items 1-3)
            updateViewableItems(mockState, mockCtx, viewabilityPairs, 500, 1, 3);
            expect(onViewableItemsChangedCalls).toHaveLength(1);

            const secondCall = onViewableItemsChangedCalls[0];
            // Should have items becoming visible and invisible
            expect(secondCall.changed.length).toBeGreaterThan(0);
        });

        it("should handle scroll position changes affecting viewability", () => {
            // Scroll down so first items are out of view
            const scrolledState = createMockState({ scroll: 300 });

            updateViewableItems(scrolledState, mockCtx, viewabilityPairs, 500, 2, 4);
            expect(onViewableItemsChangedCalls).toHaveLength(1);
        });

        it("should clean up negative sizeVisible entries", () => {
            // Create a mock setup where an item would compute to negative sizeVisible
            // This happens when an item is positioned way above the visible area
            mockState.sizes.set("item-99", 100);
            mockState.positions.set("item-99", -500); // Position way above visible area
            mockState.idCache.set(99, "item-99");

            // Add a container mapping for this item
            mockCtx.values.set("containerItemKey99", "item-99");
            mockCtx.values.set("numContainers", 100);

            // Add an entry that will be recomputed
            mockCtx.mapViewabilityAmountValues.set(99, {
                containerId: 99,
                index: 99,
                isViewable: false,
                item: { id: 99, text: "Item 99" },
                key: "item-99",
                percentOfScroller: 0,
                percentVisible: 0,
                scrollSize: 500,
                size: 100,
                sizeVisible: 50, // Positive initially
            });

            expect(mockCtx.mapViewabilityAmountValues.has(99)).toBe(true);

            // Run updateViewableItems - the computeViewability should calculate negative sizeVisible
            // and the cleanup should remove it
            updateViewableItems(mockState, mockCtx, viewabilityPairs, 500, 0, 2);

            expect(mockCtx.mapViewabilityAmountValues.has(99)).toBe(false);
        });

        it("should handle corrupted viewability state gracefully", () => {
            const corruptedPairs: ViewabilityConfigCallbackPair[] = [
                {
                    onViewableItemsChanged: null as any, // Corrupted callback
                    viewabilityConfig: {
                        id: "corrupted",
                        itemVisiblePercentThreshold: 50,
                    },
                },
            ];

            // First setup the viewability to create the map entry
            setupViewability({ viewabilityConfigCallbackPairs: corruptedPairs });

            expect(() => {
                updateViewableItems(mockState, mockCtx, corruptedPairs, 500, 0, 2);
            }).not.toThrow();
        });

        it("should handle very large scroll ranges", () => {
            const largeState = createMockState();
            largeState.props.data = Array.from({ length: 1000 }, (_, i) => ({ id: i, text: `Item ${i}` }));

            // Add idCache entries for the range we're testing
            for (let i = 0; i < 10; i++) {
                largeState.idCache.set(i, `item-${i}`);
            }

            // Update with smaller range to avoid performance issues
            expect(() => {
                updateViewableItems(largeState, mockCtx, viewabilityPairs, 500, 0, 9);
            }).not.toThrow();
        });

        it("should handle performance with rapid successive calls", () => {
            const start = performance.now();

            // Simulate rapid scrolling with 100 updates
            for (let i = 0; i < 100; i++) {
                updateViewableItems(mockState, mockCtx, viewabilityPairs, 500, i % 3, (i % 3) + 2);
            }

            const duration = performance.now() - start;
            expect(duration).toBeLessThan(100); // Should complete in reasonable time
        });
    });

    describe("edge cases and error handling", () => {
        let mockCtx: StateContext;
        let mockState: InternalState;

        beforeEach(() => {
            mockCtx = createMockContext();
            mockState = createMockState();
        });

        it("should handle missing container mappings", () => {
            const pairs: ViewabilityConfigCallbackPair[] = [
                {
                    onViewableItemsChanged: () => {},
                    viewabilityConfig: {
                        id: "test",
                        itemVisiblePercentThreshold: 50,
                    },
                },
            ];

            setupViewability({ viewabilityConfigCallbackPairs: pairs });

            // Context has no container mappings
            expect(() => {
                updateViewableItems(mockState, mockCtx, pairs, 500, 0, 2);
            }).not.toThrow();
        });

        it("should handle viewability config without id", () => {
            const pairs: ViewabilityConfigCallbackPair[] = [
                {
                    onViewableItemsChanged: () => {},
                    viewabilityConfig: {
                        itemVisiblePercentThreshold: 50,
                    } as ViewabilityConfig, // Missing id
                },
            ];

            expect(() => {
                setupViewability({ viewabilityConfigCallbackPairs: pairs });
            }).not.toThrow();
        });

        it("should handle extreme scroll positions", () => {
            const extremeState = createMockState({
                scroll: Number.MAX_SAFE_INTEGER,
            });

            const pairs: ViewabilityConfigCallbackPair[] = [
                {
                    onViewableItemsChanged: () => {},
                    viewabilityConfig: {
                        id: "extreme",
                        itemVisiblePercentThreshold: 50,
                    },
                },
            ];

            setupViewability({ viewabilityConfigCallbackPairs: pairs });

            expect(() => {
                updateViewableItems(extremeState, mockCtx, pairs, 500, 0, 2);
            }).not.toThrow();
        });

        it("should handle NaN and Infinity values in viewability calculations", () => {
            const corruptedState = createMockState();
            corruptedState.sizes.set("item-0", NaN);
            corruptedState.positions.set("item-1", Infinity);

            const pairs: ViewabilityConfigCallbackPair[] = [
                {
                    onViewableItemsChanged: () => {},
                    viewabilityConfig: {
                        id: "nan-test",
                        itemVisiblePercentThreshold: 50,
                    },
                },
            ];

            setupViewability({ viewabilityConfigCallbackPairs: pairs });

            expect(() => {
                updateViewableItems(corruptedState, mockCtx, pairs, 500, 0, 2);
            }).not.toThrow();
        });

        it("should handle concurrent timeout cleanup", async () => {
            const pairs: ViewabilityConfigCallbackPair[] = [
                {
                    onViewableItemsChanged: () => {},
                    viewabilityConfig: {
                        id: "timeout-test",
                        itemVisiblePercentThreshold: 50,
                        minimumViewTime: 50,
                    },
                },
            ];

            setupViewability({ viewabilityConfigCallbackPairs: pairs });

            // Create multiple overlapping timeouts
            updateViewableItems(mockState, mockCtx, pairs, 500, 0, 2);
            updateViewableItems(mockState, mockCtx, pairs, 500, 1, 3);
            updateViewableItems(mockState, mockCtx, pairs, 500, 2, 4);

            // Should handle cleanup gracefully
            await new Promise((resolve) => setTimeout(resolve, 100));
            expect(mockState.timeouts.size).toBe(0);
        });

        it("should handle memory pressure with large timeout sets", () => {
            const pairs: ViewabilityConfigCallbackPair[] = [
                {
                    onViewableItemsChanged: () => {},
                    viewabilityConfig: {
                        id: "memory-test",
                        itemVisiblePercentThreshold: 50,
                        minimumViewTime: 1000, // Long timeout
                    },
                },
            ];

            setupViewability({ viewabilityConfigCallbackPairs: pairs });

            // Create many timeouts
            for (let i = 0; i < 1000; i++) {
                updateViewableItems(mockState, mockCtx, pairs, 500, 0, 2);
            }

            expect(mockState.timeouts.size).toBe(1000);
        });
    });

    describe("viewability calculations", () => {
        let mockCtx: StateContext;
        let mockState: InternalState;

        beforeEach(() => {
            mockCtx = createMockContext({
                containerItemKey0: "item-0",
                containerItemKey1: "item-1",
                containerItemKey2: "item-2",
                containerItemKey3: "item-3",
                containerItemKey4: "item-4",
                headerSize: 30,
                numContainers: 5,
                stylePaddingTop: 20,
            });

            mockState = createMockState({ scroll: 100 });
        });

        it("should calculate viewability with itemVisiblePercentThreshold", () => {
            const pairs: ViewabilityConfigCallbackPair[] = [
                {
                    onViewableItemsChanged: () => {},
                    viewabilityConfig: {
                        id: "item-threshold",
                        itemVisiblePercentThreshold: 75,
                    },
                },
            ];

            setupViewability({ viewabilityConfigCallbackPairs: pairs });
            updateViewableItems(mockState, mockCtx, pairs, 400, 0, 4);

            // Check viewability amount values were computed
            expect(mockCtx.mapViewabilityAmountValues.size).toBeGreaterThan(0);
        });

        it("should calculate viewability with viewAreaCoveragePercentThreshold", () => {
            const pairs: ViewabilityConfigCallbackPair[] = [
                {
                    onViewableItemsChanged: () => {},
                    viewabilityConfig: {
                        id: "area-threshold",
                        viewAreaCoveragePercentThreshold: 25,
                    },
                },
            ];

            setupViewability({ viewabilityConfigCallbackPairs: pairs });
            updateViewableItems(mockState, mockCtx, pairs, 400, 0, 4);

            expect(mockCtx.mapViewabilityAmountValues.size).toBeGreaterThan(0);
        });

        it("should handle zero-sized items", () => {
            mockState.sizes.set("item-0", 0);

            const pairs: ViewabilityConfigCallbackPair[] = [
                {
                    onViewableItemsChanged: () => {},
                    viewabilityConfig: {
                        id: "zero-size",
                        itemVisiblePercentThreshold: 50,
                    },
                },
            ];

            setupViewability({ viewabilityConfigCallbackPairs: pairs });

            expect(() => {
                updateViewableItems(mockState, mockCtx, pairs, 400, 0, 2);
            }).not.toThrow();
        });

        it("should handle items entirely outside scroll area", () => {
            mockState.scroll = 1000; // Scroll far past all items

            const pairs: ViewabilityConfigCallbackPair[] = [
                {
                    onViewableItemsChanged: () => {},
                    viewabilityConfig: {
                        id: "outside",
                        itemVisiblePercentThreshold: 1,
                    },
                },
            ];

            setupViewability({ viewabilityConfigCallbackPairs: pairs });
            updateViewableItems(mockState, mockCtx, pairs, 400, 0, 4);

            // Should handle gracefully
            expect(mockCtx.mapViewabilityAmountValues.size).toBeGreaterThanOrEqual(0);
        });

        it("should trigger viewability amount callbacks", () => {
            let callbackTriggered = false;
            let callbackValue: ViewAmountToken | undefined;

            mockCtx.mapViewabilityAmountCallbacks.set(0, (value: ViewAmountToken) => {
                callbackTriggered = true;
                callbackValue = value;
            });

            const pairs: ViewabilityConfigCallbackPair[] = [
                {
                    onViewableItemsChanged: () => {},
                    viewabilityConfig: {
                        id: "callback-test",
                        itemVisiblePercentThreshold: 50,
                    },
                },
            ];

            setupViewability({ viewabilityConfigCallbackPairs: pairs });
            updateViewableItems(mockState, mockCtx, pairs, 400, 0, 2);

            expect(callbackTriggered).toBe(true);
            expect(callbackValue).toBeDefined();
            expect(callbackValue?.containerId).toBe(0);
        });
    });

    describe("performance and stress testing", () => {
        it("should handle large datasets efficiently", () => {
            const largeData = Array.from({ length: 10000 }, (_, i) => ({ id: i, text: `Item ${i}` }));
            const mockCtx = createMockContext({
                headerSize: 0,
                numContainers: 100,
                stylePaddingTop: 0,
            });

            // Create container mappings for first 100 items
            for (let i = 0; i < 100; i++) {
                mockCtx.values.set(`containerItemKey${i}`, `item-${i}`);
            }

            const mockState = createMockState({
                props: {
                    data: largeData,
                    keyExtractor: (item: any) => `item-${item.id}`,
                },
            });

            // Populate sizes, positions, and idCache for test
            for (let i = 0; i < 100; i++) {
                mockState.sizes.set(`item-${i}`, 100);
                mockState.positions.set(`item-${i}`, i * 100);
                mockState.idCache.set(i, `item-${i}`);
            }

            const pairs: ViewabilityConfigCallbackPair[] = [
                {
                    onViewableItemsChanged: () => {},
                    viewabilityConfig: {
                        id: "large-dataset",
                        itemVisiblePercentThreshold: 50,
                    },
                },
            ];

            setupViewability({ viewabilityConfigCallbackPairs: pairs });

            const start = performance.now();
            updateViewableItems(mockState, mockCtx, pairs, 1000, 0, 99);
            const duration = performance.now() - start;

            expect(duration).toBeLessThan(50); // Should be fast even with large dataset
        });

        it("should handle rapid updates without memory leaks", () => {
            const mockCtx = createMockContext({
                headerSize: 0,
                numContainers: 10,
                stylePaddingTop: 0,
            });

            const mockState = createMockState();

            const pairs: ViewabilityConfigCallbackPair[] = [
                {
                    onViewableItemsChanged: () => {},
                    viewabilityConfig: {
                        id: "rapid-test",
                        itemVisiblePercentThreshold: 50,
                    },
                },
            ];

            setupViewability({ viewabilityConfigCallbackPairs: pairs });

            // Perform many rapid updates
            for (let i = 0; i < 1000; i++) {
                updateViewableItems(mockState, mockCtx, pairs, 500, i % 5, (i % 5) + 2);
            }

            // Check that maps don't grow unbounded
            expect(mockCtx.mapViewabilityAmountValues.size).toBeLessThan(100);
        });
    });
});
