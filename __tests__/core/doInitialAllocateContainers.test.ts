import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import "../setup"; // Import global test setup

import * as calculateItemsInViewModule from "../../src/core/calculateItemsInView";
import { doInitialAllocateContainers } from "../../src/core/doInitialAllocateContainers";
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

function createMockState(overrides: Partial<InternalState> = {}): InternalState {
    return {
        hasScrolled: false,
        idCache: new Map(),
        idsInView: [],
        ignoreScrollFromMVCP: undefined,
        ignoreScrollFromMVCPTimeout: undefined,
        indexByKey: new Map(),
        isScrolling: false,
        lastBatchingAction: 0,
        positions: new Map(),
        props: {
            data: [
                { id: 0, text: "Item 0" },
                { id: 1, text: "Item 1" },
                { id: 2, text: "Item 2" },
                { id: 3, text: "Item 3" },
                { id: 4, text: "Item 4" },
            ],
            estimatedItemSize: 100,
            initialContainerPoolRatio: 0.8,
            keyExtractor: (item: any) => `item-${item.id}`,
            numColumns: 1,
            scrollBuffer: 50,
        },
        scroll: 0,
        scrollAdjustHandler: {
            requestAdjust: () => {},
        },
        scrollForNextCalculateItemsInView: undefined,
        scrollHistory: [],
        scrollingTo: undefined,
        scrollLength: 500,
        scrollPending: 0,
        scrollPrev: 0,
        scrollPrevTime: 0,
        scrollTime: 0,
        sizes: new Map(),
        sizesCache: new Map(),
        timeouts: new Set(),
        ...overrides,
    } as InternalState;
}

