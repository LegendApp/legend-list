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
                containerLayoutReady0: false,
                containerLayoutReady1: false,
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
                    // Reveal only runs for lists that opted into hiding.
                    hideItemsUntilMeasured: true,
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
        expect(ctx.values.get("containerLayoutReady0")).toBe(true);
        expect(ctx.values.get("containerLayoutReady1")).toBe(true);
        expect(calculateSpy).toHaveBeenCalledTimes(1);
        calculateSpy.mockRestore();
    });

    it("skips per-container reveal bookkeeping when hiding is disabled", () => {
        const calculateSpy = spyOn(calculateItemsInViewModule, "calculateItemsInView").mockImplementation(() => {});
        let hideItemsUntilMeasuredReads = 0;
        Object.defineProperty(ctx.state.props, "hideItemsUntilMeasured", {
            configurable: true,
            get: () => {
                hideItemsUntilMeasuredReads++;
                return false;
            },
        });
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

        expect(hideItemsUntilMeasuredReads).toBe(1);
        expect(ctx.values.get("containerLayoutReady0")).toBe(false);
        expect(ctx.values.get("containerLayoutReady1")).toBe(false);
        expect(ctx.state.sizesKnown.get("item_0")).toBe(150);
        expect(ctx.state.sizesKnown.get("item_1")).toBe(220);
        expect(calculateSpy).toHaveBeenCalledTimes(1);
        calculateSpy.mockRestore();
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
        expect(ctx.values.get("containerLayoutReady0")).toBe(false);
        expect(ctx.values.get("containerLayoutReady1")).toBe(true);
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
        expect(ctx.values.get("containerLayoutReady0")).toBe(true);
        expect(ctx.values.get("containerLayoutReady1")).toBe(true);
        expect(ctx.state.sizesKnown.get("item_0")).toBe(100);
        expect(ctx.state.sizesKnown.get("item_1")).toBe(220);
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

    it("does not reveal a newer assignment from a stale native measurement callback", () => {
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
        ctx.values.set("containerLayoutReady0", false);
        ctx.state.containerItemGenerations[0] = (ctx.state.containerItemGenerations[0] ?? 0) + 1;

        measureCallbacks[0](0, 0, 400, 160);

        expect(ctx.values.get("containerLayoutReady0")).toBe(false);
    });

    it("reveals a container that has no view to measure", () => {
        // No viewRefs entry at all: nothing will ever call back to reveal this row.
        measureContainersInLayoutEffect(ctx, new Set([0]));

        expect(ctx.values.get("containerLayoutReady0")).toBe(true);
    });

    it("reveals a container whose view is detached or cannot measure", () => {
        ctx.viewRefs.set(0, { current: null } as any);
        ctx.viewRefs.set(1, { current: {} } as any);

        measureContainersInLayoutEffect(ctx, new Set([0, 1]));

        expect(ctx.values.get("containerLayoutReady0")).toBe(true);
        expect(ctx.values.get("containerLayoutReady1")).toBe(true);
    });
});
