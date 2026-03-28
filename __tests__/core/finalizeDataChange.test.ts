import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";

import * as calculateItemsInViewModule from "../../src/core/calculateItemsInView";
import {
    finalizeDataChange,
    finalizeDataChangeSideEffects,
    reconcileDataChange,
} from "../../src/core/finalizeDataChange";
import * as doMaintainScrollAtEndModule from "../../src/core/doMaintainScrollAtEnd";
import * as checkThresholdsModule from "../../src/utils/checkThresholds";
import { createMockContext } from "../__mocks__/createMockContext";

describe("finalizeDataChange helpers", () => {
    const previousData = [{ id: "item-1" }, { id: "item-2" }];
    const nextData = [...previousData, { id: "item-3" }];

    let calculateItemsInViewSpy: ReturnType<typeof spyOn>;
    let doMaintainScrollAtEndSpy: ReturnType<typeof spyOn>;
    let checkThresholdsSpy: ReturnType<typeof spyOn>;

    beforeEach(() => {
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

    it("reconciles data changes through the shared request helper", () => {
        const ctx = createMockContext({}, { props: { data: nextData } });

        reconcileDataChange(ctx);

        expect(calculateItemsInViewSpy).toHaveBeenCalledWith(ctx, {
            dataChanged: true,
            doMVCP: true,
        });
    });

    it("runs shared post-data-change side effects without reconciling again", () => {
        const ctx = createMockContext(
            {},
            {
                isEndReached: true,
                previousData,
                props: {
                    data: nextData,
                    maintainScrollAtEnd: false,
                },
            },
        );

        finalizeDataChangeSideEffects(ctx);

        expect(calculateItemsInViewSpy).not.toHaveBeenCalled();
        expect(doMaintainScrollAtEndSpy).not.toHaveBeenCalled();
        expect(ctx.state.isEndReached).toBe(false);
        expect(checkThresholdsSpy).toHaveBeenCalledWith(ctx);
        expect(ctx.state.previousData).toBeUndefined();
    });

    it("preserves existing finalizeDataChange behavior", () => {
        const ctx = createMockContext(
            {},
            {
                isEndReached: true,
                previousData,
                props: {
                    data: nextData,
                    maintainScrollAtEnd: false,
                },
            },
        );

        finalizeDataChange(ctx);

        expect(calculateItemsInViewSpy).toHaveBeenCalledWith(ctx, {
            dataChanged: true,
            doMVCP: true,
        });
        expect(ctx.state.isEndReached).toBe(false);
        expect(checkThresholdsSpy).toHaveBeenCalledWith(ctx);
        expect(ctx.state.previousData).toBeUndefined();
    });
});
