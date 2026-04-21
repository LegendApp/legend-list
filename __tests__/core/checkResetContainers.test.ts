import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import "../setup";

import * as calculateItemsInViewModule from "../../src/core/calculateItemsInView";
import { checkResetContainers } from "../../src/core/checkResetContainers";
import * as doMaintainScrollAtEndModule from "../../src/core/doMaintainScrollAtEnd";
import type { StateContext } from "../../src/state/state";
import type { InternalState } from "../../src/types.internal";
import * as checkThresholdsModule from "../../src/utils/checkThresholds";
import { createMockContext } from "../__mocks__/createMockContext";

describe("checkResetContainers", () => {
    let ctx: StateContext;
    let state: InternalState;
    let calculateItemsInViewSpy: ReturnType<typeof spyOn>;
    let doMaintainScrollAtEndSpy: ReturnType<typeof spyOn>;
    let checkThresholdsSpy: ReturnType<typeof spyOn>;

    beforeEach(() => {
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
        doMaintainScrollAtEndSpy = spyOn(doMaintainScrollAtEndModule, "doMaintainScrollAtEnd").mockImplementation(
            () => false,
        );
        checkThresholdsSpy = spyOn(checkThresholdsModule, "checkThresholds").mockImplementation(() => undefined);
    });

    afterEach(() => {
        calculateItemsInViewSpy.mockRestore();
        doMaintainScrollAtEndSpy.mockRestore();
        checkThresholdsSpy.mockRestore();
    });

    it("resets end reached state and boundary checks when maintainScrollAtEnd is disabled", () => {
        const previousData = state.props.data;
        const newData = [...previousData, { id: "item-3", value: "C" }];
        state.previousData = previousData;
        doMaintainScrollAtEndSpy.mockClear();

        checkResetContainers(ctx, newData);

        expect(calculateItemsInViewSpy).toHaveBeenCalledWith(ctx, {
            dataChanged: true,
            doMVCP: true,
        });
        expect(doMaintainScrollAtEndSpy).not.toHaveBeenCalled();
        expect(state.isEndReached).toBe(false);
        expect(checkThresholdsSpy).toHaveBeenCalledWith(ctx);
        expect(state.previousData).toBeUndefined();
    });

    it("treats modifier-only object options as all triggers", () => {
        const previousData = state.props.data;
        const newData = previousData.slice();
        state.props.maintainScrollAtEnd = { animated: true };
        state.previousData = previousData;
        doMaintainScrollAtEndSpy.mockImplementation(() => true);
        doMaintainScrollAtEndSpy.mockClear();

        checkResetContainers(ctx, newData);

        expect(calculateItemsInViewSpy).toHaveBeenCalledTimes(1);
        expect(doMaintainScrollAtEndSpy).toHaveBeenCalledWith(ctx);
        expect(checkThresholdsSpy).not.toHaveBeenCalled();
        expect(state.isEndReached).toBe(true);
        expect(state.previousData).toBeUndefined();
    });

    it("respects explicit dataChange on config", () => {
        const previousData = state.props.data;
        const newData = previousData.slice();
        state.props.maintainScrollAtEnd = {
            animated: true,
            on: { dataChange: true },
        };
        state.previousData = previousData;
        doMaintainScrollAtEndSpy.mockImplementation(() => true);
        doMaintainScrollAtEndSpy.mockClear();

        checkResetContainers(ctx, newData);

        expect(calculateItemsInViewSpy).toHaveBeenCalledTimes(1);
        expect(doMaintainScrollAtEndSpy).toHaveBeenCalledWith(ctx);
        expect(checkThresholdsSpy).not.toHaveBeenCalled();
        expect(state.isEndReached).toBe(true);
        expect(state.previousData).toBeUndefined();
    });

    it("skips data-change anchoring when on excludes it", () => {
        const previousData = state.props.data;
        const newData = previousData.slice();
        state.props.maintainScrollAtEnd = {
            animated: true,
            on: { layout: true },
        };
        state.previousData = previousData;
        doMaintainScrollAtEndSpy.mockClear();

        checkResetContainers(ctx, newData);

        expect(doMaintainScrollAtEndSpy).not.toHaveBeenCalled();
        expect(checkThresholdsSpy).toHaveBeenCalledWith(ctx);
    });

    it("clears cached item sizes on column changes before recalculating", () => {
        const previousData = state.props.data;
        const newData = previousData.slice();
        state.previousData = previousData;
        state.props.maintainScrollAtEnd = {
            animated: true,
            on: { dataChange: true },
        };
        state.sizes.set("item-1", 120);
        state.sizesKnown.set("item-1", 120);
        state.averageSizes[""] = { avg: 120, num: 1 };
        state.minIndexSizeChanged = 4;
        state.scrollForNextCalculateItemsInView = { bottom: 100, top: 0 };

        checkResetContainers(ctx, newData, { didColumnsChange: true });

        expect(calculateItemsInViewSpy).toHaveBeenCalledWith(ctx, {
            dataChanged: true,
            doMVCP: true,
        });
        expect(state.sizes.size).toBe(0);
        expect(state.sizesKnown.size).toBe(0);
        expect(Object.keys(state.averageSizes)).toEqual([]);
        expect(state.minIndexSizeChanged).toBe(0);
        expect(state.scrollForNextCalculateItemsInView).toBeUndefined();
        expect(doMaintainScrollAtEndSpy).not.toHaveBeenCalled();
        expect(checkThresholdsSpy).toHaveBeenCalledWith(ctx);
    });
});
