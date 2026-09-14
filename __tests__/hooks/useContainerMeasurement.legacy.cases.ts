import { expect, it, mock, spyOn } from "bun:test";
import "../setup";
mock.module("@/constants-platform", () => ({ IsNewArchitecture: false }));
const { processContainerLayout } = await import("../../src/hooks/useContainerMeasurement");
const { createMockContext } = await import("../__mocks__/createMockContext");
const calculateModule = await import("../../src/core/calculateItemsInView");

it("rejects a delayed native measure after same-key invalidation without overwriting local size", () => {
    const ctx = createMockContext(
        { containerItemKey0: "item_0", otherAxisSize: 400, readyToRender: true },
        {
            didContainersLayout: true,
            idCache: ["item_0"],
            indexByKey: new Map([["item_0", 0]]),
            props: { data: [{ id: "item_0" }], estimatedItemSize: 100 },
        },
    );
    ctx.state.containerItemKeys.set("item_0", 0);
    ctx.state.containerItemGenerations[0] = 1;
    const calculate = spyOn(calculateModule, "calculateItemsInView").mockImplementation(() => {});
    let measure: (x: number, y: number, width: number, height: number) => void;
    const state = { didLayout: false, horizontal: false, itemKey: "item_0", lastSize: { height: 100, width: 400 } };
    try {
        processContainerLayout({
            containerId: 0,
            ctx,
            rectangle: { height: 0, width: 400, x: 0, y: 0 },
            ref: {
                current: {
                    measure: (callback: typeof measure) => {
                        measure = callback;
                    },
                } as any,
            },
            state,
        });
        ctx.state.containerItemGenerations[0] = 2;
        measure!(0, 0, 400, 250);
        expect(ctx.state.sizesKnown.has("item_0")).toBe(false);
        expect(state.lastSize.height).toBe(100);
        expect(calculate).not.toHaveBeenCalled();
        processContainerLayout({
            containerId: 0,
            ctx,
            rectangle: { height: 160, width: 400, x: 0, y: 0 },
            ref: { current: null },
            state,
        });
        expect(ctx.state.sizesKnown.get("item_0")).toBe(160);
        expect(state.lastSize.height).toBe(160);
        expect(calculate).toHaveBeenCalledTimes(1);
    } finally {
        calculate.mockRestore();
        ctx.state.scheduledWork.dispose();
    }
});
