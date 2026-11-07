import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import "../setup";

import * as calculateItemsInViewModule from "@/core/calculateItemsInView";
import { batchItemSizeUpdates } from "@/core/updateItemSizes";
import { processContainerLayout } from "@/hooks/useContainerMeasurement";
import { Platform } from "@/platform/Platform";
import { normalizeMaintainVisibleContentPosition } from "@/utils/normalizeMaintainVisibleContentPosition";
import { createMockContext } from "../__mocks__/createMockContext";

const originalPlatform = Platform.OS;
const originalRequestAnimationFrame = globalThis.requestAnimationFrame;

function createContext() {
    const ctx = createMockContext(
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
                maintainVisibleContentPosition: normalizeMaintainVisibleContentPosition(false),
            },
            startBuffered: 0,
        },
    );
    ctx.state.containerItemKeys.set("item_0", 0);
    ctx.state.containerItemKeys.set("item_1", 1);
    return ctx;
}

function createMeasurementState(itemKey: string, lastSize: number) {
    return {
        didLayout: true,
        horizontal: false,
        itemKey,
        lastSize: { height: lastSize, width: 400 },
    };
}

beforeEach(() => {
    Platform.OS = "web";
});

afterEach(() => {
    Platform.OS = originalPlatform;
    globalThis.requestAnimationFrame = originalRequestAnimationFrame;
});

