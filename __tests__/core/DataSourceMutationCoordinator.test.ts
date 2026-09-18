import { describe, expect, it, mock, spyOn } from "bun:test";
import "../setup";

import { applyDataSourceMutationBatches, transformDataSourceIndex } from "../../src/core/DataSourceMutationCoordinator";
import { DataSourceAdapter } from "../../src/core/IndexedData";
import { LayoutStoreRuntime } from "../../src/core/LayoutStoreRuntime";
import { PrefixLayoutStore } from "../../src/core/PrefixLayoutStore";
import { RowLayoutStore } from "../../src/core/RowLayoutStore";
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

        expect(store.length).toBe(6);
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

it("validates only affected materialized keys for update-only batches", () => {
    const getKey = mock((i: number) => `k${i}`);
    const source = { ...createSource([]), getItem: (i: number) => ({ id: `k${i}` }), getKey, getLength: () => 1000000 };
    const ctx = createMockContext({}, { props: { dataSource: source } });
    for (let i = 0; i < 10000; i++) {
        ctx.state.idCache[i] = `k${i}`;
        ctx.state.indexByKey.set(`k${i}`, i);
    }
    const result = applyDataSourceMutationBatches(ctx, source, [
        createBatch(1000000, 1000000, [
            { count: 1, index: 12, layout: "preserve", type: "update" },
            { count: 2, index: 13, layout: "invalidate", type: "update" },
        ]),
    ]);
    expect(result).toEqual({ applied: true, materializedCount: 10000 });
    expect(getKey.mock.calls.map(([index]) => index)).toEqual([12, 13, 14]);
    expect(ctx.state.indexByKey.get("k9999")).toBe(9999);
    expect(ctx.state.idCache[9999]).toBe("k9999");
});

it("preserves caches when an update changes an affected key", () => {
    const source = createSource(["changed", "b"]);
    const ctx = createMockContext(
        {},
        {
            idCache: ["a", "b"],
            indexByKey: new Map([
                ["a", 0],
                ["b", 1],
            ]),
            props: { dataSource: source },
        },
    );
    const result = applyDataSourceMutationBatches(ctx, source, [
        createBatch(2, 2, [{ count: 1, index: 0, layout: "invalidate", type: "update" }]),
    ]);
    expect(result.applied).toBe(false);
    expect(result.resetReason).toContain("changed at index 0");
    expect(ctx.state.idCache).toEqual(["a", "b"]);
    expect(ctx.state.indexByKey.get("a")).toBe(0);
});

it("validates inverse-only cached keys through full reconciliation", () => {
    const source = createSource(["changed"]);
    const ctx = createMockContext({}, { idCache: [], indexByKey: new Map([["a", 0]]), props: { dataSource: source } });
    expect(
        applyDataSourceMutationBatches(ctx, source, [
            createBatch(1, 1, [{ count: 1, index: 0, layout: "preserve", type: "update" }]),
        ]).applied,
    ).toBe(false);
});

it("invalidates fixed-size metadata for an in-place item update before publishing the new version", async () => {
    const { resolveContainerItemMetadata } = await import("../../src/core/containerItemMetadata");
    const item = { id: "a", size: 40 };
    const source = { ...createSource(["a"]), getItem: () => item };
    const ctx = createMockContext(
        { containerItemData0: item, containerItemKey0: "a" },
        {
            containerItemKeys: new Map([["a", 0]]),
            idCache: ["a"],
            indexByKey: new Map([["a", 0]]),
            props: { dataSource: source, getFixedItemSize: (value: typeof item) => value.size },
        },
    );
    expect(resolveContainerItemMetadata(ctx.state, 0, 0, item).fixedItemSize).toBe(40);
    item.size = 90;
    applyDataSourceMutationBatches(ctx, source, [
        createBatch(1, 1, [{ count: 1, index: 0, layout: "invalidate", type: "update" }]),
    ]);
    expect(ctx.values.get("containerDataVersion0")).toBe(1);
    expect(ctx.values.get("containerItemIndex0")).toBe(0);
    expect(resolveContainerItemMetadata(ctx.state, 0, 0, item).fixedItemSize).toBe(90);
});

