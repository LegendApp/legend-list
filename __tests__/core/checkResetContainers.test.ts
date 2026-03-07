import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import "../setup";

import * as calculateItemsInViewModule from "../../src/core/calculateItemsInView";
import { checkResetContainers } from "../../src/core/checkResetContainers";
import * as doMaintainScrollAtEndModule from "../../src/core/doMaintainScrollAtEnd";
import type { StateContext } from "../../src/state/state";
import type { InternalState } from "../../src/types";
import * as checkThresholdsModule from "../../src/utils/checkThresholds";
import { normalizeMaintainScrollAtEnd } from "../../src/utils/normalizeMaintainScrollAtEnd";
import * as updateAveragesOnDataChangeModule from "../../src/utils/updateAveragesOnDataChange";
import { createMockContext } from "../__mocks__/createMockContext";

describe("checkResetContainers", () => {
    let ctx: StateContext;
    let state: InternalState;
    let calculateItemsInViewSpy: ReturnType<typeof spyOn>;
    let doMaintainScrollAtEndSpy: ReturnType<typeof spyOn>;
    let checkThresholdsSpy: ReturnType<typeof spyOn>;
    let updateAveragesSpy: ReturnType<typeof spyOn>;

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
        updateAveragesSpy = spyOn(updateAveragesOnDataChangeModule, "updateAveragesOnDataChange").mockImplementation(
            () => undefined,
        );
    });

    afterEach(() => {
        calculateItemsInViewSpy.mockRestore();
        doMaintainScrollAtEndSpy.mockRestore();
        checkThresholdsSpy.mockRestore();
        updateAveragesSpy.mockRestore();
    });

    it("resets end reached state and boundary checks when maintainScrollAtEnd is disabled", () => {
        const previousData = state.props.data;
        const newData = [...previousData, { id: "item-3", value: "C" }];
        state.previousData = previousData;
        doMaintainScrollAtEndSpy.mockClear();

        checkResetContainers(ctx, newData);

        expect(updateAveragesSpy).toHaveBeenCalledWith(state, previousData, newData);
        expect(calculateItemsInViewSpy).toHaveBeenCalledWith(ctx, {
            dataChanged: true,
            doMVCP: true,
        });
        expect(doMaintainScrollAtEndSpy).not.toHaveBeenCalled();
        expect(state.isEndReached).toBe(false);
        expect(checkThresholdsSpy).toHaveBeenCalledWith(ctx);
        expect(state.previousData).toBeUndefined();
    });

    it("defaults object options into the onDataChange trigger", () => {
        const previousData = state.props.data;
        const newData = previousData.slice();
        state.props.maintainScrollAtEnd = normalizeMaintainScrollAtEnd({ animated: true });
        state.previousData = previousData;
        doMaintainScrollAtEndSpy.mockImplementation(() => true);
        doMaintainScrollAtEndSpy.mockClear();

        checkResetContainers(ctx, newData);

        expect(updateAveragesSpy).toHaveBeenCalledWith(state, previousData, newData);
        expect(calculateItemsInViewSpy).toHaveBeenCalledTimes(1);
        expect(doMaintainScrollAtEndSpy).toHaveBeenCalledWith(ctx);
        expect(checkThresholdsSpy).not.toHaveBeenCalled();
        expect(state.isEndReached).toBe(true);
        expect(state.previousData).toBeUndefined();
    });
});
