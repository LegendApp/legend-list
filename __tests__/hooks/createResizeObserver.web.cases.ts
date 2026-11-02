import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";
import "../setup";

import * as calculateItemsInViewModule from "@/core/calculateItemsInView";
import { updateItemSizes } from "@/core/updateItemSizes";
import { normalizeMaintainVisibleContentPosition } from "@/utils/normalizeMaintainVisibleContentPosition";
import { createMockContext } from "../__mocks__/createMockContext";

const originalResizeObserver = globalThis.ResizeObserver;

afterEach(() => {
    globalThis.ResizeObserver = originalResizeObserver;
});

describe("createResizeObserver web", () => {
    it("applies every entry from one observer delivery in one size batch", async () => {
        let deliver: ResizeObserverCallback | undefined;
        const observeMock = mock();
        globalThis.ResizeObserver = class {
            constructor(callback: ResizeObserverCallback) {
                deliver = callback;
            }

            disconnect = mock();
            observe = observeMock;
            unobserve = mock();
        } as unknown as typeof ResizeObserver;

        const { createResizeObserver } = await import("@/hooks/createResizeObserver?web-size-batch");
        const calculateSpy = spyOn(calculateItemsInViewModule, "calculateItemsInView").mockImplementation(() => {});
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
        const element0 = {} as Element;
        const element1 = {} as Element;

        createResizeObserver(element0, () => {
            updateItemSizes(ctx, {
                containerId: 0,
                itemKey: "item_0",
                size: { height: 140, width: 400 },
            });
        });
        createResizeObserver(element1, () => {
            updateItemSizes(ctx, {
                containerId: 1,
                itemKey: "item_1",
                size: { height: 180, width: 400 },
            });
        });

        expect(observeMock).toHaveBeenCalledWith(element0, { box: "border-box" });
        expect(observeMock).toHaveBeenCalledWith(element1, { box: "border-box" });

        deliver?.(
            [
                { contentRect: { height: 140, width: 400 }, target: element0 },
                { contentRect: { height: 180, width: 400 }, target: element1 },
            ] as ResizeObserverEntry[],
            {} as ResizeObserver,
        );

        expect(ctx.state.sizesKnown.get("item_0")).toBe(140);
        expect(ctx.state.sizesKnown.get("item_1")).toBe(180);
        expect(calculateSpy).toHaveBeenCalledTimes(1);
        calculateSpy.mockRestore();
    });

    it("creates one size batch for each list in a shared observer delivery", async () => {
        let deliver: ResizeObserverCallback | undefined;
        globalThis.ResizeObserver = class {
            constructor(callback: ResizeObserverCallback) {
                deliver = callback;
            }

            disconnect = mock();
            observe = mock();
            unobserve = mock();
        } as unknown as typeof ResizeObserver;

        const { createResizeObserver } = await import("@/hooks/createResizeObserver?web-multi-list-batch");
        const calculateSpy = spyOn(calculateItemsInViewModule, "calculateItemsInView").mockImplementation(() => {});
        const createListContext = (itemKey: string) => {
            const ctx = createMockContext(
                {
                    containerItemKey0: itemKey,
                    otherAxisSize: 400,
                    readyToRender: true,
                },
                {
                    didContainersLayout: true,
                    endBuffered: 0,
                    indexByKey: new Map([[itemKey, 0]]),
                    props: {
                        data: [{ id: itemKey }],
                        estimatedItemSize: 100,
                        keyExtractor: (item) => item.id,
                        maintainVisibleContentPosition: normalizeMaintainVisibleContentPosition(false),
                    },
                    startBuffered: 0,
                },
            );
            ctx.state.containerItemKeys.set(itemKey, 0);
            return ctx;
        };
        const firstCtx = createListContext("first_item");
        const secondCtx = createListContext("second_item");
        const firstElement = {} as Element;
        const secondElement = {} as Element;

        createResizeObserver(firstElement, () => {
            updateItemSizes(firstCtx, {
                containerId: 0,
                itemKey: "first_item",
                size: { height: 140, width: 400 },
            });
        });
        createResizeObserver(secondElement, () => {
            updateItemSizes(secondCtx, {
                containerId: 0,
                itemKey: "second_item",
                size: { height: 180, width: 400 },
            });
        });

        deliver?.(
            [
                { contentRect: { height: 140, width: 400 }, target: firstElement },
                { contentRect: { height: 180, width: 400 }, target: secondElement },
            ] as ResizeObserverEntry[],
            {} as ResizeObserver,
        );

        expect(firstCtx.state.sizesKnown.get("first_item")).toBe(140);
        expect(secondCtx.state.sizesKnown.get("second_item")).toBe(180);
        expect(calculateSpy).toHaveBeenCalledTimes(2);
        calculateSpy.mockRestore();
    });
});
