import { describe, expect, it, mock } from "bun:test";
import "../setup";

import {
    materializeFixedLayoutStoreRange,
    materializeFixedLayoutStoreRangeAtOffsets,
} from "../../src/core/fixedLayoutMaterialization";
import {
    getActiveLayoutStore,
    materializeLayoutStoreRange,
    rebuildLayoutStoreExact,
    setLayoutStoreMeasuredSize,
    syncActiveRowLayoutStoreSpans,
    syncLayoutStoreState,
    syncLayoutStoreStructure,
} from "../../src/core/layoutStoreLifecycle";
import { RowLayoutStore } from "../../src/core/RowLayoutStore";
import { resetLayoutCachesForDataChange } from "../../src/core/resetLayoutCachesForDataChange";
import { normalizeMaintainVisibleContentPosition } from "../../src/utils/normalizeMaintainVisibleContentPosition";
import { createMockContext } from "../__mocks__/createMockContext";
import { countLayoutValues, getLayoutValue } from "../helpers/layoutStore";

function createLayoutStoreContext(dataLength = 3) {
    return createMockContext(
        {
            numColumns: 1,
            readyToRender: true,
        },
        {
            didContainersLayout: true,
            didFinishInitialScroll: true,
            firstFullyOnScreenIndex: 0,
            props: {
                data: Array.from({ length: dataLength }, (_, index) => ({ id: `item-${index}` })),
                estimatedItemSize: 100,
                keyExtractor: (item: { id: string }) => item.id,
                maintainVisibleContentPosition: normalizeMaintainVisibleContentPosition(true),
                numColumns: 1,
            },
            scrollLength: 300,
        },
    );
}