it("applies large update-only batches with overlapping preserve and invalidate ranges once per mounted item", () => {
    const items = Array.from({ length: 5000 }, (_, index) => ({ id: `k${index}` }));
    const getKey = mock((index: number) => items[index].id);
    const source = {
        ...createSource(
            items.map((item) => item.id),
            getKey,
        ),
        getItem: (index: number) => items[index],
    };
    const store = new PrefixLayoutStore(items.length, 10);
    store.setMeasuredSize(20, 50);
    store.setMeasuredSize(4999, 30);
    const ctx = createMockContext(
        { containerItemData0: items[20], containerItemKey0: "k20" },
        {
            containerItemKeys: new Map([["k20", 0]]),
            idCache: items.map((item) => item.id),
            indexByKey: new Map(items.map((item, index) => [item.id, index])),
            layoutStoreRuntime: new LayoutStoreRuntime(store, 10),
            props: { dataSource: source },
            sizesKnown: new Map([
                ["k20", 50],
                ["k4999", 30],
            ]),
        },
    );
    const operations: DataSourceMutationBatch["operations"] = Array.from({ length: 2000 }, (_, index) => ({
        count: 1,
        index,
        layout: index === 20 ? "invalidate" : "preserve",
        type: "update",
    }));
    operations.push({ count: 2, index: 19, layout: "preserve", type: "update" });
    const result = applyDataSourceMutationBatches(ctx, source, [createBatch(items.length, items.length, operations)]);
    expect(result).toEqual({ applied: true, materializedCount: items.length });
    expect(getKey).toHaveBeenCalledTimes(2000);
    expect(store.getSize(20)).toBe(10);
    expect(ctx.state.sizesKnown.has("k20")).toBe(false);
    expect(store.getSize(4999)).toBe(30);
    expect(ctx.values.get("containerDataVersion0")).toBe(1);
    expect(ctx.state.containerItemGenerations[0]).toBe(1);
    expect(ctx.state.idCache[4999]).toBe("k4999");
});

