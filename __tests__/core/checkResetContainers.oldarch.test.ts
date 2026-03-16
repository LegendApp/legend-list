import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import "../setup";

import { Platform } from "@/platform/Platform";

mock.module("@/constants-platform", () => ({
    IsNewArchitecture: false,
}));

import * as calculateItemsInViewModule from "../../src/core/calculateItemsInView";
import { checkResetContainers } from "../../src/core/checkResetContainers";
import type { StateContext } from "../../src/state/state";
import type { InternalState } from "../../src/types";
import * as requestAdjustModule from "../../src/utils/requestAdjust";
import { createMockContext } from "../__mocks__/createMockContext";

describe("checkResetContainers on old architecture", () => {
    let ctx: StateContext;
    let state: InternalState;
    let calculateItemsInViewSpy: ReturnType<typeof spyOn>;
    let requestAdjustSpy: ReturnType<typeof spyOn>;

    beforeEach(() => {
        Platform.OS = "ios";
        ctx = createMockContext(
            {},
            {
                isEndReached: true,
                props: {
                    data: [
                        { id: "item-1", value: "A" },
                        { id: "item-2", value: "B" },
                    ],
                    keyExtractor: (item: { id: string }) => item.id,
                    maintainScrollAtEnd: false,
                },
            },
        );
        state = ctx.state;

        calculateItemsInViewSpy = spyOn(calculateItemsInViewModule, "calculateItemsInView").mockImplementation(
            () => undefined,
        );
        requestAdjustSpy = spyOn(requestAdjustModule, "requestAdjust").mockImplementation(() => undefined);
    });

    afterEach(() => {
        calculateItemsInViewSpy.mockRestore();
        requestAdjustSpy.mockRestore();
    });

    function setUpPrependScenario() {
        const previousData = [
            { id: "item-1", value: "A" },
            { id: "item-2", value: "B" },
            { id: "item-3", value: "C" },
            { id: "item-4", value: "D" },
            { id: "item-5", value: "E" },
        ];
        const newData = [{ id: "item-pre-1", value: "P1" }, { id: "item-pre-2", value: "P2" }, ...previousData];

        state.previousData = previousData;
        state.props.data = newData;
        state.props.estimatedItemSize = 100;
        state.didContainersLayout = true;
        state.didFinishInitialScroll = true;
        state.startBuffered = 3;
        state.endBuffered = 4;
        state.startNoBuffer = 3;
        state.endNoBuffer = 4;
        state.firstFullyOnScreenIndex = 3;
        state.idsInView = ["item-4", "item-5"];
        state.idCache = previousData.map((item) => item.id);
        state.indexByKey = new Map(previousData.map((item, index) => [item.id, index]));
        state.positions = [0, 100, 200, 300, 400];
        state.scroll = 300;
        ctx.values.set("numContainers", 6);
        ctx.values.set("numContainersPooled", 6);
        ctx.values.set("containerItemKey2", "item-4");
        ctx.values.set("containerPosition2", 300);
        ctx.values.set("containerItemKey3", "item-5");
        ctx.values.set("containerPosition3", 400);

        return { newData, previousData };
    }

    it("falls back to the reset path when prepended items do not have fixed sizes", () => {
        const { newData } = setUpPrependScenario();
        const previousTotalSize = state.totalSize;

        checkResetContainers(ctx, newData);

        expect(calculateItemsInViewSpy).toHaveBeenCalledWith(ctx, {
            dataChanged: true,
            doMVCP: true,
        });
        expect(requestAdjustSpy).not.toHaveBeenCalled();
        expect(state.pendingPrependTransaction).toBeUndefined();
        expect(state.sizes.size).toBe(0);
        expect(state.sizesKnown.size).toBe(0);
        expect(state.totalSize).toBe(previousTotalSize);
    });

    it("uses the prepend transaction path when every prepended item has a fixed size", () => {
        const { newData } = setUpPrependScenario();
        state.props.getFixedItemSize = () => 100;

        checkResetContainers(ctx, newData);

        expect(calculateItemsInViewSpy).toHaveBeenCalledWith(ctx, {
            dataChanged: true,
            doMVCP: true,
        });
        expect(requestAdjustSpy).toHaveBeenCalledWith(ctx, 200, true);
        expect(state.pendingPrependTransaction).toBeUndefined();
    });
});
