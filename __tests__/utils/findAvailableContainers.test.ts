import { beforeEach, describe, expect, it } from "bun:test";
import "../setup"; // Import global test setup

import type { ListenerType, StateContext } from "../../src/state/state";
import type { InternalState } from "../../src/types";
import { findAvailableContainers } from "../../src/utils/findAvailableContainers";

// Create a properly typed mock context
function createMockContext(initialValues: Partial<Record<ListenerType, any>> = {}): StateContext {
    const values = new Map<ListenerType, any>(Object.entries(initialValues) as [ListenerType, any][]);
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

describe("findAvailableContainers", () => {
    let mockState: InternalState;
    let ctx: StateContext;

    beforeEach(() => {
        ctx = createMockContext();
        mockState = {
            indexByKey: new Map(),
            props: {
                stickyIndicesSet: new Set(),
            },
            stickyContainerPool: new Set(),
        } as unknown as InternalState;
    });

    describe("when there are unallocated containers", () => {
        it("should return unallocated containers first", () => {
            // Setup container data via context
            ctx.values.set("numContainers", 5);
            ctx.values.set("containerItemKey0", undefined);
            ctx.values.set("containerItemKey1", undefined);
            ctx.values.set("containerItemKey2", undefined);
            ctx.values.set("containerItemKey3", "item3");
            ctx.values.set("containerItemKey4", "item4");

            const result = findAvailableContainers(ctx, mockState, 2, 0, 10, []);

            expect(result).toEqual([0, 1]);
        });

        it("should use pending removal containers as unallocated", () => {
            ctx.values.set("numContainers", 3);
            ctx.values.set("containerItemKey0", "item0");
            ctx.values.set("containerItemKey1", "item1");
            ctx.values.set("containerItemKey2", "item2");

            const pendingRemoval = [1];
            const result = findAvailableContainers(ctx, mockState, 1, 0, 10, pendingRemoval);

            expect(result).toEqual([1]);
            expect(pendingRemoval).toEqual([]); // Should be modified in place
        });

        it("should leave unused pending removals untouched", () => {
            ctx.values.set("numContainers", 3);
            ctx.values.set("containerItemKey0", "item0");
            ctx.values.set("containerItemKey1", "item1");
            ctx.values.set("containerItemKey2", "item2");

            const pendingRemoval = [1, 2];
            const result = findAvailableContainers(ctx, mockState, 1, 0, 10, pendingRemoval);

            expect(result).toEqual([1]);
            expect(pendingRemoval).toEqual([2]);
        });
    });

    describe("when containers are out of view", () => {
        it("should return containers that are before the buffered range", () => {
            ctx.values.set("numContainers", 3);
            ctx.values.set("containerItemKey0", "item0");
            ctx.values.set("containerItemKey1", "item1");
            ctx.values.set("containerItemKey2", "item15");

            mockState.indexByKey.set("item0", 0);
            mockState.indexByKey.set("item1", 1);
            mockState.indexByKey.set("item15", 15);

            // Buffered range is 5-10, so items 0 and 1 are out of view (before), item15 is out of view (after)
            const result = findAvailableContainers(ctx, mockState, 2, 5, 10, []);

            // Should return containers 0 and 2 (items furthest from buffered range)
            expect(result.sort()).toEqual([0, 2]);
        });

        it("should prioritize containers furthest from the buffered range", () => {
            ctx.values.set("numContainers", 4);
            ctx.values.set("containerItemKey0", "item0"); // distance: 5
            ctx.values.set("containerItemKey1", "item1"); // distance: 4
            ctx.values.set("containerItemKey2", "item15"); // distance: 5
            ctx.values.set("containerItemKey3", "item20"); // distance: 10

            mockState.indexByKey.set("item0", 0);
            mockState.indexByKey.set("item1", 1);
            mockState.indexByKey.set("item15", 15);
            mockState.indexByKey.set("item20", 20);

            // Buffered range is 5-10, need only 2 containers
            const result = findAvailableContainers(ctx, mockState, 2, 5, 10, []);

            // Should return containers with furthest distances (item20: distance 10, then item0 or item15: distance 5)
            expect(result.length).toBe(2);
            expect(result).toContain(3); // item20 (distance 10)
        });
    });

    describe("when creating new containers", () => {
        it("should create new containers when needed", () => {
            ctx.values.set("numContainers", 2);
            ctx.values.set("numContainersPooled", 10); // Prevent warning in __DEV__
            ctx.values.set("containerItemKey0", "item5");
            ctx.values.set("containerItemKey1", "item6");

            mockState.indexByKey.set("item5", 5);
            mockState.indexByKey.set("item6", 6);

            // Buffered range is 4-8, both items are in view, need 3 containers total
            // Since no containers are available from existing pool, should create 3 new ones
            const result = findAvailableContainers(ctx, mockState, 3, 4, 8, []);

            expect(result).toEqual([2, 3, 4]); // Creates new container indices 2, 3, 4
        });
    });

    describe("mixed scenarios", () => {
        it("should combine unallocated, out-of-view, and new containers", () => {
            ctx.values.set("numContainers", 3);
            ctx.values.set("numContainersPooled", 10);
            ctx.values.set("containerItemKey0", undefined); // unallocated
            ctx.values.set("containerItemKey1", "item0"); // out of view (before)
            ctx.values.set("containerItemKey2", "item15"); // out of view (after)

            mockState.indexByKey.set("item0", 0);
            mockState.indexByKey.set("item15", 15);

            const result = findAvailableContainers(ctx, mockState, 5, 5, 10, []);

            // Should get: unallocated (0), out of view (1, 2), new containers (3, 4)
            expect(result).toEqual([0, 1, 2, 3, 4]);
        });
    });

    describe("edge cases", () => {
        it("should handle empty container pool", () => {
            ctx.values.set("numContainers", 0);
            ctx.values.set("numContainersPooled", 10);

            const result = findAvailableContainers(ctx, mockState, 2, 0, 10, []);

            expect(result).toEqual([0, 1]);
        });

        it("should handle zero containers needed", () => {
            ctx.values.set("numContainers", 5);
            ctx.values.set("containerItemKey0", undefined);

            const result = findAvailableContainers(ctx, mockState, 0, 0, 10, []);

            // The real function doesn't allocate when numNeeded=0
            expect(result).toEqual([]);
        });

        it("should handle invalid buffered range (start > end)", () => {
            ctx.values.set("numContainers", 1);
            ctx.values.set("containerItemKey0", "item5");

            mockState.indexByKey.set("item5", 5);

            // Invalid range: start > end
            const result = findAvailableContainers(ctx, mockState, 1, 10, 5, []);

            // Should still work, treating all containers as out of view
            expect(result).toEqual([0]);
        });

        it("should handle large numNeeded efficiently", () => {
            ctx.values.set("numContainers", 2);
            ctx.values.set("numContainersPooled", 2000);

            const start = Date.now();
            const result = findAvailableContainers(ctx, mockState, 1000, 0, 10, []);
            const duration = Date.now() - start;

            // Should create many new containers efficiently
            expect(result.length).toBe(1000);
            expect(result[0]).toBe(0);
            expect(result[1]).toBe(1);
            expect(result[999]).toBe(999);
            expect(duration).toBeLessThan(100); // Should complete quickly
        });
    });

    describe("catastrophic failure scenarios", () => {
        it("should handle inconsistent indexByKey data", () => {
            ctx.values.set("numContainers", 2);
            ctx.values.set("numContainersPooled", 10);
            ctx.values.set("containerItemKey0", "item0");
            ctx.values.set("containerItemKey1", "item1");

            // indexByKey has keys that don't exist in containerData
            mockState.indexByKey.set("item0", 15); // Put item0 out of view (beyond range 0-8)
            mockState.indexByKey.set("nonexistent", 10);
            // Missing item1 in indexByKey

            const result = findAvailableContainers(ctx, mockState, 2, 0, 8, []);

            // Container 0 is now out of view, container 1 has no indexByKey entry so is skipped
            // Function should return out of view container 0 + new container 2
            expect(result.length).toBe(2);
            expect(result).toEqual([0, 2]);
        });

        it("should handle corrupted pendingRemoval with duplicates", () => {
            ctx.values.set("numContainers", 2);
            ctx.values.set("containerItemKey0", "item0");
            ctx.values.set("containerItemKey1", "item1");

            const pendingRemoval = [0, 0, 1, 1, 0]; // duplicates
            const result = findAvailableContainers(ctx, mockState, 2, 0, 10, pendingRemoval);

            expect(result).toEqual([0, 1]);
            expect(pendingRemoval).toEqual([]);
        });

        it("should handle missing container keys gracefully", () => {
            ctx.values.set("numContainers", 3);
            // Don't set containerItemKey values - they'll be undefined

            const result = findAvailableContainers(ctx, mockState, 2, 0, 10, []);

            // Should treat all as unallocated and return first 2
            expect(result).toEqual([0, 1]);
        });

        it("should handle extreme distance values", () => {
            ctx.values.set("numContainers", 1);
            ctx.values.set("containerItemKey0", "item0");

            mockState.indexByKey.set("item0", Number.MAX_SAFE_INTEGER);

            const result = findAvailableContainers(ctx, mockState, 1, 0, 10, []);

            // Should handle extremely large distance without overflow
            expect(result).toEqual([0]);
        });
    });

    describe("performance benchmarks", () => {
        it("should handle large container pools efficiently", () => {
            const numContainers = 1000;
            ctx.values.set("numContainers", numContainers);

            // Make some containers allocated and out of view
            for (let i = 0; i < 100; i++) {
                ctx.values.set(`containerItemKey${i}`, `item${i}`);
                mockState.indexByKey.set(`item${i}`, i + 1000); // Far out of view
            }

            const start = Date.now();
            const result = findAvailableContainers(ctx, mockState, 50, 0, 10, []);
            const duration = Date.now() - start;

            // Should return 50 indices, starting with unallocated containers
            expect(result.length).toBe(50);
            expect(result[0]).toBe(100); // First unallocated container
            expect(result[49]).toBe(149);
            expect(duration).toBeLessThan(50); // Should complete quickly
        });

        it("should prioritize by distance correctly with many containers", () => {
            ctx.values.set("numContainers", 100);

            // Create containers with varying distances
            for (let i = 0; i < 100; i++) {
                ctx.values.set(`containerItemKey${i}`, `item${i}`);
                mockState.indexByKey.set(`item${i}`, i * 10); // Distances: 0, 10, 20, ...
            }

            const result = findAvailableContainers(ctx, mockState, 5, 500, 510, []);

            // Should pick containers furthest from range 500-510
            expect(result.length).toBe(5);
            // The furthest containers should be at indices with largest distances
            expect(
                result.some((idx) => {
                    const itemKey = ctx.values.get(`containerItemKey${idx}`);
                    const itemIndex = mockState.indexByKey.get(itemKey!);
                    return itemIndex! >= 900; // Very far from 500-510 range
                }),
            ).toBe(true);
        });
    });
});