describe("mutation boundaries and event reconciliation", () => {
    it("keeps identity and geometry untouched when key validation throws or a reset is requested", () => {
        for (const failure of ["throw", "reset", "duplicate"] as const) {
            const store = new PrefixLayoutStore(2, 10);
            store.setMeasuredSize(0, 35);
            const keys = failure === "duplicate" ? ["a", "a"] : ["a", "b"];
            const source = createSource(keys, (index) => {
                if (failure === "throw") throw new Error("unavailable key");
                return keys[index];
            });
            const ctx = createMockContext(
                {},
                {
                    idCache: [...keys],
                    indexByKey: new Map(keys.map((key, index) => [key, index])),
                    layoutStoreRuntime: new LayoutStoreRuntime(store, 10),
                    props: { dataSource: source },
                },
            );
            const before = [...ctx.state.indexByKey];
            const result = applyDataSourceMutationBatches(ctx, source, [
                createBatch(2, 2, [
                    failure === "reset" ? { type: "reset" } : { count: 0, from: 0, to: 0, type: "move" },
                ]),
            ]);
            expect(result.applied).toBe(false);
            expect(result.resetReason).toContain(
                failure === "throw" ? "unavailable key" : failure === "duplicate" ? "duplicated" : "requested a reset",
            );
            expect([...ctx.state.indexByKey]).toEqual(before);
            expect(ctx.state.idCache).toEqual(keys);
            expect(store.getTotalSize()).toBe(45);
            expect(store.getSize(0)).toBe(35);
        }
    });

    it("publishes removed viewability tokens and relocates retained hooks and active targets", () => {
        const items = [{ id: "c" }, { id: "a" }];
        const source = { ...createSource(["c", "a"]), getItem: (index: number) => items[index] };
        const onChanged = mock(() => {});
        const onRemoved = mock(() => {});
        const onMoved = mock(() => {});
        const onAmountRemoved = mock(() => {});
        const tokens = ["a", "b", "c"].map((key, index) => ({
            containerId: index,
            index,
            isViewable: true,
            item: { id: key },
            key,
        }));
        const ctx = createMockContext(
            {},
            {
                idCache: ["a", "b", "c"],
                idsInView: ["a", "b", "c"],
                indexByKey: new Map([
                    ["a", 0],
                    ["b", 1],
                    ["c", 2],
                ]),
                initialScroll: {
                    bootstrap: { targetIndexSeed: 2, visibleIndices: [0, 1, 2] },
                    index: 2,
                    kind: "index",
                } as any,
                lastFirstVisibleItemCallback: { index: 1, key: "b" },
                props: { dataSource: source },
                viewabilityConfigCallbackPairs: [
                    { onViewableItemsChanged: onChanged, viewabilityConfig: { id: "rows" } },
                ],
            },
        );
        ctx.mapViewabilityConfigStates.set("rows", {
            end: 2,
            endBuffered: 2,
            previousEnd: 2,
            previousStart: 0,
            start: 0,
            startBuffered: 0,
            viewableItems: tokens,
        });
        ctx.mapViewabilityCallbacks.set("1rows", onRemoved);
        ctx.mapViewabilityCallbacks.set("0rows", onMoved);
        for (const token of tokens)
            ctx.mapViewabilityAmountValues.set(token.containerId, {
                ...token,
                percentOfScroller: 25,
                percentVisible: 100,
                scrollSize: 400,
                size: 100,
                sizeVisible: 100,
            });
        ctx.mapViewabilityAmountCallbacks.set(1, onAmountRemoved);
        const result = applyDataSourceMutationBatches(ctx, source, [
            createBatch(3, 2, [
                { deleteCount: 1, index: 1, insertCount: 0, type: "splice" },
                { count: 1, from: 1, to: 0, type: "move" },
            ]),
        ]);
        expect(result.applied).toBe(true);
        expect(onRemoved).toHaveBeenCalledWith(expect.objectContaining({ isViewable: false, key: "b" }));
        expect(onMoved).toHaveBeenCalledWith(expect.objectContaining({ index: 1, item: items[1], key: "a" }));
        expect(onAmountRemoved).toHaveBeenCalledWith(
            expect.objectContaining({ isViewable: false, key: "b", sizeVisible: -1 }),
        );
        expect(ctx.mapViewabilityAmountValues.has(0)).toBe(false);
        expect(onChanged).toHaveBeenCalledWith(
            expect.objectContaining({
                changed: [expect.objectContaining({ isViewable: false, key: "b" })],
                viewableItems: [
                    expect.objectContaining({ index: 1, key: "a" }),
                    expect.objectContaining({ index: 0, key: "c" }),
                ],
            }),
        );
        expect(ctx.state.idsInView).toEqual(["a", "c"]);
        expect(ctx.state.lastFirstVisibleItemCallback).toBeUndefined();
        expect(ctx.state.initialScroll?.index).toBe(0);
        expect(ctx.state.initialScroll?.bootstrap).toMatchObject({ targetIndexSeed: 0, visibleIndices: [1, 0, 0] });
    });

    it("clears viewability ranges and pinned targets when the last items are deleted", () => {
        const ctx = createMockContext(
            { activeStickyIndex: 1 },
            {
                firstFullyOnScreenIndex: 0,
                idCache: ["a", "b"],
                indexByKey: new Map([
                    ["a", 0],
                    ["b", 1],
                ]),
                scrollingTo: { index: 1, offset: 10 },
                scrollTargetPinnedRange: { end: 1, start: 0 },
            },
        );
        ctx.mapViewabilityConfigStates.set("rows", {
            end: 1,
            endBuffered: 1,
            previousEnd: 1,
            previousStart: 0,
            start: 0,
            startBuffered: 0,
            viewableItems: [],
        });
        expect(
            applyDataSourceMutationBatches(ctx, createSource([]), [
                createBatch(2, 0, [{ deleteCount: 2, index: 0, insertCount: 0, type: "splice" }]),
            ]).applied,
        ).toBe(true);
        expect(ctx.state.scrollTargetPinnedRange).toBeUndefined();
        expect(ctx.values.get("activeStickyIndex")).toBe(-1);
        expect(ctx.mapViewabilityConfigStates.get("rows")).toMatchObject({
            end: -1,
            endBuffered: -1,
            start: -1,
            startBuffered: -1,
        });
        expect(ctx.state.startNoBuffer).toBeNull();
        expect(ctx.state.endNoBuffer).toBeNull();
        expect(ctx.state.indexByKey.size).toBe(0);
    });

    it("transforms cached spans and preserves the earliest repack boundary across mutations", () => {
        let keys = ["a", "b", "c", "d"];
        const source = createSource(keys);
        const store = new RowLayoutStore({ estimatedSize: 10, length: 4, numColumns: 3, spans: [1, 2, 1, 3] });
        const runtime = new LayoutStoreRuntime(store, 10);
        const input = {
            data: source,
            dataKey: undefined,
            dataVersion: undefined,
            extraData: undefined,
            numColumns: 3,
            overrideItemLayout: () => {},
        };
        runtime.setCachedRowSpans(input, [1, 2, 1, 3]);
        const ctx = createMockContext(
            {},
            {
                idCache: [...keys],
                indexByKey: new Map(keys.map((key, index) => [key, index])),
                layoutStoreRuntime: runtime,
                props: { dataSource: source, numColumns: 3, overrideItemLayout: input.overrideItemLayout },
            },
        );
        expect(
            applyDataSourceMutationBatches(ctx, source, [
                createBatch(4, 4, [{ count: 1, index: 2, layout: "invalidate", type: "update" }]),
            ]).applied,
        ).toBe(true);
        expect(ctx.state.dataSourceSpanInvalidationIndex).toBe(2);
        keys = ["d", "a", "b", "c"];
        const movedSource = createSource(keys);
        expect(
            applyDataSourceMutationBatches(ctx, movedSource, [
                createBatch(4, 4, [{ count: 1, from: 3, to: 0, type: "move" }]),
            ]).applied,
        ).toBe(true);
        expect(runtime.getCachedRowSpans(input)).toEqual([3, 1, 2, 1]);
        expect(ctx.state.dataSourceSpanInvalidationIndex).toBe(0);
        expect(store.getSpan(0)).toBe(3);
        const insertedSource = createSource(["d", "a", "x", "b", "c"]);
        expect(
            applyDataSourceMutationBatches(ctx, insertedSource, [
                createBatch(4, 5, [{ deleteCount: 0, index: 2, insertCount: 1, type: "splice" }]),
            ]).applied,
        ).toBe(true);
        expect(runtime.getCachedRowSpans(input)).toEqual([3, 1, undefined, 2, 1]);
        expect(ctx.state.dataSourceSpanInvalidationIndex).toBe(0);
    });

    it("clamps deleted targets to inserted replacement slots", () => {
        expect(
            [1, 2, 3, 4].map((index) =>
                transformDataSourceIndex(index, [{ deleteCount: 3, index: 1, insertCount: 2, type: "splice" }]),
            ),
        ).toEqual([1, 2, 2, 3]);
    });
});

