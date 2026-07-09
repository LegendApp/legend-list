import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import "../setup"; // Import global test setup

import { Platform } from "@/platform/Platform";
import * as calculateItemsInViewModule from "../../src/core/calculateItemsInView";
import { updateItemSizes } from "../../src/core/updateItemSizes";
import type { StateContext } from "../../src/state/state";
import type { InternalState } from "../../src/types.internal";
import { normalizeMaintainVisibleContentPosition } from "../../src/utils/normalizeMaintainVisibleContentPosition";
import { createMockContext } from "../__mocks__/createMockContext";

interface MeasuredContainer {
    id: number;
    itemKey: string | undefined;
    size: { width: number; height: number };
    beforeMeasureCallback?: () => void;
}

describe("updateItemSizes", () => {
    let mockCtx: StateContext;
    let mockState: InternalState;
    let prevPlatform: typeof Platform.OS;
    const measureCalls: number[] = [];

    function setupContainer({ id, itemKey, size, beforeMeasureCallback }: MeasuredContainer) {
        // peek$ reads container item keys from the values map
        mockCtx.values.set(`containerItemKey${id}` as any, itemKey as any);
        if (itemKey) {
            mockCtx.state.containerItemKeys.set(itemKey, id);
        }
        mockCtx.viewRefs.set(id, {
            current: {
                measure: (callback: any) => {
                    measureCalls.push(id);
                    beforeMeasureCallback?.();
                    callback(0, 0, size.width, size.height);
                },
            },
        } as any);
    }

    function markPending(itemKey: string) {
        mockState.userScrollAnchorReset ??= { keys: new Set() };
        mockState.userScrollAnchorReset.keys.add(itemKey);
    }

    beforeEach(() => {
        measureCalls.length = 0;
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

    it("updates only the measured item when not running from a layout effect", () => {
        const calculateSpy = spyOn(calculateItemsInViewModule, "calculateItemsInView").mockImplementation(() => {});

        setupContainer({ id: 0, itemKey: "item_0", size: { height: 999, width: 400 } });
        setupContainer({ id: 1, itemKey: "item_1", size: { height: 220, width: 400 } });
        markPending("item_1");

        updateItemSizes(mockCtx, {
            containerId: 0,
            fromLayoutEffect: false,
            itemKey: "item_0",
            size: { height: 150, width: 400 },
        });

        expect(measureCalls).toEqual([]);
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
        expect(calculateSpy).toHaveBeenCalledWith(mockCtx, { doMVCP: true });

        calculateSpy.mockRestore();
    });

    it("measures pending containers and applies all sizes in one recalc", () => {
        const calculateSpy = spyOn(calculateItemsInViewModule, "calculateItemsInView").mockImplementation(() => {});

        setupContainer({ id: 0, itemKey: "item_0", size: { height: 150, width: 400 } });
        setupContainer({ id: 1, itemKey: "item_1", size: { height: 220, width: 400 } });
        setupContainer({ id: 2, itemKey: "item_2", size: { height: 999, width: 400 } });
        markPending("item_0");
        markPending("item_1");

        updateItemSizes(mockCtx, {
            containerId: 0,
            fromLayoutEffect: true,
            itemKey: "item_0",
            size: { height: 150, width: 400 },
        });

        // The current measurement is seeded, so only the other pending container
        // needs ref.measure even though container 2 is allocated.
        expect(measureCalls).toEqual([1]);

        // All sizes applied.
        expect(mockState.sizesKnown.get("item_0")).toBe(150);
        expect(mockState.sizesKnown.get("item_1")).toBe(220);
        expect(mockState.sizesKnown.has("item_2")).toBe(false);

        // A single coherent recalc for the whole batch, not one per container.
        expect(calculateSpy).toHaveBeenCalledTimes(1);

        calculateSpy.mockRestore();
    });

    it("uses the seeded measurement before measuring remaining pending containers", () => {
        const calculateSpy = spyOn(calculateItemsInViewModule, "calculateItemsInView").mockImplementation(() => {});

        setupContainer({ id: 0, itemKey: "item_0", size: { height: 999, width: 400 } });
        setupContainer({ id: 1, itemKey: "item_1", size: { height: 220, width: 400 } });
        markPending("item_0");
        markPending("item_1");

        updateItemSizes(mockCtx, {
            containerId: 0,
            fromLayoutEffect: true,
            itemKey: "item_0",
            size: { height: 150, width: 400 },
        });

        // The seeded container already had a synchronous measurement, so only the
        // other pending container needs ref.measure.
        expect(measureCalls).toEqual([1]);
        expect(mockState.sizesKnown.get("item_0")).toBe(150);
        expect(mockState.sizesKnown.get("item_1")).toBe(220);
        expect(calculateSpy).toHaveBeenCalledTimes(1);

        calculateSpy.mockRestore();
    });

    it("applies a non-pending seeded measurement while batching pending containers", () => {
        const calculateSpy = spyOn(calculateItemsInViewModule, "calculateItemsInView").mockImplementation(() => {});

        setupContainer({ id: 0, itemKey: "item_0", size: { height: 150, width: 400 } });
        setupContainer({ id: 1, itemKey: "item_1", size: { height: 220, width: 400 } });
        markPending("item_1");

        updateItemSizes(mockCtx, {
            containerId: 0,
            fromLayoutEffect: true,
            itemKey: "item_0",
            size: { height: 175, width: 400 },
        });

        expect(measureCalls).toEqual([1]);
        expect(mockState.sizesKnown.get("item_0")).toBe(175);
        expect(mockState.sizesKnown.get("item_1")).toBe(220);
        expect(calculateSpy).toHaveBeenCalledTimes(1);

        calculateSpy.mockRestore();
    });

    it("drains pending measurements once and measures newly marked containers later", () => {
        const calculateSpy = spyOn(calculateItemsInViewModule, "calculateItemsInView").mockImplementation(() => {});

        setupContainer({ id: 0, itemKey: "item_0", size: { height: 150, width: 400 } });
        setupContainer({ id: 1, itemKey: "item_1", size: { height: 220, width: 400 } });
        markPending("item_0");
        markPending("item_1");

        updateItemSizes(mockCtx, {
            containerId: 0,
            fromLayoutEffect: true,
            itemKey: "item_0",
            size: { height: 150, width: 400 },
        });
        updateItemSizes(mockCtx, {
            containerId: 0,
            fromLayoutEffect: true,
            itemKey: "item_0",
            size: { height: 150, width: 400 },
        });
        updateItemSizes(mockCtx, {
            containerId: 0,
            fromLayoutEffect: true,
            itemKey: "item_0",
            size: { height: 150, width: 400 },
        });

        expect(measureCalls).toEqual([1]);
        expect(calculateSpy).toHaveBeenCalledTimes(1);

        measureCalls.length = 0;
        setupContainer({ id: 0, itemKey: "item_0", size: { height: 175, width: 400 } });
        markPending("item_0");

        updateItemSizes(mockCtx, {
            containerId: 0,
            fromLayoutEffect: true,
            itemKey: "item_0",
            size: { height: 175, width: 400 },
        });
        expect(measureCalls).toEqual([]);
        expect(mockState.sizesKnown.get("item_0")).toBe(175);

        calculateSpy.mockRestore();
    });

    it("ignores stale fallback frames after a new measurement batch starts", () => {
        const calculateSpy = spyOn(calculateItemsInViewModule, "calculateItemsInView").mockImplementation(() => {});
        const originalRaf = globalThis.requestAnimationFrame;
        const rafCallbacks: Array<(time: number) => void> = [];
        globalThis.requestAnimationFrame = ((callback: (time: number) => void) => {
            rafCallbacks.push(callback);
            return rafCallbacks.length;
        }) as typeof requestAnimationFrame;

        try {
            mockState.pendingLayoutEffectMeasurements = new Set(["item_0", "item_1"]);

            updateItemSizes(mockCtx, {
                containerId: 0,
                fromLayoutEffect: true,
                itemKey: "item_0",
                size: { height: 150, width: 400 },
            });
            expect(rafCallbacks.length).toBe(1);
            expect(calculateSpy).not.toHaveBeenCalled();

            updateItemSizes(mockCtx, {
                containerId: 1,
                fromLayoutEffect: true,
                itemKey: "item_1",
                size: { height: 220, width: 400 },
            });
            expect(calculateSpy).toHaveBeenCalledTimes(1);

            mockState.pendingLayoutEffectMeasurements = new Set(["item_2", "item_0"]);
            updateItemSizes(mockCtx, {
                containerId: 2,
                fromLayoutEffect: true,
                itemKey: "item_2",
                size: { height: 300, width: 400 },
            });
            expect(rafCallbacks.length).toBe(2);
            expect(calculateSpy).toHaveBeenCalledTimes(1);

            rafCallbacks[0](performance.now());
            expect(mockState.pendingLayoutEffectMeasurements).toEqual(new Set(["item_0"]));
            expect(calculateSpy).toHaveBeenCalledTimes(1);

            rafCallbacks[1](performance.now());
            expect(mockState.pendingLayoutEffectMeasurements).toBeUndefined();
            expect(calculateSpy).toHaveBeenCalledTimes(2);
        } finally {
            globalThis.requestAnimationFrame = originalRaf;
            calculateSpy.mockRestore();
        }
    });

    it("ignores a synchronous measurement when the container was recycled before callback", () => {
        const calculateSpy = spyOn(calculateItemsInViewModule, "calculateItemsInView").mockImplementation(() => {});

        setupContainer({
            beforeMeasureCallback: () => {
                mockCtx.values.set("containerItemKey0" as any, "item_2" as any);
            },
            id: 0,
            itemKey: "item_0",
            size: { height: 150, width: 400 },
        });
        setupContainer({ id: 1, itemKey: "item_1", size: { height: 170, width: 400 } });
        markPending("item_0");

        updateItemSizes(mockCtx, {
            containerId: 1,
            fromLayoutEffect: true,
            itemKey: "item_1",
            size: { height: 170, width: 400 },
        });

        expect(mockState.sizesKnown.has("item_0")).toBe(false);
        expect(mockState.sizesKnown.get("item_1")).toBe(170);
        expect(calculateSpy).toHaveBeenCalledTimes(1);

        calculateSpy.mockRestore();
    });

    it("ignores a seeded measurement when the container no longer owns that item", () => {
        const calculateSpy = spyOn(calculateItemsInViewModule, "calculateItemsInView").mockImplementation(() => {});

        setupContainer({ id: 0, itemKey: "item_0", size: { height: 150, width: 400 } });
        mockCtx.values.set("containerItemKey0" as any, "item_2" as any);
        markPending("item_0");

        updateItemSizes(mockCtx, {
            containerId: 0,
            fromLayoutEffect: true,
            itemKey: "item_0",
            size: { height: 180, width: 400 },
        });

        expect(mockState.sizesKnown.has("item_0")).toBe(false);
        expect(calculateSpy).not.toHaveBeenCalled();

        calculateSpy.mockRestore();
    });
});