describe("layout store lifecycle", () => {
    it("creates a store for the supported single-column path", () => {
        const ctx = createLayoutStoreContext();

        const store = syncLayoutStoreStructure(ctx);

        expect(store).toBeDefined();
        expect(getActiveLayoutStore(ctx)).toBe(store);
        expect(store?.length).toBe(3);
        expect(store?.getTotalSize()).toBe(300);
    });

    it("creates a row store for multi-column lists without override layouts", () => {
        const ctx = createLayoutStoreContext(5);
        ctx.state.props.numColumns = 2;

        const store = syncLayoutStoreStructure(ctx);
        const range = materializeLayoutStoreRange(ctx, 0, 4);

        expect(store).toBeInstanceOf(RowLayoutStore);
        expect(store?.getTotalSize()).toBe(300);
        expect(range).toEqual({ end: 4, start: 0 });
        expect(Array.from({ length: 5 }, (_, index) => (store as RowLayoutStore).getColumn(index))).toEqual([
            1, 2, 1, 2, 1,
        ]);
        expect(Array.from({ length: 5 }, (_, index) => (store as RowLayoutStore).getSpan(index))).toEqual([
            1, 1, 1, 1, 1,
        ]);
    });

    it("syncs override layout spans into the row store during calculation", () => {
        const ctx = createLayoutStoreContext(5);
        ctx.state.props.numColumns = 4;
        ctx.state.props.overrideItemLayout = (layout, _item, index) => {
            layout.span = [2, 3, 1, 4, 1][index];
        };

        const store = syncLayoutStoreStructure(ctx);
        const didSync = syncActiveRowLayoutStoreSpans(ctx);
        const range = materializeLayoutStoreRange(ctx, 0, 4);

        expect(didSync).toBe(true);
        expect(store).toBeInstanceOf(RowLayoutStore);
        expect(range).toEqual({ end: 4, start: 0 });
        expect(Array.from({ length: 5 }, (_, index) => (store as RowLayoutStore).getColumn(index))).toEqual([
            1, 1, 4, 1, 1,
        ]);
        expect(Array.from({ length: 5 }, (_, index) => (store as RowLayoutStore).getSpan(index))).toEqual([
            2, 3, 1, 4, 1,
        ]);
        expect(store?.getOffset(4)).toBe(300);
        expect(store?.getTotalSize()).toBe(400);
    });

    it("reuses cached override spans until span inputs change", () => {
        const ctx = createLayoutStoreContext(5);
        const overrideItemLayout = mock((layout, _item, index) => {
            layout.span = [2, 3, 1, 4, 1][index];
        });
        ctx.state.props.numColumns = 4;
        ctx.state.props.dataVersion = "a";
        ctx.state.props.overrideItemLayout = overrideItemLayout;
        ctx.values.set("extraData", "a");

        const store = syncLayoutStoreStructure(ctx);

        expect(syncActiveRowLayoutStoreSpans(ctx)).toBe(true);
        expect(overrideItemLayout).toHaveBeenCalledTimes(5);
        expect(Array.from({ length: 5 }, (_, index) => (store as RowLayoutStore).getColumn(index))).toEqual([
            1, 1, 4, 1, 1,
        ]);

        expect(syncActiveRowLayoutStoreSpans(ctx)).toBe(false);
        syncLayoutStoreStructure(ctx);
        expect(syncActiveRowLayoutStoreSpans(ctx)).toBe(false);
        expect(overrideItemLayout).toHaveBeenCalledTimes(5);
        expect(Array.from({ length: 5 }, (_, index) => (store as RowLayoutStore).getColumn(index))).toEqual([
            1, 1, 4, 1, 1,
        ]);

        ctx.values.set("extraData", "b");
        expect(syncActiveRowLayoutStoreSpans(ctx)).toBe(true);
        expect(overrideItemLayout).toHaveBeenCalledTimes(10);

        ctx.state.props.dataVersion = "b";
        expect(syncActiveRowLayoutStoreSpans(ctx)).toBe(true);
        expect(overrideItemLayout).toHaveBeenCalledTimes(15);
    });

    it("evaluates every span when an invalidation arrives before the first span cache", () => {
        const ctx = createLayoutStoreContext(5);
        const overrideItemLayout = mock((layout, _item, index) => {
            layout.span = [2, 1, 3, 4, 2][index];
        });
        ctx.state.props.numColumns = 4;
        ctx.state.props.overrideItemLayout = overrideItemLayout;
        ctx.state.dataSourceSpanInvalidationIndex = 3;

        const store = syncLayoutStoreStructure(ctx) as RowLayoutStore;

        expect(syncActiveRowLayoutStoreSpans(ctx)).toBe(true);
        expect(overrideItemLayout).toHaveBeenCalledTimes(5);
        expect(Array.from({ length: 5 }, (_, index) => store.getSpan(index))).toEqual([2, 1, 3, 4, 2]);
    });

    it("re-evaluates cached variable spans only from the mutation boundary", () => {
        const ctx = createLayoutStoreContext(1_000);
        const spans = Array.from({ length: 1_000 }, () => 1);
        const overrideItemLayout = mock((layout, _item, index) => {
            layout.span = spans[index];
        });
        ctx.state.props.numColumns = 4;
        ctx.state.props.overrideItemLayout = overrideItemLayout;

        const store = syncLayoutStoreStructure(ctx) as RowLayoutStore;
        syncActiveRowLayoutStoreSpans(ctx);
        overrideItemLayout.mockClear();
        spans[990] = 4;
        ctx.state.dataSourceSpanInvalidationIndex = 990;

        expect(syncActiveRowLayoutStoreSpans(ctx)).toBe(true);
        expect(overrideItemLayout).toHaveBeenCalledTimes(10);
        expect(store.getSpan(989)).toBe(1);
        expect(store.getSpan(990)).toBe(4);
        expect(ctx.state.dataSourceSpanInvalidationIndex).toBeUndefined();
    });

    it("keeps unloaded variable-span items at the default span", () => {
        const ctx = createLayoutStoreContext(3);
        const overrideItemLayout = mock((layout) => {
            layout.span = 2;
        });
        ctx.state.props.data = [undefined, { id: "loaded" }, undefined] as any;
        ctx.state.props.numColumns = 4;
        ctx.state.props.overrideItemLayout = overrideItemLayout;

        const store = syncLayoutStoreStructure(ctx) as RowLayoutStore;
        syncActiveRowLayoutStoreSpans(ctx);

        expect(overrideItemLayout).toHaveBeenCalledTimes(1);
        expect(Array.from({ length: 3 }, (_, index) => store.getSpan(index))).toEqual([1, 2, 1]);
    });

    it("keeps an existing store when the axis changes without changing column support", () => {
        const ctx = createLayoutStoreContext();

        const initialStore = syncLayoutStoreStructure(ctx);

        ctx.state.props.horizontal = true;
        const store = syncLayoutStoreStructure(ctx);

        expect(store).toBe(initialStore);
        expect(ctx.state.layoutStoreRuntime?.store).toBe(initialStore);
    });

    it("seeds known measurements without changing the configured estimate", () => {
        const ctx = createLayoutStoreContext(4);
        ctx.state.idCache[0] = "item-0";
        ctx.state.idCache[1] = "item-1";
        ctx.state.sizesKnown.set("item-0", 40);
        ctx.state.sizesKnown.set("item-1", 60);

        const store = syncLayoutStoreStructure(ctx);

        expect(store?.getEstimatedSize()).toBe(100);
        expect(store?.getMeasuredCount()).toBe(2);
        expect(store?.getSize(0)).toBe(40);
        expect(store?.getSize(1)).toBe(60);
        expect(store?.getTotalSize()).toBe(300);
    });

    it("uses the scroll-axis gap in the initial estimate", () => {
        const ctx = createLayoutStoreContext();
        ctx.scrollAxisGap = 8;

        const store = syncLayoutStoreStructure(ctx);

        expect(store?.getEstimatedSize()).toBe(108);
        expect(store?.getTotalSize()).toBe(324);
    });

    it("does not scan fixed-size hints during structural sync", () => {
        const ctx = createLayoutStoreContext(1000);
        const getFixedItemSize = mock(() => 64);
        ctx.state.props.getFixedItemSize = getFixedItemSize;

        const store = syncLayoutStoreStructure(ctx);
        syncLayoutStoreStructure(ctx);

        expect(store?.getEstimatedSize()).toBe(100);
        expect(store?.getTotalSize()).toBe(100000);
        expect(getFixedItemSize).not.toHaveBeenCalled();
    });

    it("does not seed the initial estimate from fixed-size hints", () => {
        const ctx = createLayoutStoreContext();
        const getFixedItemSize = mock((_item, _index, itemType) => (itemType === "row" ? 64 : undefined));
        ctx.state.props.getItemType = () => "row";
        ctx.state.props.getFixedItemSize = getFixedItemSize;

        const store = rebuildLayoutStoreExact(ctx);

        expect(store?.getEstimatedSize()).toBe(100);
        expect(store?.getTotalSize()).toBe(300);
        expect(getFixedItemSize).not.toHaveBeenCalled();
    });

    it("materializes only the requested sparse fixed-size range", () => {
        const ctx = createLayoutStoreContext(1_000_000);
        const getFixedItemSize = mock(() => 10);
        ctx.state.props.getFixedItemSize = getFixedItemSize;
        const store = syncLayoutStoreStructure(ctx)!;

        expect(materializeFixedLayoutStoreRange(ctx, 999_990, 999_999)).toBe(true);
        expect(store.getOffset(999_990)).toBe(99_999_000);
        expect(store.getSize(999_990)).toBe(10);
        expect(store.getMeasuredCount()).toBe(10);
        expect(getFixedItemSize).toHaveBeenCalledTimes(10);
        expect(ctx.state.indexByKey.size).toBe(0);
        expect(Object.keys(ctx.state.idCache)).toHaveLength(0);
    });

    it("expands exact fixed-size work only until the requested offset range is covered", () => {
        const ctx = createLayoutStoreContext(1_000_000);
        const getFixedItemSize = mock(() => 10);
        ctx.state.props.getFixedItemSize = getFixedItemSize;
        syncLayoutStoreStructure(ctx);

        const result = materializeFixedLayoutStoreRangeAtOffsets(ctx, 99_999_000, 99_999_500);

        expect(result.didChange).toBe(true);
        expect(result.range).toEqual({ end: 999_999, start: 999_990 });
        expect(getFixedItemSize).toHaveBeenCalledTimes(10);
        expect(ctx.state.indexByKey.size).toBe(0);
    });

    it("refreshes sparse fixed sizes when the data changes", () => {
        const ctx = createLayoutStoreContext(3);
        ctx.state.props.data = [
            { fixed: 10, id: "item-0" },
            { fixed: 10, id: "item-1" },
            { fixed: 10, id: "item-2" },
        ];
        ctx.state.props.getFixedItemSize = (item: { fixed: number }) => item.fixed;
        const store = syncLayoutStoreStructure(ctx)!;
        materializeFixedLayoutStoreRange(ctx, 0, 2);
        expect(store.getTotalSize()).toBe(30);

        ctx.state.props.data = [
            { fixed: 20, id: "item-0" },
            { fixed: 20, id: "item-1" },
            { fixed: 20, id: "item-2" },
        ];
        materializeFixedLayoutStoreRange(ctx, 0, 2);
        expect(store.getTotalSize()).toBe(60);
    });

    it("leaves fixed-size hints estimate-backed until rows are materialized", () => {
        const ctx = createLayoutStoreContext();
        const getFixedItemSize = mock((_item, index) => {
            if (index === 0) return 40;
            if (index === 2) return 80;
            return undefined;
        });
        ctx.state.props.getFixedItemSize = getFixedItemSize;

        const store = rebuildLayoutStoreExact(ctx);

        expect(store?.getMeasuredCount()).toBe(0);
        expect(store?.getEstimatedSize()).toBe(100);
        expect(store?.getSize(0)).toBe(100);
        expect(store?.getSize(1)).toBe(100);
        expect(store?.getSize(2)).toBe(100);
        expect(getFixedItemSize).not.toHaveBeenCalled();
    });

    it("restores measured known sizes without changing the configured estimate", () => {
        const ctx = createLayoutStoreContext(5);
        ctx.state.idCache[0] = "item-0";
        ctx.state.idCache[1] = "item-1";
        ctx.state.sizesKnown.set("item-0", 40);
        ctx.state.sizesKnown.set("item-1", 60);
        ctx.state.sizes.set("item-0", 40);
        ctx.state.sizes.set("item-1", 60);

        const store = rebuildLayoutStoreExact(ctx);

        expect(store?.getEstimatedSize()).toBe(100);
        expect(store?.getTotalSize()).toBe(400);
        expect(store?.getMeasuredCount()).toBe(2);
    });

    it("keeps distant variable fixed snap targets sparse and estimate-backed", () => {
        const ctx = createLayoutStoreContext(1_000_000);
        const getFixedItemSize = mock((_item, index) => (index === 0 ? 300 : 60));
        ctx.state.props.getFixedItemSize = getFixedItemSize;
        ctx.state.props.snapToIndices = [0, 1, 900_000, 999_999];

        const store = rebuildLayoutStoreExact(ctx);
        syncLayoutStoreState(ctx);

        expect(store?.getEstimatedSize()).toBe(100);
        expect(store?.getMeasuredCount()).toBe(0);
        expect(store?.getSize(0)).toBe(100);
        expect(store?.getSize(999_999)).toBe(100);
        expect(ctx.values.get("snapToOffsets")).toEqual([0, 100, 90_000_000, 99_999_900]);
        expect(getFixedItemSize).not.toHaveBeenCalled();
        expect(countLayoutValues(ctx.state, "positions")).toBe(0);
    });

    it("preserves estimate-backed fixed-size layout across later structural syncs", () => {
        const ctx = createLayoutStoreContext(30);
        const getFixedItemSize = mock((_item, index) => (index === 0 ? 300 : 60));
        ctx.state.props.getFixedItemSize = getFixedItemSize;

        const store = rebuildLayoutStoreExact(ctx);
        getFixedItemSize.mockClear();
        syncLayoutStoreStructure(ctx);

        expect(store?.getEstimatedSize()).toBe(100);
        expect(store?.getOffset(20)).toBe(2000);
        expect(getFixedItemSize).not.toHaveBeenCalled();
    });

    it("resizes and updates estimates when supported props change", () => {
        const ctx = createLayoutStoreContext();
        const store = syncLayoutStoreStructure(ctx)!;

        ctx.state.props.data = Array.from({ length: 5 }, (_, index) => ({ id: `next-${index}` }));
        ctx.state.props.estimatedItemSize = 80;
        const nextStore = syncLayoutStoreStructure(ctx);

        expect(nextStore).toBe(store);
        expect(nextStore?.length).toBe(5);
        expect(nextStore?.getEstimatedSize()).toBe(80);
        expect(nextStore?.getTotalSize()).toBe(400);
    });

    it("keeps the configured estimate across syncs until the prop changes", () => {
        const ctx = createLayoutStoreContext();
        const store = syncLayoutStoreStructure(ctx)!;
        store.setMeasuredSize(0, 60);

        expect(syncLayoutStoreStructure(ctx)).toBe(store);
        expect(store.getEstimatedSize()).toBe(100);

        ctx.state.props.estimatedItemSize = 80;
        syncLayoutStoreStructure(ctx);

        expect(store.getEstimatedSize()).toBe(80);
    });

    it("syncs snap offsets from prefix-store aggregate layout without materializing positions", () => {
        const ctx = createLayoutStoreContext(100);
        ctx.state.props.snapToIndices = [0, 2, 20];

        const store = syncLayoutStoreStructure(ctx);
        syncLayoutStoreState(ctx);

        expect(store).toBeDefined();
        expect(ctx.values.get("snapToOffsets")).toEqual([0, 200, 2000]);
        expect(countLayoutValues(ctx.state, "positions")).toBe(0);
    });

    it("updates snap offsets after an index-0 prefix measurement without materializing downstream positions", () => {
        const ctx = createLayoutStoreContext(100);
        ctx.state.props.snapToIndices = [0, 1, 20];
        syncLayoutStoreStructure(ctx);
        syncLayoutStoreState(ctx);

        setLayoutStoreMeasuredSize(ctx, 0, 150);

        expect(ctx.values.get("snapToOffsets")).toEqual([0, 150, 2050]);
        expect(countLayoutValues(ctx.state, "positions")).toBe(0);
    });

    it("supports internal position components and position listeners", () => {
        const ctx = createLayoutStoreContext();
        ctx.state.props.positionComponentInternal = () => null;
        ctx.positionListeners.set("item-1", new Set());

        const store = syncLayoutStoreStructure(ctx);

        expect(store).toBeDefined();
        expect(getActiveLayoutStore(ctx)).toBe(store);
    });

    it("notifies position listeners while materializing a prefix range", () => {
        const ctx = createLayoutStoreContext(100);
        const positionUpdates: number[] = [];
        ctx.positionListeners.set(
            "item-1",
            new Set([
                (position) => {
                    positionUpdates.push(position);
                },
            ]),
        );
        syncLayoutStoreStructure(ctx);

        materializeLayoutStoreRange(ctx, 0, 3);

        expect(positionUpdates).toEqual([100]);
        expect(ctx.state.indexByKey.get("item-1")).toBe(1);
        expect(ctx.state.layoutStoreRuntime?.store.getSize(1)).toBe(100);
        expect(ctx.state.sizes.get("item-1")).toBeUndefined();
        expect(countLayoutValues(ctx.state, "positions")).toBe(0);
    });

    it("notifies known listener keys after a prefix size change without materializing downstream positions", () => {
        const ctx = createLayoutStoreContext(100);
        const positionUpdates: number[] = [];
        ctx.positionListeners.set(
            "item-20",
            new Set([
                (position) => {
                    positionUpdates.push(position);
                },
            ]),
        );
        syncLayoutStoreStructure(ctx);
        materializeLayoutStoreRange(ctx, 20, 20);
        positionUpdates.length = 0;

        setLayoutStoreMeasuredSize(ctx, 0, 150);

        expect(positionUpdates).toEqual([2050]);
        expect(getLayoutValue(ctx.state, "positions", 20)).toBeUndefined();
        expect(countLayoutValues(ctx.state, "positions")).toBe(0);
    });

    it("clears measurements when layout caches reset", () => {
        const ctx = createLayoutStoreContext();
        const store = syncLayoutStoreStructure(ctx)!;
        store.setMeasuredSize(0, 50);

        resetLayoutCachesForDataChange(ctx.state);

        expect(store.getSize(0)).toBe(100);
        expect(store.getTotalSize()).toBe(300);
    });

    it("replaces the store when column support changes", () => {
        const ctx = createLayoutStoreContext();
        const initialStore = syncLayoutStoreStructure(ctx);

        ctx.state.props.numColumns = 2;
        const rowStore = syncLayoutStoreStructure(ctx);

        expect(rowStore).toBeInstanceOf(RowLayoutStore);
        expect(rowStore).not.toBe(initialStore);

        ctx.state.props.numColumns = 1;
        const prefixStore = syncLayoutStoreStructure(ctx);

        expect(prefixStore).not.toBe(rowStore);
        expect(prefixStore).not.toBeInstanceOf(RowLayoutStore);
    });

    it("keeps a store when an invalid internal column count reaches lifecycle sync", () => {
        const ctx = createLayoutStoreContext();
        const initialStore = syncLayoutStoreStructure(ctx);

        ctx.state.props.numColumns = 0;
        const store = syncLayoutStoreStructure(ctx);

        expect(store).toBe(initialStore);
        expect(getActiveLayoutStore(ctx)).toBe(initialStore);
        expect(store).not.toBeInstanceOf(RowLayoutStore);
    });
});
