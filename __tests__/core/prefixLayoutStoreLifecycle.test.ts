import { describe, expect, it, spyOn } from "bun:test";
import "../setup";

import {
    getActivePrefixLayoutStore,
    isPrefixLayoutStoreSupported,
    materializePrefixLayoutStoreRange,
    schedulePeriodicPrefixLayoutEstimateFlush,
    setPrefixLayoutStoreMeasuredSize,
    syncPrefixLayoutStore,
} from "../../src/core/prefixLayoutStoreLifecycle";
import { resetLayoutCachesForDataChange } from "../../src/core/resetLayoutCachesForDataChange";
import { normalizeMaintainVisibleContentPosition } from "../../src/utils/normalizeMaintainVisibleContentPosition";
import { createMockContext } from "../__mocks__/createMockContext";

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

        const store = syncPrefixLayoutStore(ctx);

        expect(isPrefixLayoutStoreSupported(ctx)).toBe(true);
        expect(store).toBeDefined();
        expect(getActivePrefixLayoutStore(ctx)).toBe(store);
        expect(store?.length).toBe(3);
        expect(store?.getTotalSize()).toBe(300);
    });

    it("uses the scroll-axis gap in the initial estimate", () => {
        const ctx = createLayoutStoreContext();
        ctx.scrollAxisGap = 8;

        const store = syncPrefixLayoutStore(ctx);

        expect(store?.getEstimatedSize()).toBe(108);
        expect(store?.getTotalSize()).toBe(324);
    });

    it("resizes and updates estimates when supported props change", () => {
        const ctx = createLayoutStoreContext();
        const store = syncPrefixLayoutStore(ctx)!;

        ctx.state.props.data = Array.from({ length: 5 }, (_, index) => ({ id: `next-${index}` }));
        ctx.state.props.estimatedItemSize = 80;
        const nextStore = syncPrefixLayoutStore(ctx);

        expect(nextStore).toBe(store);
        expect(nextStore?.length).toBe(5);
        expect(nextStore?.getEstimatedSize()).toBe(80);
        expect(nextStore?.getTotalSize()).toBe(400);
    });

    it("preserves learned estimates across syncs until the prop estimate changes", () => {
        const ctx = createLayoutStoreContext();
        const store = syncPrefixLayoutStore(ctx)!;
        store.flushEstimatedSize(60);

        expect(syncPrefixLayoutStore(ctx)).toBe(store);
        expect(store.getEstimatedSize()).toBe(60);

        ctx.state.props.estimatedItemSize = 80;
        syncPrefixLayoutStore(ctx);

        expect(store.getEstimatedSize()).toBe(80);
    });

    it("clears measurements when layout caches reset", () => {
        const ctx = createLayoutStoreContext();
        const store = syncPrefixLayoutStore(ctx)!;
        store.setMeasuredSize(0, "item-0", 50);

        resetLayoutCachesForDataChange(ctx.state);

        expect(store.getSize(0)).toBe(100);
        expect(store.getTotalSize()).toBe(300);
    });

    it("periodically flushes the measured average while idle and corrects the anchor", () => {
        const timers = captureTimeouts();
        try {
            const ctx = createLayoutStoreContext(10);
            const store = syncPrefixLayoutStore(ctx)!;
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
            expect(ctx.state.positions[5]).toBe(250);
            expect(requestedAdjustments).toEqual([-250]);
            expect(ctx.state.lastFlushedLayoutStoreEstimateMeasurementCount).toBe(4);
        } finally {
            timers.restore();
        }
    });

    it("defers periodic estimate flushes until recent scroll activity settles", () => {
        const timers = captureTimeouts();
        try {
            const ctx = createLayoutStoreContext(10);
            const store = syncPrefixLayoutStore(ctx)!;
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
            {
                name: "snap offsets",
                patch: (ctx: ReturnType<typeof createLayoutStoreContext>) => {
                    ctx.state.props.snapToIndices = [0];
                },
            },
            {
                name: "position component",
                patch: (ctx: ReturnType<typeof createLayoutStoreContext>) => {
                    ctx.state.props.positionComponentInternal = () => null;
                },
            },
            {
                name: "position listeners",
                patch: (ctx: ReturnType<typeof createLayoutStoreContext>) => {
                    ctx.positionListeners.set("item-0", new Set());
                },
            },
        ];

        for (const testCase of cases) {
            const ctx = createLayoutStoreContext();
            syncPrefixLayoutStore(ctx);

            testCase.patch(ctx);
            syncPrefixLayoutStore(ctx);

            expect(isPrefixLayoutStoreSupported(ctx), testCase.name).toBe(false);
            expect(ctx.state.layoutStore, testCase.name).toBeUndefined();
            expect(getActivePrefixLayoutStore(ctx), testCase.name).toBeUndefined();
        }
    });
});
