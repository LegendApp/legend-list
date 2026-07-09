import { describe, expect, it, mock } from "bun:test";
import "../setup";

import { applyDataSourceMutationBatches, transformDataSourceIndex } from "../../src/core/DataSourceMutationCoordinator";
import { DataSourceAdapter } from "../../src/core/IndexedData";
import { LayoutStoreRuntime } from "../../src/core/LayoutStoreRuntime";
import { reconcileLayoutStoreDataSourceMutation } from "../../src/core/layoutStoreLifecycle";
import { PrefixLayoutStore } from "../../src/core/PrefixLayoutStore";
import type { DataSourceMutationBatch, LegendListDataSource } from "../../src/types.base";
import { createMockContext } from "../__mocks__/createMockContext";

function createSource(keys: string[], getKey = (index: number) => keys[index]!) {
    const source: LegendListDataSource<{ id: string }> = {
        getItem: (index) => (keys[index] ? { id: keys[index] } : undefined),
        getKey,
        getLength: () => keys.length,
        getRevision: () => 1,
        subscribe: () => () => {},
    };
    return source;
}

function createBatch(
    previousLength: number,
    length: number,
    operations: DataSourceMutationBatch["operations"],
): DataSourceMutationBatch {
    return { length, operations, previousLength, previousRevision: 0, revision: 1 };
}

describe("DataSourceMutationCoordinator", () => {
    it("transforms sparse identity, mounted renderers, anchors, viewability, and layout without scanning the source", () => {
        const keys = ["x", "a", "b", "c", "d", "e"];
        const getKey = mock((index: number) => keys[index]!);
        const source = createSource(keys, getKey);
        const store = new PrefixLayoutStore(5, 10);
        store.replaceKnownSizeEntries([
            { index: 2, size: 30, type: "measured" },
            { index: 4, size: 50, type: "measured" },
        ]);
        const ctx = createMockContext(
            {
                activeStickyIndex: 2,
                containerDataVersion1: 0,
                containerItemData1: { id: "c" },
            },
            {
                containerItemKeys: new Map([["c", 1]]),
                dataSourcePreviousLength: 5,
                endBuffered: 4,
                endNoBuffer: 4,
                firstFullyOnScreenIndex: 2,
                idCache: Object.assign([], { 0: "a", 2: "c", 4: "e" }),
                idsInView: ["c"],
                indexByKey: new Map([
                    ["a", 0],
                    ["c", 2],
                    ["e", 4],
                ]),
                layoutStoreRuntime: new LayoutStoreRuntime(store, 10),
                props: { dataSource: source },
                scrollingTo: { index: 4, offset: 40 },
                scrollTargetPinnedRange: { end: 4, start: 4 },
                sizes: new Map([
                    ["c", 30],
                    ["e", 50],
                ]),
                sizesKnown: new Map([
                    ["c", 30],
                    ["e", 50],
                ]),
                startBuffered: 2,
                startNoBuffer: 2,
            },
        );
        ctx.state.indexedData = new DataSourceAdapter(source);
        ctx.mapViewabilityConfigStates.set("default", {
            end: 2,
            endBuffered: 2,
            previousEnd: 2,
            previousStart: 2,
            start: 2,
            startBuffered: 2,
            viewableItems: [{ containerId: 1, index: 2, isViewable: true, item: { id: "c" }, key: "c" }],
        });

        const result = applyDataSourceMutationBatches(ctx, source, [
            createBatch(5, 6, [{ deleteCount: 0, index: 0, insertCount: 1, type: "splice" }]),
        ]);

        expect(result).toEqual({ applied: true, materializedCount: 3 });
        expect(getKey).toHaveBeenCalledTimes(3);
        expect(ctx.state.indexByKey).toEqual(
            new Map([
                ["a", 1],
                ["c", 3],
                ["e", 5],
            ]),
        );
        expect(ctx.state.idCache[3]).toBe("c");
        expect(ctx.state.dataSourceAnchorPositions?.get("c")).toBe(20);
        expect(ctx.values.get("containerDataVersion1")).toBe(1);
        expect(ctx.values.get("activeStickyIndex")).toBe(3);
        expect(ctx.state.scrollTargetPinnedRange).toEqual({ end: 5, start: 5 });
        expect(ctx.state.scrollingTo?.index).toBe(5);
        expect(ctx.mapViewabilityConfigStates.get("default")?.viewableItems[0]?.index).toBe(3);

        store.resize(6);
        expect(reconcileLayoutStoreDataSourceMutation(ctx)).toBe(true);
        expect(store.getSize(3)).toBe(30);
        expect(store.getSize(5)).toBe(50);
    });

    it("invalidates only requested geometry and releases only removed materialized keys", () => {
        const source = createSource(["a", "c", "d"]);
        const removedPosition = mock(() => {});
        const ctx = createMockContext(
            { containerDataVersion1: 0, containerItemData1: { id: "c" } },
            {
                containerItemKeys: new Map([
                    ["b", 0],
                    ["c", 1],
                ]),
                idCache: Object.assign([], { 1: "b", 2: "c", 3: "d" }),
                indexByKey: new Map([
                    ["b", 1],
                    ["c", 2],
                    ["d", 3],
                ]),
                props: { dataSource: source },
                sizes: new Map([
                    ["b", 20],
                    ["c", 30],
                    ["d", 40],
                ]),
                sizesKnown: new Map([
                    ["b", 20],
                    ["c", 30],
                    ["d", 40],
                ]),
            },
        );
        ctx.positionListeners.set("b", new Set([removedPosition]));

        const result = applyDataSourceMutationBatches(ctx, source, [
            createBatch(4, 3, [
                { deleteCount: 1, index: 1, insertCount: 0, type: "splice" },
                { count: 1, index: 1, layout: "invalidate", type: "update" },
            ]),
        ]);

        expect(result.applied).toBe(true);
        expect(ctx.state.indexByKey).toEqual(
            new Map([
                ["c", 1],
                ["d", 2],
            ]),
        );
        expect(ctx.state.sizesKnown.has("b")).toBe(false);
        expect(ctx.state.sizesKnown.has("c")).toBe(false);
        expect(ctx.state.sizesKnown.get("d")).toBe(40);
        expect(ctx.state.containerItemKeys.has("b")).toBe(false);
        expect(ctx.values.get("containerDataVersion1")).toBe(1);
        expect(removedPosition).toHaveBeenCalledWith(undefined);
    });

    it("rejects changed materialized keys without partially transforming state", () => {
        const source = createSource(["a", "changed"]);
        const idCache = Object.assign([], { 0: "a", 1: "b" });
        const ctx = createMockContext(
            {},
            {
                idCache,
                indexByKey: new Map([
                    ["a", 0],
                    ["b", 1],
                ]),
            },
        );

        const result = applyDataSourceMutationBatches(ctx, source, [
            createBatch(2, 2, [{ count: 1, index: 1, layout: "preserve", type: "update" }]),
        ]);

        expect(result.applied).toBe(false);
        expect(result.resetReason).toContain("materialized key b changed");
        expect(ctx.state.idCache).toBe(idCache);
        expect(ctx.state.indexByKey.get("b")).toBe(1);
    });

    it("uses post-removal move destinations", () => {
        const operations: DataSourceMutationBatch["operations"] = [{ count: 2, from: 2, to: 5, type: "move" }];

        expect([0, 1, 2, 3, 4, 5, 6, 7].map((index) => transformDataSourceIndex(index, operations))).toEqual([
            0, 1, 5, 6, 2, 3, 4, 7,
        ]);
    });
});
