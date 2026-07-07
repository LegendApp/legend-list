import { describe, expect, it, mock, spyOn } from "bun:test";
import "../setup";

import {
    getActivePrefixLayoutStore,
    isPrefixLayoutStoreSupported,
    materializePrefixLayoutStoreRange,
    maybeFlushInitialPrefixLayoutEstimate,
    rebuildPrefixLayoutStoreExact,
    schedulePeriodicPrefixLayoutEstimateFlush,
    setPrefixLayoutStoreMeasuredSize,
    syncPrefixLayoutStoreStructure,
    syncPrefixLayoutStoreTotalSize,
} from "../../src/core/prefixLayoutStoreLifecycle";
import { resetLayoutCachesForDataChange } from "../../src/core/resetLayoutCachesForDataChange";
import { normalizeMaintainVisibleContentPosition } from "../../src/utils/normalizeMaintainVisibleContentPosition";
import { createMockContext } from "../__mocks__/createMockContext";
import { countLayoutValues } from "../helpers/layoutArrays";

function captureTimeouts() {
    const callbacks: Array<() => void> = [];
    const setTimeoutSpy = spyOn(globalThis, "setTimeout").mockImplementation((callback: any) => {
        callbacks.push(callback);
        return callbacks.length as any;
    });
    const clearTimeoutSpy = spyOn(globalThis, "clearTimeout").mockImplementation(() => undefined as any);

    return {
        callbacks,
        restore() {
            clearTimeoutSpy.mockRestore();
            setTimeoutSpy.mockRestore();
        },
    };
}

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

