import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import "../setup"; // Import global test setup

import { Platform } from "@/platform/Platform";
import * as calculateItemsInViewModule from "../../src/core/calculateItemsInView";
import { setLayoutStoreMeasuredSize, syncLayoutStoreStructure } from "../../src/core/layoutStoreLifecycle";
import { batchItemSizeUpdates, updateItemSizes, updateItemSizesBatch } from "../../src/core/updateItemSizes";
import { listen$, type StateContext } from "../../src/state/state";
import type { InternalState } from "../../src/types.internal";
import { normalizeMaintainVisibleContentPosition } from "../../src/utils/normalizeMaintainVisibleContentPosition";
import * as requestAdjustModule from "../../src/utils/requestAdjust";
import { createMockContext } from "../__mocks__/createMockContext";

describe("updateItemSizes", () => {
    let mockCtx: StateContext;
    let mockState: InternalState;
    let prevPlatform: typeof Platform.OS;
    function assignContainer(id: number, itemKey: string | undefined) {
        // peek$ reads container item keys from the values map
        mockCtx.values.set(`containerItemKey${id}` as any, itemKey as any);
        if (itemKey) {
            mockCtx.state.containerItemKeys.set(itemKey, id);
        }
    }

    function markPending(itemKey: string) {
        mockState.userScrollAnchorReset ??= { keys: new Set() };
        mockState.userScrollAnchorReset.keys.add(itemKey);
    }

    beforeEach(() => {
        prevPlatform = Platform.OS;
        // Native path so runOrScheduleMVCPRecalculate runs calculateItemsInView synchronously.
        Platform.OS = "ios";

        mockCtx = createMockContext(
            {
                numContainers: 3,
                otherAxisSize: 400,
                readyToRender: true,
            },
            {
                didContainersLayout: true,
                didFinishInitialScroll: true,
                endBuffered: 4,
                indexByKey: new Map([
                    ["item_0", 0],
                    ["item_1", 1],
                    ["item_2", 2],
                ]),
                lastLayout: { height: 600, width: 400, x: 0, y: 0 },
                props: {
                    data: [{ id: "item1" }, { id: "item2" }, { id: "item3" }],
                    estimatedItemSize: 100,
                    maintainVisibleContentPosition: normalizeMaintainVisibleContentPosition(false),
                },
                scrollLength: 600,
                startBuffered: 0,
                totalSize: 0,
            },
        );
        mockState = mockCtx.state;
    });

    afterEach(() => {
        Platform.OS = prevPlatform;
    });

    it("schedules estimate sampling when an equal-to-estimate measurement completes the threshold", () => {
        const ctx = createMockContext(
            { containerItemKey3: "k3" },
            {
                didContainersLayout: true,
                didFinishInitialScroll: true,
                idCache: ["k0", "k1", "k2", "k3"],
                indexByKey: new Map([["k3", 3]]),
                props: {
                    data: Array.from({ length: 10 }, (_, index) => ({ id: `k${index}` })),
                    estimatedItemSize: 100,
                },
            },
        );
        const store = syncLayoutStoreStructure(ctx)!;
        ctx.state.layoutStoreRuntime!.didFlushInitialEstimate = true;
        for (let index = 0; index < 3; index++) setLayoutStoreMeasuredSize(ctx, index, 50);
        expect(ctx.state.scheduledWork.has("layoutStoreEstimateFlush")).toBe(false);
        updateItemSizesBatch(ctx, [{ containerId: 3, itemKey: "k3", size: { height: 100, width: 400 } }]);
        expect(store.getMeasuredCount()).toBe(4);
        expect(ctx.state.scheduledWork.has("layoutStoreEstimateFlush")).toBe(true);
        ctx.state.scheduledWork.dispose();
    });

    it("updates only the measured item without draining unrelated anchor resets", () => {
        const calculateSpy = spyOn(calculateItemsInViewModule, "calculateItemsInView").mockImplementation(() => {});

        assignContainer(0, "item_0");
        assignContainer(1, "item_1");
        markPending("item_1");

        updateItemSizes(mockCtx, {
            containerId: 0,
            itemKey: "item_0",
            size: { height: 150, width: 400 },
        });

        expect(mockState.sizesKnown.get("item_0")).toBe(150);
        expect(mockState.sizesKnown.has("item_1")).toBe(false);
        expect(mockState.userScrollAnchorReset?.keys).toEqual(new Set(["item_1"]));
        expect(calculateSpy).toHaveBeenCalledTimes(1);

        calculateSpy.mockRestore();
    });

    it("recalculates initial layout when the last unknown size matches the estimate", () => {
        const calculateSpy = spyOn(calculateItemsInViewModule, "calculateItemsInView").mockImplementation(() => {});

        mockState.didContainersLayout = false;
        mockState.startBuffered = 0;
        mockState.endBuffered = 1;
        mockState.containerItemKeys.set("item_0", 0);
        mockState.containerItemKeys.set("item_1", 1);
        mockState.sizesKnown.set("item_0", 100);

        updateItemSizes(mockCtx, {
            itemKey: "item_1",
            size: { height: 100, width: 400 },
        });

        expect(mockState.sizesKnown.get("item_1")).toBe(100);
        expect(calculateSpy).toHaveBeenCalledTimes(1);
        expect(calculateSpy).toHaveBeenCalledWith(mockCtx, {
            doMVCP: true,
            mvcpAdjustmentSource: "item-size",
        });

        calculateSpy.mockRestore();
    });

    it("prepares MVCP before mutating the layout store for measured size changes", () => {
        const calculateSpy = spyOn(calculateItemsInViewModule, "calculateItemsInView").mockImplementation(() => {});
        const requestAdjustSpy = spyOn(requestAdjustModule, "requestAdjust");

        mockState.props.data = Array.from({ length: 5 }, (_, index) => ({ id: `item_${index}` }));
        mockState.props.maintainVisibleContentPosition = normalizeMaintainVisibleContentPosition(true);
        mockState.props.estimatedItemSize = 100;
        mockState.idCache = ["item_0", "item_1", "item_2", "item_3", "item_4"];
        mockState.indexByKey = new Map(mockState.idCache.map((id, index) => [id, index]));
        mockState.idsInView = ["item_2"];
        mockState.scroll = 200;
        mockState.scrollLength = 300;
        mockState.startBuffered = 0;
        mockState.endBuffered = 4;
        mockCtx.values.set("readyToRender", true);
        mockCtx.values.set("totalSize", 500);
        for (const id of mockState.idCache) {
            mockState.sizesKnown.set(id, 100);
        }
        syncLayoutStoreStructure(mockCtx);

        try {
            updateItemSizes(mockCtx, {
                itemKey: "item_0",
                size: { height: 150, width: 400 },
            });

            expect(requestAdjustSpy).toHaveBeenCalledWith(mockCtx, 50, undefined);
            expect(mockState.layoutStoreRuntime?.store.getOffset(2)).toBe(250);
            expect(calculateSpy).toHaveBeenCalledWith(mockCtx, { doMVCP: true, mvcpAdjustmentSource: "item-size" });
        } finally {
            calculateSpy.mockRestore();
            requestAdjustSpy.mockRestore();
        }
    });

    it("applies all measurements from one committed layout pass in one recalc", () => {
        const calculateSpy = spyOn(calculateItemsInViewModule, "calculateItemsInView").mockImplementation(() => {});

        assignContainer(0, "item_0");
        assignContainer(1, "item_1");
        assignContainer(2, "item_2");

        updateItemSizesBatch(mockCtx, [
            {
                containerId: 0,
                itemKey: "item_0",
                size: { height: 150, width: 400 },
            },
            {
                containerId: 1,
                itemKey: "item_1",
                size: { height: 220, width: 400 },
            },
        ]);

        // All sizes applied.
        expect(mockState.sizesKnown.get("item_0")).toBe(150);
        expect(mockState.sizesKnown.get("item_1")).toBe(220);
        expect(mockState.sizesKnown.has("item_2")).toBe(false);

        // A single coherent recalc for the whole batch, not one per container.
        expect(calculateSpy).toHaveBeenCalledTimes(1);

        calculateSpy.mockRestore();
    });

    for (const scenario of ["growth", "canceling changes", "initial estimate", "throwing callback"] as const) {
        it(`batches total-size notifications through the real layout store: ${scenario}`, () => {
            mockState.props.data = Array.from({ length: 3 }, (_, index) => ({ id: `item_${index}` }));
            mockState.idCache = mockState.props.data.map((item) => item.id);
            mockState.startNoBuffer = 0;
            mockState.endNoBuffer = 1;
            const store = syncLayoutStoreStructure(mockCtx)!;
            mockState.layoutStoreRuntime!.didFlushInitialEstimate = scenario !== "initial estimate";
            mockState.totalSize = 300;
            mockCtx.values.set("totalSize", 300);
            const totals: number[] = [];
            listen$(mockCtx, "totalSize", (value) => totals.push(value));
            const expectedTotal =
                scenario === "canceling changes"
                    ? 300
                    : scenario === "initial estimate"
                      ? 555
                      : scenario === "throwing callback"
                        ? 350
                        : 470;
            const calculateSpy = spyOn(calculateItemsInViewModule, "calculateItemsInView").mockImplementation(() => {
                expect(mockCtx.values.get("totalSize")).toBe(expectedTotal);
            });
            try {
                if (scenario === "throwing callback") {
                    mockState.props.onItemSizeChanged = () => {
                        throw new Error("item callback failed");
                    };
                }
                const measure = () =>
                    updateItemSizesBatch(mockCtx, [
                        { itemKey: "item_0", size: { height: 150, width: 400 } },
                        {
                            itemKey: "item_1",
                            size: { height: scenario === "canceling changes" ? 50 : 220, width: 400 },
                        },
                    ]);
                if (scenario === "throwing callback") expect(measure).toThrow("item callback failed");
                else measure();
                expect(store.getTotalSize()).toBe(expectedTotal);
                expect(mockState.totalSize).toBe(expectedTotal);
                expect(totals).toEqual(scenario === "canceling changes" ? [] : [expectedTotal]);
                expect(calculateSpy).toHaveBeenCalledTimes(scenario === "throwing callback" ? 0 : 1);
            } finally {
                calculateSpy.mockRestore();
                mockState.scheduledWork.dispose();
            }
        });
    }

    it("publishes measured totals once before scroll recalculation", () => {
        mockCtx.values.set("totalSize", 300);
        for (let index = 0; index < 3; index++) {
            mockState.sizes.set(`item_${index}`, 100);
        }
        const totals: number[] = [];
        listen$(mockCtx, "totalSize", (value) => totals.push(value));
        const calculateSpy = spyOn(calculateItemsInViewModule, "calculateItemsInView").mockImplementation(() => {
            expect(mockCtx.values.get("totalSize")).toBe(470);
            expect(mockState.totalSize).toBe(470);
        });
        try {
            updateItemSizesBatch(mockCtx, [
                { itemKey: "item_0", size: { height: 150, width: 400 } },
                { itemKey: "item_1", size: { height: 220, width: 400 } },
            ]);
            expect(totals).toEqual([470]);
            expect(calculateSpy).toHaveBeenCalledTimes(1);
        } finally {
            calculateSpy.mockRestore();
        }
    });

    it("does not publish intermediate totals when measurement changes cancel out", () => {
        mockCtx.values.set("totalSize", 300);
        for (let index = 0; index < 3; index++) {
            mockState.sizes.set(`item_${index}`, 100);
        }
        const totals: number[] = [];
        listen$(mockCtx, "totalSize", (value) => totals.push(value));
        const calculateSpy = spyOn(calculateItemsInViewModule, "calculateItemsInView").mockImplementation(() => {});
        try {
            updateItemSizesBatch(mockCtx, [
                { itemKey: "item_0", size: { height: 150, width: 400 } },
                { itemKey: "item_1", size: { height: 50, width: 400 } },
            ]);
            expect(totals).toEqual([]);
            expect(mockState.totalSize).toBe(300);
            expect(mockState.sizesKnown.get("item_0")).toBe(150);
            expect(mockState.sizesKnown.get("item_1")).toBe(50);
        } finally {
            calculateSpy.mockRestore();
        }
    });

    it("publishes a partial initial measurement batch without exposing uncached estimates", () => {
        mockState.didContainersLayout = false;
        const totals: number[] = [];
        listen$(mockCtx, "totalSize", (value) => totals.push(value));
        const calculateSpy = spyOn(calculateItemsInViewModule, "calculateItemsInView").mockImplementation(() => {});
        try {
            updateItemSizesBatch(mockCtx, [
                { itemKey: "item_0", size: { height: 150, width: 400 } },
                { itemKey: "item_1", size: { height: 220, width: 400 } },
            ]);
            expect(totals).toEqual([370]);
            expect(mockState.totalSize).toBe(370);
            expect(calculateSpy).not.toHaveBeenCalled();
        } finally {
            calculateSpy.mockRestore();
        }
    });

    it("publishes applied measurements even if onItemSizeChanged throws", () => {
        const totals: number[] = [];
        listen$(mockCtx, "totalSize", (value) => totals.push(value));
        mockState.props.onItemSizeChanged = () => {
            throw new Error("item callback failed");
        };
        expect(() => updateItemSizesBatch(mockCtx, [{ itemKey: "item_0", size: { height: 150, width: 400 } }])).toThrow(
            "item callback failed",
        );
        expect(totals).toEqual([150]);
        expect(mockCtx.values.get("totalSize")).toBe(mockState.totalSize);
    });

    it("keeps an old-architecture initial shrink pending instead of publishing it", () => {
        mock.module("@/constants-platform", () => ({ IsNewArchitecture: false }));
        mockCtx.values.set("totalSize", 300);
        mockState.sizes.set("item_0", 100);
        mockState.initialScroll = { index: 0 };
        const totals: number[] = [];
        listen$(mockCtx, "totalSize", (value) => totals.push(value));
        const calculateSpy = spyOn(calculateItemsInViewModule, "calculateItemsInView").mockImplementation(() => {});
        try {
            updateItemSizesBatch(mockCtx, [{ itemKey: "item_0", size: { height: 50, width: 400 } }]);
            expect(mockState.sizesKnown.get("item_0")).toBe(50);
            expect(mockState.pendingTotalSize).toBe(250);
            expect(mockState.totalSize).toBe(300);
            expect(mockCtx.values.get("totalSize")).toBe(300);
            expect(totals).toEqual([]);
        } finally {
            calculateSpy.mockRestore();
        }
    });

    it("preserves temporary padding compensation when measurements leave the total unchanged", () => {
        mockCtx.values.set("totalSize", 340);
        mockState.totalSize = 300;
        mockState.sizes.set("item_0", 100);
        mockState.sizesKnown.set("item_0", 100);
        const totals: number[] = [];
        listen$(mockCtx, "totalSize", (value) => totals.push(value));

        updateItemSizesBatch(mockCtx, [{ itemKey: "item_0", size: { height: 100, width: 400 } }]);

        expect(mockState.totalSize).toBe(300);
        expect(mockCtx.values.get("totalSize")).toBe(340);
        expect(totals).toEqual([]);
    });

    it("flushes and resets a synchronous batch when a callback throws", () => {
        const calculateSpy = spyOn(calculateItemsInViewModule, "calculateItemsInView").mockImplementation(() => {});
        assignContainer(0, "item_0");
        assignContainer(1, "item_1");

        expect(() => {
            batchItemSizeUpdates(() => {
                updateItemSizes(mockCtx, {
                    containerId: 0,
                    itemKey: "item_0",
                    size: { height: 150, width: 400 },
                });
                throw new Error("observer callback failed");
            });
        }).toThrow("observer callback failed");

        expect(mockState.sizesKnown.get("item_0")).toBe(150);
        expect(calculateSpy).toHaveBeenCalledTimes(1);

        updateItemSizes(mockCtx, {
            containerId: 1,
            itemKey: "item_1",
            size: { height: 220, width: 400 },
        });
        expect(mockState.sizesKnown.get("item_1")).toBe(220);
        expect(calculateSpy).toHaveBeenCalledTimes(2);
        calculateSpy.mockRestore();
    });

    it("ignores a stale container assignment without dropping current measurements from the batch", () => {
        const calculateSpy = spyOn(calculateItemsInViewModule, "calculateItemsInView").mockImplementation(() => {});

        assignContainer(0, "item_2");
        assignContainer(1, "item_1");

        updateItemSizesBatch(mockCtx, [
            {
                containerId: 0,
                itemKey: "item_0",
                size: { height: 150, width: 400 },
            },
            {
                containerId: 1,
                itemKey: "item_1",
                size: { height: 220, width: 400 },
            },
        ]);

        expect(mockState.sizesKnown.has("item_0")).toBe(false);
        expect(mockState.sizesKnown.get("item_1")).toBe(220);
        expect(calculateSpy).toHaveBeenCalledTimes(1);

        calculateSpy.mockRestore();
    });

    it("clears measured anchor-reset keys while applying unrelated committed measurements", () => {
        const calculateSpy = spyOn(calculateItemsInViewModule, "calculateItemsInView").mockImplementation(() => {});

        assignContainer(0, "item_0");
        assignContainer(1, "item_1");
        markPending("item_1");

        updateItemSizesBatch(mockCtx, [
            {
                containerId: 0,
                itemKey: "item_0",
                size: { height: 175, width: 400 },
            },
            {
                containerId: 1,
                itemKey: "item_1",
                size: { height: 220, width: 400 },
            },
        ]);

        expect(mockState.sizesKnown.get("item_0")).toBe(175);
        expect(mockState.sizesKnown.get("item_1")).toBe(220);
        expect(mockState.userScrollAnchorReset).toBeUndefined();
        expect(calculateSpy).toHaveBeenCalledTimes(1);

        calculateSpy.mockRestore();
    });

    it("recalculates independently for consecutive committed layout passes", () => {
        const calculateSpy = spyOn(calculateItemsInViewModule, "calculateItemsInView").mockImplementation(() => {});

        assignContainer(0, "item_0");
        assignContainer(1, "item_1");
        updateItemSizesBatch(mockCtx, [
            { containerId: 0, itemKey: "item_0", size: { height: 150, width: 400 } },
            { containerId: 1, itemKey: "item_1", size: { height: 220, width: 400 } },
        ]);
        expect(calculateSpy).toHaveBeenCalledTimes(1);

        updateItemSizesBatch(mockCtx, [{ containerId: 0, itemKey: "item_0", size: { height: 175, width: 400 } }]);
        expect(mockState.sizesKnown.get("item_0")).toBe(175);
        expect(calculateSpy).toHaveBeenCalledTimes(2);

        calculateSpy.mockRestore();
    });

    it("does not schedule a frame fallback for a committed measurement batch", () => {
        const calculateSpy = spyOn(calculateItemsInViewModule, "calculateItemsInView").mockImplementation(() => {});
        const originalRaf = globalThis.requestAnimationFrame;
        const rafCallbacks: Array<(time: number) => void> = [];
        globalThis.requestAnimationFrame = ((callback: (time: number) => void) => {
            rafCallbacks.push(callback);
            return rafCallbacks.length;
        }) as typeof requestAnimationFrame;

        try {
            assignContainer(0, "item_0");
            assignContainer(1, "item_1");
            updateItemSizesBatch(mockCtx, [
                { containerId: 0, itemKey: "item_0", size: { height: 150, width: 400 } },
                { containerId: 1, itemKey: "item_1", size: { height: 220, width: 400 } },
            ]);

            expect(rafCallbacks).toHaveLength(0);
            expect(calculateSpy).toHaveBeenCalledTimes(1);
        } finally {
            globalThis.requestAnimationFrame = originalRaf;
            calculateSpy.mockRestore();
        }
    });

    it("ignores a measurement when the container no longer owns that item", () => {
        const calculateSpy = spyOn(calculateItemsInViewModule, "calculateItemsInView").mockImplementation(() => {});

        assignContainer(0, "item_0");
        mockCtx.values.set("containerItemKey0" as any, "item_2" as any);
        markPending("item_0");

        updateItemSizes(mockCtx, {
            containerId: 0,
            itemKey: "item_0",
            size: { height: 180, width: 400 },
        });

        expect(mockState.sizesKnown.has("item_0")).toBe(false);
        expect(calculateSpy).not.toHaveBeenCalled();

        calculateSpy.mockRestore();
    });
});