describe("doInitialAllocateContainers", () => {
    let mockCtx: StateContext;
    let mockState: InternalState;
    let calculateItemsInViewSpy: any;
    let originalRAF: any;
    let rafCallbacks: (() => void)[];
    beforeEach(() => {
        mockCtx = createMockContext();
        mockState = createMockState();

        // Spy on calculateItemsInView
        calculateItemsInViewSpy = spyOn(calculateItemsInViewModule, "calculateItemsInView");

        // Mock requestAnimationFrame
        originalRAF = globalThis.requestAnimationFrame;
        rafCallbacks = [];
        globalThis.requestAnimationFrame = (callback: () => void) => {
            rafCallbacks.push(callback);
            return rafCallbacks.length;
        };
    });

    afterEach(() => {
        // Restore original functions
        globalThis.requestAnimationFrame = originalRAF;
    });

    describe("basic functionality", () => {
        it("should allocate containers when conditions are met", () => {
            const result = doInitialAllocateContainers(mockCtx, mockState);

            expect(result).toBe(true);
            expect(mockCtx.values.get("numContainers")).toBeGreaterThan(0);
        });

        it("should return undefined when scrollLength is 0", () => {
            mockState.scrollLength = 0;

            const result = doInitialAllocateContainers(mockCtx, mockState);

            expect(result).toBeUndefined();
            expect(mockCtx.values.get("numContainers")).toBeUndefined();
        });

        it("should return undefined when data is empty", () => {
            mockState.props.data = [];

            const result = doInitialAllocateContainers(mockCtx, mockState);

            expect(result).toBeUndefined();
            expect(mockCtx.values.get("numContainers")).toBeUndefined();
        });

        it("should return undefined when containers already allocated", () => {
            mockCtx.values.set("numContainers", 10);

            const result = doInitialAllocateContainers(mockCtx, mockState);

            expect(result).toBeUndefined();
        });

        it("should allocate when numContainers is 0 (falsy)", () => {
            mockCtx.values.set("numContainers", 0);

            const result = doInitialAllocateContainers(mockCtx, mockState);

            // 0 is falsy, so it should trigger allocation
            expect(result).toBe(true);
            expect(mockCtx.values.get("numContainers")).toBeGreaterThan(0);
        });
    });

    describe("container calculation", () => {
        it("should calculate correct number of containers with estimatedItemSize", () => {
            mockState.props.estimatedItemSize = 100;
            mockState.scrollLength = 500;
            mockState.props.scrollBuffer = 50;
            mockState.props.numColumns = 1;

            doInitialAllocateContainers(mockCtx, mockState);

            // Expected: ((500 + 50*2) / 100) * 1 * 1.5 = 9 containers
            expect(mockCtx.values.get("numContainers")).toBe(9);
        });

        it("should use getEstimatedItemSize when available", () => {
            const getEstimatedItemSize = (index: number, item: any) => 150;
            mockState.props.getEstimatedItemSize = getEstimatedItemSize;
            mockState.scrollLength = 600;
            mockState.props.scrollBuffer = 100;

            doInitialAllocateContainers(mockCtx, mockState);

            // Expected: ((600 + 100*2) / 150) * 1 * 1.5 = Math.ceil(8) = 8 containers
            expect(mockCtx.values.get("numContainers")).toBe(8);
        });

        it("should handle multi-column layouts", () => {
            mockState.props.numColumns = 2;
            mockState.props.estimatedItemSize = 100;
            mockState.scrollLength = 500;
            mockState.props.scrollBuffer = 50;

            doInitialAllocateContainers(mockCtx, mockState);

            // Expected: ((500 + 50*2) / 100) * 2 * 1.5 = 18 containers
            expect(mockCtx.values.get("numContainers")).toBe(18);
        });

        it("should handle fractional container calculations", () => {
            mockState.props.estimatedItemSize = 75;
            mockState.scrollLength = 500;
            mockState.props.scrollBuffer = 25;

            doInitialAllocateContainers(mockCtx, mockState);

            // Expected: ((500 + 25*2) / 75) * 1 * 1.5 = 11 containers (ceil)
            expect(mockCtx.values.get("numContainers")).toBe(11);
        });

        it("should apply Extra multiplier correctly", () => {
            mockState.props.estimatedItemSize = 100;
            mockState.scrollLength = 400;
            mockState.props.scrollBuffer = 0;

            doInitialAllocateContainers(mockCtx, mockState);

            // Expected: (400 / 100) * 1 * 1.5 = 6 containers
            expect(mockCtx.values.get("numContainers")).toBe(6);
        });
    });

    describe("container initialization", () => {
        it("should set container positions to out of view", () => {
            doInitialAllocateContainers(mockCtx, mockState);

            const numContainers = mockCtx.values.get("numContainers");
            for (let i = 0; i < numContainers; i++) {
                expect(mockCtx.values.get(`containerPosition${i}`)).toBe(-10000000); // POSITION_OUT_OF_VIEW
            }
        });

        it("should set container columns to -1", () => {
            doInitialAllocateContainers(mockCtx, mockState);

            const numContainers = mockCtx.values.get("numContainers");
            for (let i = 0; i < numContainers; i++) {
                expect(mockCtx.values.get(`containerColumn${i}`)).toBe(-1);
            }
        });

        it("should set numContainersPooled correctly", () => {
            mockState.props.initialContainerPoolRatio = 0.8;

            doInitialAllocateContainers(mockCtx, mockState);

            const numContainers = mockCtx.values.get("numContainers");
            const numPooled = mockCtx.values.get("numContainersPooled");

            expect(numPooled).toBe(numContainers * 0.8);
        });

        it("should handle different pooling ratios", () => {
            mockState.props.initialContainerPoolRatio = 0.5;

            doInitialAllocateContainers(mockCtx, mockState);

            const numContainers = mockCtx.values.get("numContainers");
            const numPooled = mockCtx.values.get("numContainersPooled");

            expect(numPooled).toBe(numContainers * 0.5);
        });

        it("should handle zero pooling ratio", () => {
            mockState.props.initialContainerPoolRatio = 0;

            doInitialAllocateContainers(mockCtx, mockState);

            const numContainers = mockCtx.values.get("numContainers");
            const numPooled = mockCtx.values.get("numContainersPooled");

            expect(numPooled).toBe(0);
        });
    });

    describe("calculateItemsInView integration", () => {
        it("should handle different initialScroll configurations", () => {
            // Test with no initialScroll
            mockState.props.initialScroll = undefined;
            doInitialAllocateContainers(mockCtx, mockState);
            expect(mockCtx.values.get("numContainers")).toBeGreaterThan(0);

            // Reset for next test
            mockCtx.values.delete("numContainers");

            // Test with initialScroll set
            mockState.props.initialScroll = 100;
            doInitialAllocateContainers(mockCtx, mockState);
            expect(mockCtx.values.get("numContainers")).toBeGreaterThan(0);

            // Note: calculateItemsInView behavior depends on IsNewArchitecture
            // which we cannot easily mock, so we just verify allocation succeeds
        });

        it("should handle initialScroll = 0 as falsy", () => {
            mockState.props.initialScroll = 0;

            doInitialAllocateContainers(mockCtx, mockState);

            expect(mockCtx.values.get("numContainers")).toBeGreaterThan(0);
        });
    });

    describe("edge cases and error handling", () => {
        it("should handle very small estimated item sizes", () => {
            mockState.props.estimatedItemSize = 1;
            mockState.scrollLength = 1000;

            doInitialAllocateContainers(mockCtx, mockState);

            const numContainers = mockCtx.values.get("numContainers");
            expect(numContainers).toBeGreaterThan(0);
            expect(numContainers).toBeLessThan(10000); // Reasonable upper bound
        });

        it("should handle very large estimated item sizes", () => {
            mockState.props.estimatedItemSize = 10000;
            mockState.scrollLength = 500;

            doInitialAllocateContainers(mockCtx, mockState);

            const numContainers = mockCtx.values.get("numContainers");
            expect(numContainers).toBe(1); // Should still allocate at least 1
        });

        it("should handle zero scroll buffer", () => {
            mockState.props.scrollBuffer = 0;

            expect(() => {
                doInitialAllocateContainers(mockCtx, mockState);
            }).not.toThrow();

            expect(mockCtx.values.get("numContainers")).toBeGreaterThan(0);
        });

        it("should handle undefined estimated item size with getEstimatedItemSize", () => {
            mockState.props.estimatedItemSize = undefined as any;
            mockState.props.getEstimatedItemSize = () => 120;

            doInitialAllocateContainers(mockCtx, mockState);

            expect(mockCtx.values.get("numContainers")).toBeGreaterThan(0);
        });

        it("should handle both undefined estimated item sizes", () => {
            mockState.props.estimatedItemSize = undefined as any;
            mockState.props.getEstimatedItemSize = undefined;

            expect(() => {
                doInitialAllocateContainers(mockCtx, mockState);
            }).not.toThrow();

            // Should handle gracefully - may or may not allocate containers
        });

        it("should handle negative scroll length", () => {
            mockState.scrollLength = -100;

            const result = doInitialAllocateContainers(mockCtx, mockState);

            expect(result).toBeUndefined();
        });

        it("should handle zero scroll length", () => {
            mockState.scrollLength = 0;

            const result = doInitialAllocateContainers(mockCtx, mockState);

            expect(result).toBeUndefined();
        });

        it("should handle very large number of columns", () => {
            mockState.props.numColumns = 100;
            mockState.props.estimatedItemSize = 50;
            mockState.scrollLength = 500;

            doInitialAllocateContainers(mockCtx, mockState);

            const numContainers = mockCtx.values.get("numContainers");
            expect(numContainers).toBeGreaterThan(0);
        });
    });

    describe("performance considerations", () => {
        it("should handle large datasets efficiently", () => {
            const largeData = Array.from({ length: 10000 }, (_, i) => ({ id: i, text: `Item ${i}` }));
            mockState.props.data = largeData;

            const start = performance.now();
            doInitialAllocateContainers(mockCtx, mockState);
            const duration = performance.now() - start;

            expect(duration).toBeLessThan(10); // Should be fast
            expect(mockCtx.values.get("numContainers")).toBeGreaterThan(0);
        });

        it("should not over-allocate containers for normal use cases", () => {
            mockState.scrollLength = 1000;
            mockState.props.estimatedItemSize = 50;
            mockState.props.scrollBuffer = 100;

            doInitialAllocateContainers(mockCtx, mockState);

            const numContainers = mockCtx.values.get("numContainers");
            // Should be reasonable - not more than 100 containers for this case
            expect(numContainers).toBeLessThan(100);
            expect(numContainers).toBeGreaterThan(10);
        });

        it("should handle repeated calls gracefully", () => {
            // First call should allocate
            const result1 = doInitialAllocateContainers(mockCtx, mockState);
            expect(result1).toBe(true);

            // Subsequent calls should not re-allocate
            const result2 = doInitialAllocateContainers(mockCtx, mockState);
            expect(result2).toBeUndefined();

            const result3 = doInitialAllocateContainers(mockCtx, mockState);
            expect(result3).toBeUndefined();
        });
    });

    describe("integration scenarios", () => {
        it("should work with dynamic estimated item size function", () => {
            let callCount = 0;
            mockState.props.getEstimatedItemSize = (index: number, item: any) => {
                callCount++;
                return item.id === 0 ? 200 : 100; // First item is larger
            };

            doInitialAllocateContainers(mockCtx, mockState);

            expect(callCount).toBe(1); // Should call once with first item
            expect(mockCtx.values.get("numContainers")).toBeGreaterThan(0);
        });

        it("should handle RAF scheduling for initialScroll", () => {
            mockState.props.initialScroll = 500;

            doInitialAllocateContainers(mockCtx, mockState);

            expect(mockCtx.values.get("numContainers")).toBeGreaterThan(0);

            // RAF behavior depends on IsNewArchitecture
            // We verify that the function completes without errors
        });

        it("should properly initialize containers", () => {
            doInitialAllocateContainers(mockCtx, mockState);

            const numContainers = mockCtx.values.get("numContainers");
            expect(numContainers).toBeGreaterThan(0);

            // Verify all containers are properly initialized
            for (let i = 0; i < numContainers; i++) {
                expect(mockCtx.values.get(`containerPosition${i}`)).toBe(-10000000);
                expect(mockCtx.values.get(`containerColumn${i}`)).toBe(-1);
            }
        });
    });

    describe("boundary conditions", () => {
        it("should handle minimum viable configuration", () => {
            mockState.scrollLength = 1;
            mockState.props.estimatedItemSize = 1;
            mockState.props.scrollBuffer = 0;
            mockState.props.numColumns = 1;
            mockState.props.data = [{ id: 0 }];

            doInitialAllocateContainers(mockCtx, mockState);

            expect(mockCtx.values.get("numContainers")).toBeGreaterThan(0);
        });

        it("should handle maximum reasonable configuration", () => {
            mockState.scrollLength = 10000;
            mockState.props.estimatedItemSize = 1000;
            mockState.props.scrollBuffer = 1000;
            mockState.props.numColumns = 5;

            doInitialAllocateContainers(mockCtx, mockState);

            const numContainers = mockCtx.values.get("numContainers");
            expect(numContainers).toBeGreaterThan(0);
            expect(numContainers).toBeLessThan(1000); // Reasonable upper bound
        });

        it("should handle floating point calculations correctly", () => {
            mockState.scrollLength = 333;
            mockState.props.estimatedItemSize = 77;
            mockState.props.scrollBuffer = 33;

            doInitialAllocateContainers(mockCtx, mockState);

            const numContainers = mockCtx.values.get("numContainers");
            expect(Number.isInteger(numContainers)).toBe(true);
            expect(numContainers).toBeGreaterThan(0);
        });
    });
});
