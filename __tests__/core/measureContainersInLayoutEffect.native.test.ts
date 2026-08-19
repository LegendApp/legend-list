import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import "../setup";

import * as calculateItemsInViewModule from "../../src/core/calculateItemsInView";
import { createContainerItemMetadata } from "../../src/core/containerItemMetadata";
import { measureContainersInLayoutEffect } from "../../src/core/measureContainersInLayoutEffect.native";
import { getContainerLayoutEffectScope, scheduleContainerLayout } from "../../src/core/scheduleContainerLayout";
import { Platform } from "../../src/platform/Platform";
import type { StateContext } from "../../src/state/state";
import { createMockContext } from "../__mocks__/createMockContext";

describe("measureContainersInLayoutEffect", () => {
    let ctx: StateContext;
    let previousPlatform: typeof Platform.OS;

    beforeEach(() => {
        previousPlatform = Platform.OS;
        Platform.OS = "ios";
        ctx = createMockContext(
            {
                containerItemKey0: "item_0",
                containerItemKey1: "item_1",
                otherAxisSize: 400,
                readyToRender: true,
            },
            {
                didContainersLayout: true,
                endBuffered: 1,
                indexByKey: new Map([
                    ["item_0", 0],
                    ["item_1", 1],
                ]),
                props: {
                    data: [{ id: "item_0" }, { id: "item_1" }],
                    estimatedItemSize: 100,
                },
                sizes: new Map([
                    ["item_0", 100],
                    ["item_1", 100],
                ]),
                sizesKnown: new Map([
                    ["item_0", 100],
                    ["item_1", 100],
                ]),
                startBuffered: 0,
            },
        );
        ctx.state.containerItemKeys.set("item_0", 0);
        ctx.state.containerItemKeys.set("item_1", 1);
    });

    afterEach(() => {
        Platform.OS = previousPlatform;
    });

    it("reveals a pending container when measurement completes after the layout-effect pass", () => {
        let measureCallback: ((x: number, y: number, width: number, height: number) => void) | undefined;
        const metadata = createContainerItemMetadata(ctx.state, 0, ctx.state.props.data![0]);
        metadata.measurementPending = true;
        ctx.state.containerItemMetadata.set(0, metadata);
        ctx.viewRefs.set(0, {
            current: {
                measure: (callback: NonNullable<typeof measureCallback>) => {
                    measureCallback = callback;
                },
            },
        } as any);

        measureContainersInLayoutEffect(ctx, new Set([0]));
        expect(ctx.state.containerItemMetadata.get(0)?.measurementPending).toBe(true);
        expect(ctx.values.get("containerMeasurementEpoch0")).toBeUndefined();
        measureCallback?.(0, 0, 400, 170);

        expect(ctx.state.sizesKnown.get("item_0")).toBe(170);
        expect(ctx.state.containerItemMetadata.get(0)?.measurementPending).toBe(false);
        expect(ctx.values.get("containerMeasurementEpoch0")).toBe(1);
    });

    it("collects synchronous Fabric measurements before one recalculation", () => {
        const calculateSpy = spyOn(calculateItemsInViewModule, "calculateItemsInView").mockImplementation(() => {});
        ctx.viewRefs.set(0, {
            current: {
                measure: (callback: any) => callback(0, 0, 400, 150),
            },
        } as any);
        ctx.viewRefs.set(1, {
            current: {
                measure: (callback: any) => callback(0, 0, 400, 220),
            },
        } as any);

        measureContainersInLayoutEffect(ctx);

        expect(ctx.state.sizesKnown.get("item_0")).toBe(150);
        expect(ctx.state.sizesKnown.get("item_1")).toBe(220);
        expect(calculateSpy).toHaveBeenCalledTimes(1);
        calculateSpy.mockRestore();
    });

    it("reveals a measurement-pending container only after synchronous recalculation", () => {
        const itemData = ctx.state.props.data![0];
        const metadata = createContainerItemMetadata(ctx.state, 0, itemData);
        metadata.measurementPending = true;
        ctx.state.containerItemMetadata.set(0, metadata);
        const pendingDuringRecalculation: boolean[] = [];
        const calculateSpy = spyOn(calculateItemsInViewModule, "calculateItemsInView").mockImplementation(() => {
            pendingDuringRecalculation.push(ctx.state.containerItemMetadata.get(0)?.measurementPending === true);
        });
        ctx.viewRefs.set(0, {
            current: {
                measure: (callback: any) => callback(0, 0, 400, 175),
            },
        } as any);

        measureContainersInLayoutEffect(ctx, new Set([0]));

        expect(pendingDuringRecalculation).toEqual([true]);
        expect(ctx.state.containerItemMetadata.get(0)?.measurementPending).toBe(false);
        expect(ctx.values.get("containerMeasurementEpoch0")).toBe(1);
        calculateSpy.mockRestore();
    });

    it("does not reveal a reassigned container from a stale delayed measurement", () => {
        const firstMetadata = createContainerItemMetadata(ctx.state, 0, ctx.state.props.data![0]);
        firstMetadata.measurementPending = true;
        ctx.state.containerItemMetadata.set(0, firstMetadata);
        let measureCallback: ((x: number, y: number, width: number, height: number) => void) | undefined;
        ctx.viewRefs.set(0, {
            current: {
                measure: (callback: NonNullable<typeof measureCallback>) => {
                    measureCallback = callback;
                },
            },
        } as any);

        measureContainersInLayoutEffect(ctx, new Set([0]));

        ctx.values.set("containerItemKey0", "item_1");
        ctx.state.containerItemGenerations[0] = (ctx.state.containerItemGenerations[0] ?? 0) + 1;
        const secondMetadata = createContainerItemMetadata(ctx.state, 1, ctx.state.props.data![1]);
        secondMetadata.measurementPending = true;
        ctx.state.containerItemMetadata.set(0, secondMetadata);
        measureCallback?.(0, 0, 400, 175);

        expect(ctx.state.containerItemMetadata.get(0)?.measurementPending).toBe(true);
        expect(ctx.values.get("containerMeasurementEpoch0")).toBeUndefined();
    });

    it("measures only containers assigned since the previous commit", () => {
        const calculateSpy = spyOn(calculateItemsInViewModule, "calculateItemsInView").mockImplementation(() => {});
        ctx.viewRefs.set(0, {
            current: {
                measure: (callback: any) => callback(0, 0, 400, 150),
            },
        } as any);
        ctx.viewRefs.set(1, {
            current: {
                measure: (callback: any) => callback(0, 0, 400, 220),
            },
        } as any);
        scheduleContainerLayout(ctx, 1);

        measureContainersInLayoutEffect(ctx, getContainerLayoutEffectScope(ctx)!);

        expect(ctx.state.sizesKnown.get("item_0")).toBe(100);
        expect(ctx.state.sizesKnown.get("item_1")).toBe(220);
        expect(calculateSpy).toHaveBeenCalledTimes(1);
        calculateSpy.mockRestore();
    });

    it("also measures mounted containers with pending anchor-reset keys", () => {
        const calculateSpy = spyOn(calculateItemsInViewModule, "calculateItemsInView").mockImplementation(() => {});
        ctx.state.userScrollAnchorReset = { keys: new Set(["item_0"]) };
        ctx.viewRefs.set(0, {
            current: {
                measure: (callback: any) => callback(0, 0, 400, 150),
            },
        } as any);
        ctx.viewRefs.set(1, {
            current: {
                measure: (callback: any) => callback(0, 0, 400, 220),
            },
        } as any);
        scheduleContainerLayout(ctx, 1);

        measureContainersInLayoutEffect(ctx, getContainerLayoutEffectScope(ctx)!);

        expect(ctx.state.sizesKnown.get("item_0")).toBe(150);
        expect(ctx.state.sizesKnown.get("item_1")).toBe(220);
        expect(ctx.state.userScrollAnchorReset?.keys.has("item_0") ?? false).toBe(false);
        expect(calculateSpy).toHaveBeenCalledTimes(1);
        calculateSpy.mockRestore();
    });

    it("skips native measurement for authoritative fixed sizes", () => {
        const calculateSpy = spyOn(calculateItemsInViewModule, "calculateItemsInView").mockImplementation(() => {});
        let fixedMeasureCalls = 0;
        let dynamicMeasureCalls = 0;
        ctx.state.props.getFixedItemSize = (item: { id: string }) => (item.id === "item_0" ? 100 : undefined);
        const fixedMetadata = createContainerItemMetadata(ctx.state, 0, ctx.state.props.data![0]);
        fixedMetadata.measurementPending = true;
        ctx.state.containerItemMetadata.set(0, fixedMetadata);
        ctx.viewRefs.set(0, {
            current: {
                measure: () => {
                    fixedMeasureCalls++;
                },
            },
        } as any);
        ctx.viewRefs.set(1, {
            current: {
                measure: (callback: any) => {
                    dynamicMeasureCalls++;
                    callback(0, 0, 400, 220);
                },
            },
        } as any);

        measureContainersInLayoutEffect(ctx);

        expect(fixedMeasureCalls).toBe(0);
        expect(dynamicMeasureCalls).toBe(1);
        expect(ctx.state.sizesKnown.get("item_0")).toBe(100);
        expect(ctx.state.sizesKnown.get("item_1")).toBe(220);
        expect(ctx.state.containerItemMetadata.get(0)?.measurementPending).toBe(false);
        expect(ctx.values.get("containerMeasurementEpoch0")).toBe(1);
        expect(calculateSpy).toHaveBeenCalledTimes(1);
        calculateSpy.mockRestore();
    });

    it("reuses the allocated item type and fixed size across committed measurement passes", () => {
        let fixedSizeCalls = 0;
        let itemTypeCalls = 0;
        let measureCalls = 0;
        ctx.state.props.getItemType = () => {
            itemTypeCalls++;
            return "fixed";
        };
        ctx.state.props.getFixedItemSize = () => {
            fixedSizeCalls++;
            return 100;
        };
        ctx.viewRefs.set(0, {
            current: {
                measure: () => {
                    measureCalls++;
                },
            },
        } as any);
        const itemData = ctx.state.props.data![0];
        const itemType = ctx.state.props.getItemType(itemData, 0);
        ctx.state.containerItemMetadata.set(0, createContainerItemMetadata(ctx.state, 0, itemData, itemType));

        measureContainersInLayoutEffect(ctx, new Set([0]));
        measureContainersInLayoutEffect(ctx, new Set([0]));

        expect(itemTypeCalls).toBe(1);
        expect(fixedSizeCalls).toBe(1);
        expect(measureCalls).toBe(0);
    });

    it("caches a dynamic fixed-size result without skipping its measurements", () => {
        let fixedSizeCalls = 0;
        let itemTypeCalls = 0;
        let measureCalls = 0;
        ctx.state.props.getItemType = () => {
            itemTypeCalls++;
            return "dynamic";
        };
        ctx.state.props.getFixedItemSize = () => {
            fixedSizeCalls++;
            return undefined;
        };
        ctx.viewRefs.set(0, {
            current: {
                measure: (callback: any) => {
                    measureCalls++;
                    callback(0, 0, 400, 120);
                },
            },
        } as any);
        const itemData = ctx.state.props.data![0];
        const itemType = ctx.state.props.getItemType(itemData, 0);
        ctx.state.containerItemMetadata.set(0, createContainerItemMetadata(ctx.state, 0, itemData, itemType));

        measureContainersInLayoutEffect(ctx, new Set([0]));
        measureContainersInLayoutEffect(ctx, new Set([0]));

        expect(itemTypeCalls).toBe(1);
        expect(fixedSizeCalls).toBe(1);
        expect(measureCalls).toBe(2);
        expect(ctx.state.sizesKnown.get("item_0")).toBe(120);
    });

    it("refreshes container metadata when its callback or data epoch changes", () => {
        let fixedSizeCalls = 0;
        let itemTypeCalls = 0;
        let measureCalls = 0;
        ctx.state.props.getItemType = () => {
            itemTypeCalls++;
            return "fixed";
        };
        ctx.state.props.getFixedItemSize = () => {
            fixedSizeCalls++;
            return 100;
        };
        const itemData = ctx.state.props.data![0];
        const itemType = ctx.state.props.getItemType(itemData, 0);
        ctx.state.containerItemMetadata.set(0, createContainerItemMetadata(ctx.state, 0, itemData, itemType));
        ctx.viewRefs.set(0, {
            current: {
                measure: (callback: any) => {
                    measureCalls++;
                    callback(0, 0, 400, 100);
                },
            },
        } as any);

        measureContainersInLayoutEffect(ctx, new Set([0]));
        ctx.state.props.getFixedItemSize = () => {
            fixedSizeCalls++;
            return 100;
        };
        measureContainersInLayoutEffect(ctx, new Set([0]));
        ctx.state.dataChangeEpoch++;
        measureContainersInLayoutEffect(ctx, new Set([0]));
        ctx.state.props.getFixedItemSize = undefined;
        measureContainersInLayoutEffect(ctx, new Set([0]));

        expect(itemTypeCalls).toBe(2);
        expect(fixedSizeCalls).toBe(3);
        expect(measureCalls).toBe(1);
        expect(ctx.state.containerItemMetadata.get(0)?.didResolveFixedItemSize).toBe(false);
        expect(ctx.state.containerItemMetadata.get(0)?.fixedItemSize).toBeUndefined();
    });

    it("resolves pending anchor-reset keys when their fixed measurement is skipped", () => {
        ctx.state.props.getFixedItemSize = () => 100;
        ctx.state.userScrollAnchorReset = { keys: new Set(["item_0"]) };
        let measureCalls = 0;
        ctx.viewRefs.set(0, {
            current: {
                measure: () => {
                    measureCalls++;
                },
            },
        } as any);
        scheduleContainerLayout(ctx, 1);

        measureContainersInLayoutEffect(ctx, getContainerLayoutEffectScope(ctx)!);

        expect(measureCalls).toBe(0);
        expect(ctx.state.userScrollAnchorReset).toBeUndefined();
    });

    it("measures fixed items when the cached size is not authoritative", () => {
        ctx.state.props.getFixedItemSize = () => 120;
        let measureCalls = 0;
        ctx.viewRefs.set(0, {
            current: {
                measure: (callback: any) => {
                    measureCalls++;
                    callback(0, 0, 400, 120);
                },
            },
        } as any);

        measureContainersInLayoutEffect(ctx);

        expect(measureCalls).toBe(1);
        expect(ctx.state.sizesKnown.get("item_0")).toBe(120);
    });

    it("measures fixed items when the other axis still needs discovery", () => {
        ctx.state.props.getFixedItemSize = () => 100;
        ctx.state.needsOtherAxisSize = true;
        let measureCalls = 0;
        ctx.viewRefs.set(0, {
            current: {
                measure: (callback: any) => {
                    measureCalls++;
                    callback(0, 0, 450, 100);
                },
            },
        } as any);

        measureContainersInLayoutEffect(ctx);

        expect(measureCalls).toBe(1);
        expect(ctx.values.get("otherAxisSize")).toBe(450);
    });

    it("accepts the newest late measurement from consecutive same-key passes", () => {
        const calculateSpy = spyOn(calculateItemsInViewModule, "calculateItemsInView").mockImplementation(() => {});
        const measureCallbacks: Array<(x: number, y: number, width: number, height: number) => void> = [];
        ctx.viewRefs.set(0, {
            current: {
                measure: (callback: (typeof measureCallbacks)[number]) => {
                    measureCallbacks.push(callback);
                },
            },
        } as any);

        measureContainersInLayoutEffect(ctx, new Set([0]));
        measureContainersInLayoutEffect(ctx, new Set([0]));

        expect(measureCallbacks).toHaveLength(2);
        measureCallbacks[1](0, 0, 400, 160);
        measureCallbacks[0](0, 0, 400, 120);

        expect(ctx.state.sizesKnown.get("item_0")).toBe(160);
        expect(calculateSpy).toHaveBeenCalledTimes(1);
        calculateSpy.mockRestore();
    });

    it("accepts the newest late measurement after a container cycles back to the same item key", () => {
        const calculateSpy = spyOn(calculateItemsInViewModule, "calculateItemsInView").mockImplementation(() => {});
        const measureCallbacks: Array<(x: number, y: number, width: number, height: number) => void> = [];
        ctx.viewRefs.set(0, {
            current: {
                measure: (callback: (typeof measureCallbacks)[number]) => {
                    measureCallbacks.push(callback);
                },
            },
        } as any);

        measureContainersInLayoutEffect(ctx, new Set([0]));
        ctx.values.set("containerItemKey0", "item_1");
        ctx.state.containerItemGenerations[0] = 1;
        ctx.values.set("containerItemKey0", "item_0");
        ctx.state.containerItemGenerations[0] = 2;
        measureContainersInLayoutEffect(ctx, new Set([0]));

        expect(measureCallbacks).toHaveLength(2);
        expect(calculateSpy).not.toHaveBeenCalled();
        measureCallbacks[1](0, 0, 400, 160);
        measureCallbacks[0](0, 0, 400, 120);

        expect(ctx.state.sizesKnown.get("item_0")).toBe(160);
        expect(calculateSpy).toHaveBeenCalledTimes(1);
        calculateSpy.mockRestore();
    });
});