it("reuses the original anchor snapshot until reconciliation releases it", () => {
    const keys = ["a", "b"];
    const source = createSource(keys);
    const store = new PrefixLayoutStore(2, 10);
    const ctx = createMockContext(
        {},
        {
            idCache: ["a", "b"],
            idsInView: ["b"],
            indexByKey: new Map([
                ["a", 0],
                ["b", 1],
            ]),
            layoutStoreRuntime: new LayoutStoreRuntime(store, 10),
            props: { dataSource: source },
        },
    );
    const getOffset = spyOn(store, "getOffset");
    try {
        const prepend = (key: string) => {
            const previousLength = keys.length;
            keys.unshift(key);
            expect(
                applyDataSourceMutationBatches(ctx, source, [
                    createBatch(previousLength, keys.length, [
                        { deleteCount: 0, index: 0, insertCount: 1, type: "splice" },
                    ]),
                ]).applied,
            ).toBe(true);
        };
        prepend("x");
        const original = ctx.state.dataSourceAnchorPositions;
        expect(original?.get("b")).toBe(10);
        getOffset.mockClear();
        prepend("y");
        expect(ctx.state.dataSourceAnchorPositions).toBe(original);
        expect(getOffset).not.toHaveBeenCalled();

        ctx.state.dataSourceAnchorPositions = undefined;
        prepend("z");
        expect(ctx.state.dataSourceAnchorPositions?.get("b")).toBe(30);
        expect(getOffset).toHaveBeenCalledTimes(1);
    } finally {
        getOffset.mockRestore();
    }
});