describe("prefix layout store lifecycle", () => {
    it("creates a store for the supported vertical single-column path", () => {
        const ctx = createLayoutStoreContext();

        const store = syncPrefixLayoutStoreStructure(ctx);

        expect(isPrefixLayoutStoreSupported(ctx)).toBe(true);
        expect(store).toBeDefined();
        expect(getActivePrefixLayoutStore(ctx)).toBe(store);
        expect(store?.length).toBe(3);
        expect(store?.getTotalSize()).toBe(300);
    });

    it("does not recreate a store after keyless data changes disable prefix layout", () => {
        const ctx = createLayoutStoreContext();

        expect(syncPrefixLayoutStoreStructure(ctx)).toBeDefined();

        ctx.state.disablePrefixLayoutStoreAfterKeylessDataChange = true;
        const store = syncPrefixLayoutStoreStructure(ctx);

        expect(isPrefixLayoutStoreSupported(ctx)).toBe(false);
        expect(store).toBeUndefined();
        expect(ctx.state.layoutStore).toBeUndefined();
    });

    it("seeds newly created stores from known measurements", () => {
        const ctx = createLayoutStoreContext(4);
        ctx.state.sizesKnown.set("item-0", 40);
        ctx.state.sizesKnown.set("item-1", 60);

        const store = syncPrefixLayoutStoreStructure(ctx);

        expect(store?.getEstimatedSize()).toBe(50);
        expect(store?.getMeasuredCount()).toBe(2);
        expect(store?.getSize(0)).toBe(40);
        expect(store?.getSize(1)).toBe(60);
        expect(store?.getTotalSize()).toBe(200);
    });

    it("uses the scroll-axis gap in the initial estimate", () => {
        const ctx = createLayoutStoreContext();
        ctx.scrollAxisGap = 8;

        const store = syncPrefixLayoutStoreStructure(ctx);

        expect(store?.getEstimatedSize()).toBe(108);
        expect(store?.getTotalSize()).toBe(324);
    });

    it("does not scan fixed-size hints during structural sync", () => {
        const ctx = createLayoutStoreContext(1000);
        const getFixedItemSize = mock(() => 64);
        ctx.state.props.getFixedItemSize = getFixedItemSize;

        const store = syncPrefixLayoutStoreStructure(ctx);
        syncPrefixLayoutStoreStructure(ctx);

        expect(store?.getEstimatedSize()).toBe(100);
        expect(store?.getTotalSize()).toBe(100000);
        expect(getFixedItemSize).not.toHaveBeenCalled();
    });

    it("seeds the initial estimate from fixed-size hints when available", () => {
        const ctx = createLayoutStoreContext();
        ctx.state.props.getItemType = () => "row";
        ctx.state.props.getFixedItemSize = (_item, _index, itemType) => (itemType === "row" ? 64 : undefined);

        const store = rebuildPrefixLayoutStoreExact(ctx);

        expect(store?.getEstimatedSize()).toBe(64);
        expect(store?.getTotalSize()).toBe(192);
    });

    it("uses the fallback estimate for missing fixed-size hints without marking them measured", () => {
        const ctx = createLayoutStoreContext();
        ctx.state.props.getFixedItemSize = (_item, index) => {
            if (index === 0) return 40;
            if (index === 2) return 80;
            return undefined;
        };

        const store = rebuildPrefixLayoutStoreExact(ctx);

        expect(store?.getMeasuredCount()).toBe(0);
        expect(store?.getEstimatedSize()).toBe((40 + 100 + 80) / 3);
        expect(store?.getSize(0)).toBe(40);
        expect(store?.getSize(1)).toBe((40 + 100 + 80) / 3);
        expect(store?.getSize(2)).toBe(80);
    });

    it("uses measured known sizes as the exact rebuild seed estimate", () => {
        const ctx = createLayoutStoreContext(5);
        ctx.state.sizesKnown.set("item-0", 40);
        ctx.state.sizesKnown.set("item-1", 60);
        ctx.state.sizes.set("item-0", 40);
        ctx.state.sizes.set("item-1", 60);

        const store = rebuildPrefixLayoutStoreExact(ctx);

        expect(store?.getEstimatedSize()).toBe(50);
        expect(store?.getTotalSize()).toBe(250);
        expect(store?.getMeasuredCount()).toBe(2);
    });

    it("seeds every fixed-size hint so variable fixed offsets stay exact", () => {
        const ctx = createLayoutStoreContext(30);
        ctx.state.initialScroll = {
            index: 29,
            viewPosition: 1,
        };
        ctx.state.props.getFixedItemSize = (_item, index) => (index === 0 ? 300 : 60);
        ctx.state.props.snapToIndices = [0, 1, 20, 29];

        const store = rebuildPrefixLayoutStoreExact(ctx);
        syncPrefixLayoutStoreTotalSize(ctx);

        expect(store?.getEstimatedSize()).toBe(68);
        expect(store?.getMeasuredCount()).toBe(0);
        expect(store?.getSize(0)).toBe(300);
        expect(store?.getSize(29)).toBe(60);
        expect(store?.getOffset(20)).toBe(1440);
        expect(ctx.values.get("snapToOffsets")).toEqual([0, 300, 1440, 1980]);
        expect(countLayoutValues(ctx.state.positions)).toBe(0);
    });

    it("preserves an exact fixed-size estimate across later structural syncs", () => {
        const ctx = createLayoutStoreContext(30);
        const getFixedItemSize = mock((_item, index) => (index === 0 ? 300 : 60));
        ctx.state.props.getFixedItemSize = getFixedItemSize;

        const store = rebuildPrefixLayoutStoreExact(ctx);
        getFixedItemSize.mockClear();
        syncPrefixLayoutStoreStructure(ctx);

        expect(store?.getEstimatedSize()).toBe(68);
        expect(store?.getOffset(20)).toBe(1440);
        expect(getFixedItemSize).not.toHaveBeenCalled();
    });

    it("resizes and updates estimates when supported props change", () => {
        const ctx = createLayoutStoreContext();
        const store = syncPrefixLayoutStoreStructure(ctx)!;

        ctx.state.props.data = Array.from({ length: 5 }, (_, index) => ({ id: `next-${index}` }));
        ctx.state.props.estimatedItemSize = 80;
        const nextStore = syncPrefixLayoutStoreStructure(ctx);

        expect(nextStore).toBe(store);
        expect(nextStore?.length).toBe(5);
        expect(nextStore?.getEstimatedSize()).toBe(80);
        expect(nextStore?.getTotalSize()).toBe(400);
    });

    it("preserves learned estimates across syncs until the prop estimate changes", () => {
        const ctx = createLayoutStoreContext();
        const store = syncPrefixLayoutStoreStructure(ctx)!;
        store.flushEstimatedSize(60);

        expect(syncPrefixLayoutStoreStructure(ctx)).toBe(store);
        expect(store.getEstimatedSize()).toBe(60);

        ctx.state.props.estimatedItemSize = 80;
        syncPrefixLayoutStoreStructure(ctx);

        expect(store.getEstimatedSize()).toBe(80);
    });

    it("syncs snap offsets from prefix-store aggregate layout without materializing positions", () => {
        const ctx = createLayoutStoreContext(100);
        ctx.state.props.snapToIndices = [0, 2, 20];

        const store = syncPrefixLayoutStoreStructure(ctx);
        syncPrefixLayoutStoreTotalSize(ctx);

        expect(isPrefixLayoutStoreSupported(ctx)).toBe(true);
        expect(store).toBeDefined();
        expect(ctx.values.get("snapToOffsets")).toEqual([0, 200, 2000]);
        expect(countLayoutValues(ctx.state.positions)).toBe(0);
    });

    it("updates snap offsets after an index-0 prefix measurement without materializing downstream positions", () => {
        const ctx = createLayoutStoreContext(100);
        ctx.state.props.snapToIndices = [0, 1, 20];
        syncPrefixLayoutStoreStructure(ctx);
        syncPrefixLayoutStoreTotalSize(ctx);

        setPrefixLayoutStoreMeasuredSize(ctx, 0, "item-0", 150);

        expect(ctx.values.get("snapToOffsets")).toEqual([0, 150, 2050]);
        expect(countLayoutValues(ctx.state.positions)).toBe(0);
    });

    it("updates snap offsets after a periodic prefix estimate flush", () => {
        const timers = captureTimeouts();
        try {
            const ctx = createLayoutStoreContext(10);
            const store = syncPrefixLayoutStoreStructure(ctx)!;
            ctx.state.props.snapToIndices = [5];
            ctx.state.firstFullyOnScreenIndex = 5;
            syncPrefixLayoutStoreTotalSize(ctx);

            for (let index = 0; index < 4; index++) {
                setPrefixLayoutStoreMeasuredSize(ctx, index, `item-${index}`, 50);
            }

            expect(ctx.values.get("snapToOffsets")).toEqual([300]);
            expect(schedulePeriodicPrefixLayoutEstimateFlush(ctx)).toBe(true);
            timers.callbacks[0]();

            expect(store.getEstimatedSize()).toBe(50);
            expect(ctx.values.get("snapToOffsets")).toEqual([250]);
        } finally {
            timers.restore();
        }
    });

    it("supports internal position components and position listeners", () => {
        const ctx = createLayoutStoreContext();
        ctx.state.props.positionComponentInternal = () => null;
        ctx.positionListeners.set("item-1", new Set());

        const store = syncPrefixLayoutStoreStructure(ctx);

        expect(isPrefixLayoutStoreSupported(ctx)).toBe(true);
        expect(store).toBeDefined();
        expect(getActivePrefixLayoutStore(ctx)).toBe(store);
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
        syncPrefixLayoutStoreStructure(ctx);

        materializePrefixLayoutStoreRange(ctx, 0, 3);

        expect(positionUpdates).toEqual([100]);
        expect(ctx.state.indexByKey.get("item-1")).toBe(1);
        expect(ctx.state.sizes.get("item-1")).toBe(100);
        expect(countLayoutValues(ctx.state.positions)).toBe(0);
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
        syncPrefixLayoutStoreStructure(ctx);
        materializePrefixLayoutStoreRange(ctx, 20, 20);
        positionUpdates.length = 0;

        setPrefixLayoutStoreMeasuredSize(ctx, 0, "item-0", 150);

        expect(positionUpdates).toEqual([2050]);
        expect(ctx.state.positions[20]).toBeUndefined();
        expect(countLayoutValues(ctx.state.positions)).toBe(0);
    });

    it("clears measurements when layout caches reset", () => {
        const ctx = createLayoutStoreContext();
        const store = syncPrefixLayoutStoreStructure(ctx)!;
        store.setMeasuredSize(0, 50);

        resetLayoutCachesForDataChange(ctx.state);

        expect(store.getSize(0)).toBe(100);
        expect(store.getTotalSize()).toBe(300);
    });

    it("clamps stale visible anchors when flushing the initial estimate", () => {
        const ctx = createLayoutStoreContext(2);
        const store = syncPrefixLayoutStoreStructure(ctx)!;
        ctx.state.startNoBuffer = 3;
        ctx.state.endNoBuffer = 4;
        ctx.state.idCache[3] = "stale-3";
        ctx.state.idCache[4] = "stale-4";
        ctx.state.sizesKnown.set("stale-3", 50);
        ctx.state.sizesKnown.set("stale-4", 50);

        setPrefixLayoutStoreMeasuredSize(ctx, 0, "item-0", 50);
        maybeFlushInitialPrefixLayoutEstimate(ctx);

        expect(store.getEstimatedSize()).toBe(50);
        expect(store.getTotalSize()).toBe(100);
    });

    it("periodically flushes the measured average while idle and corrects the anchor", () => {
        const timers = captureTimeouts();
        try {
            const ctx = createLayoutStoreContext(10);
            const store = syncPrefixLayoutStoreStructure(ctx)!;
            const requestedAdjustments: number[] = [];
            ctx.state.scrollAdjustHandler.requestAdjust = (amount) => {
                requestedAdjustments.push(amount);
            };
            ctx.state.firstFullyOnScreenIndex = 5;
            ctx.state.startBuffered = 5;
            ctx.state.startNoBuffer = 5;
            ctx.state.endBuffered = 6;
            ctx.state.endNoBuffer = 6;
            materializePrefixLayoutStoreRange(ctx, 5, 6);

            for (let index = 0; index < 4; index++) {
                setPrefixLayoutStoreMeasuredSize(ctx, index, `item-${index}`, 50);
            }

            expect(schedulePeriodicPrefixLayoutEstimateFlush(ctx)).toBe(true);
            expect(timers.callbacks.length).toBe(1);

            timers.callbacks[0]();

            expect(store.getEstimatedSize()).toBe(50);
            expect(ctx.state.totalSize).toBe(500);
            expect(ctx.state.positions[5]).toBeUndefined();
            expect(store.getOffset(5)).toBe(250);
            expect(requestedAdjustments).toEqual([-50]);
            expect(ctx.state.lastFlushedLayoutStoreEstimateMeasurementCount).toBe(4);
        } finally {
            timers.restore();
        }
    });

    it("defers periodic estimate flushes until recent scroll activity settles", () => {
        const timers = captureTimeouts();
        try {
            const ctx = createLayoutStoreContext(10);
            const store = syncPrefixLayoutStoreStructure(ctx)!;
            ctx.state.scrollTime = Date.now();

            for (let index = 0; index < 4; index++) {
                setPrefixLayoutStoreMeasuredSize(ctx, index, `item-${index}`, 50);
            }

            expect(schedulePeriodicPrefixLayoutEstimateFlush(ctx)).toBe(true);
            timers.callbacks[0]();

            expect(store.getEstimatedSize()).toBe(100);
            expect(timers.callbacks.length).toBe(2);

            ctx.state.scrollTime = Date.now() - 1000;
            timers.callbacks[1]();

            expect(store.getEstimatedSize()).toBe(50);
            expect(ctx.state.lastFlushedLayoutStoreEstimateMeasurementCount).toBe(4);
        } finally {
            timers.restore();
        }
    });

    it("disables the store for unsupported capabilities", () => {
        const cases = [
            {
                name: "horizontal",
                patch: (ctx: ReturnType<typeof createLayoutStoreContext>) => {
                    ctx.state.props.horizontal = true;
                },
            },
            {
                name: "multiple columns",
                patch: (ctx: ReturnType<typeof createLayoutStoreContext>) => {
                    ctx.state.props.numColumns = 2;
                },
            },
            {
                name: "override layout",
                patch: (ctx: ReturnType<typeof createLayoutStoreContext>) => {
                    ctx.state.props.overrideItemLayout = () => undefined;
                },
            },
        ];

        for (const testCase of cases) {
            const ctx = createLayoutStoreContext();
            syncPrefixLayoutStoreStructure(ctx);

            testCase.patch(ctx);
            syncPrefixLayoutStoreStructure(ctx);

            expect(isPrefixLayoutStoreSupported(ctx), testCase.name).toBe(false);
            expect(ctx.state.layoutStore, testCase.name).toBeUndefined();
            expect(getActivePrefixLayoutStore(ctx), testCase.name).toBeUndefined();
        }
    });
});