describe("useContainerMeasurement web", () => {
    it("uses the current item's authoritative size after recycling", () => {
        const raf = mock((_callback: FrameRequestCallback) => 1);
        globalThis.requestAnimationFrame = raf;
        const calculateSpy = spyOn(calculateItemsInViewModule, "calculateItemsInView").mockImplementation(() => {});
        const ctx = createContext();
        ctx.state.sizesKnown.set("item_0", 100);
        const state = createMeasurementState("item_0", 220);

        processContainerLayout({
            containerId: 0,
            ctx,
            rectangle: { height: 150, width: 400, x: 0, y: 0 },
            ref: { current: null },
            state,
        });

        expect(raf).not.toHaveBeenCalled();
        expect(ctx.state.sizesKnown.get("item_0")).toBe(150);
        expect(calculateSpy).toHaveBeenCalledTimes(1);
        calculateSpy.mockRestore();
    });

    it("confirms simultaneous shrinks in one frame and one size batch", () => {
        const frameCallbacks: FrameRequestCallback[] = [];
        globalThis.requestAnimationFrame = mock((callback: FrameRequestCallback) => {
            frameCallbacks.push(callback);
            return frameCallbacks.length;
        });
        const calculateSpy = spyOn(calculateItemsInViewModule, "calculateItemsInView").mockImplementation(() => {});
        const ctx = createContext();
        ctx.state.sizesKnown.set("item_0", 200);
        ctx.state.sizesKnown.set("item_1", 220);

        processContainerLayout({
            containerId: 0,
            ctx,
            rectangle: { height: 150, width: 400, x: 0, y: 0 },
            ref: { current: { getBoundingClientRect: () => ({ height: 150, width: 400 }) } as any },
            state: createMeasurementState("item_0", 200),
        });
        processContainerLayout({
            containerId: 1,
            ctx,
            rectangle: { height: 170, width: 400, x: 0, y: 0 },
            ref: { current: { getBoundingClientRect: () => ({ height: 170, width: 400 }) } as any },
            state: createMeasurementState("item_1", 220),
        });

        expect(frameCallbacks).toHaveLength(1);
        expect(ctx.state.sizesKnown.get("item_0")).toBe(200);
        expect(ctx.state.sizesKnown.get("item_1")).toBe(220);

        frameCallbacks[0](0);

        expect(ctx.state.sizesKnown.get("item_0")).toBe(150);
        expect(ctx.state.sizesKnown.get("item_1")).toBe(170);
        expect(calculateSpy).toHaveBeenCalledTimes(1);
        calculateSpy.mockRestore();
    });

    it("drops a shrink confirmation after the container is recycled", () => {
        const frameCallbacks: FrameRequestCallback[] = [];
        globalThis.requestAnimationFrame = mock((callback: FrameRequestCallback) => {
            frameCallbacks.push(callback);
            return frameCallbacks.length;
        });
        const calculateSpy = spyOn(calculateItemsInViewModule, "calculateItemsInView").mockImplementation(() => {});
        const ctx = createContext();
        ctx.state.sizesKnown.set("item_0", 200);
        const state = createMeasurementState("item_0", 200);

        processContainerLayout({
            containerId: 0,
            ctx,
            rectangle: { height: 150, width: 400, x: 0, y: 0 },
            ref: { current: { getBoundingClientRect: () => ({ height: 150, width: 400 }) } as any },
            state,
        });
        state.itemKey = "item_1";
        ctx.values.set("containerItemKey0", "item_1");

        frameCallbacks[0](0);

        expect(ctx.state.sizesKnown.get("item_0")).toBe(200);
        expect(calculateSpy).not.toHaveBeenCalled();
        calculateSpy.mockRestore();
    });

    it("cancels a pending shrink when the container grows before confirmation", () => {
        const frameCallbacks: FrameRequestCallback[] = [];
        globalThis.requestAnimationFrame = mock((callback: FrameRequestCallback) => {
            frameCallbacks.push(callback);
            return frameCallbacks.length;
        });
        const calculateSpy = spyOn(calculateItemsInViewModule, "calculateItemsInView").mockImplementation(() => {});
        const ctx = createContext();
        ctx.state.sizesKnown.set("item_0", 200);
        const state = createMeasurementState("item_0", 200);
        const ref = { current: { getBoundingClientRect: () => ({ height: 230, width: 400 }) } as any };

        processContainerLayout({
            containerId: 0,
            ctx,
            rectangle: { height: 150, width: 400, x: 0, y: 0 },
            ref,
            state,
        });
        processContainerLayout({
            containerId: 0,
            ctx,
            rectangle: { height: 230, width: 400, x: 0, y: 0 },
            ref,
            state,
        });

        expect(frameCallbacks).toHaveLength(1);
        expect(ctx.state.sizesKnown.get("item_0")).toBe(230);
        frameCallbacks[0](0);
        expect(ctx.state.sizesKnown.get("item_0")).toBe(230);
        expect(calculateSpy).toHaveBeenCalledTimes(1);
        calculateSpy.mockRestore();
    });

    it("replaces an earlier pending shrink for the same container", () => {
        const frameCallbacks: FrameRequestCallback[] = [];
        globalThis.requestAnimationFrame = mock((callback: FrameRequestCallback) => {
            frameCallbacks.push(callback);
            return frameCallbacks.length;
        });
        const calculateSpy = spyOn(calculateItemsInViewModule, "calculateItemsInView").mockImplementation(() => {});
        const ctx = createContext();
        ctx.state.sizesKnown.set("item_0", 200);
        const state = createMeasurementState("item_0", 200);
        let confirmedHeight = 150;
        const ref = { current: { getBoundingClientRect: () => ({ height: confirmedHeight, width: 400 }) } as any };

        processContainerLayout({
            containerId: 0,
            ctx,
            rectangle: { height: 150, width: 400, x: 0, y: 0 },
            ref,
            state,
        });
        confirmedHeight = 140;
        processContainerLayout({
            containerId: 0,
            ctx,
            rectangle: { height: 140, width: 400, x: 0, y: 0 },
            ref,
            state,
        });

        expect(frameCallbacks).toHaveLength(1);
        frameCallbacks[0](0);
        expect(ctx.state.sizesKnown.get("item_0")).toBe(140);
        expect(calculateSpy).toHaveBeenCalledTimes(1);
        calculateSpy.mockRestore();
    });

    it("applies MVCP-active shrinks immediately in the observer batch", () => {
        const raf = mock((_callback: FrameRequestCallback) => 1);
        globalThis.requestAnimationFrame = raf;
        const calculateSpy = spyOn(calculateItemsInViewModule, "calculateItemsInView").mockImplementation(() => {});
        const ctx = createContext();
        ctx.state.dataChangeNeedsScrollUpdate = true;
        ctx.state.sizesKnown.set("item_0", 200);
        ctx.state.sizesKnown.set("item_1", 220);

        batchItemSizeUpdates(() => {
            processContainerLayout({
                containerId: 0,
                ctx,
                rectangle: { height: 150, width: 400, x: 0, y: 0 },
                ref: { current: null },
                state: createMeasurementState("item_0", 200),
            });
            processContainerLayout({
                containerId: 1,
                ctx,
                rectangle: { height: 170, width: 400, x: 0, y: 0 },
                ref: { current: null },
                state: createMeasurementState("item_1", 220),
            });
        });

        expect(raf).not.toHaveBeenCalled();
        expect(ctx.state.sizesKnown.get("item_0")).toBe(150);
        expect(ctx.state.sizesKnown.get("item_1")).toBe(170);
        expect(calculateSpy).toHaveBeenCalledTimes(1);
        calculateSpy.mockRestore();
    });
    it("keeps the known size when the container has no box by the time a shrink is confirmed", () => {
        const frameCallbacks: FrameRequestCallback[] = [];
        globalThis.requestAnimationFrame = mock((callback: FrameRequestCallback) => {
            frameCallbacks.push(callback);
            return frameCallbacks.length;
        });
        const calculateSpy = spyOn(calculateItemsInViewModule, "calculateItemsInView").mockImplementation(() => {});
        const ctx = createContext();
        ctx.state.sizesKnown.set("item_0", 200);
        const state = createMeasurementState("item_0", 200);
        // The list is hidden between the observed shrink and its confirmation frame.
        const ref = { current: { getBoundingClientRect: () => ({ height: 0, width: 0 }) } as any };

        processContainerLayout({
            containerId: 0,
            ctx,
            rectangle: { height: 150, width: 400, x: 0, y: 0 },
            ref,
            state,
        });

        expect(frameCallbacks).toHaveLength(1);
        frameCallbacks[0](0);
        expect(ctx.state.sizesKnown.get("item_0")).toBe(200);
        expect(calculateSpy).not.toHaveBeenCalled();
        calculateSpy.mockRestore();
    });
});
