import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import "../setup";

import * as calculateItemsInViewModule from "../../src/core/calculateItemsInView";
import { checkResetContainers } from "../../src/core/checkResetContainers";
import * as doMaintainScrollAtEndModule from "../../src/core/doMaintainScrollAtEnd";
import type { StateContext } from "../../src/state/state";
import type { InternalState } from "../../src/types.internal";
import * as checkThresholdsModule from "../../src/utils/checkThresholds";
import { normalizeMaintainVisibleContentPosition } from "../../src/utils/normalizeMaintainVisibleContentPosition";
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

    it.each([false, true])("retains end measurements only while following or deferred (pending=%s)", (pending) => {
        const previousData = state.props.data;
        const data = [...previousData, { id: "item-3", value: "C" }];
        state.previousData = previousData;
        state.props.data = data;
        state.props.maintainScrollAtEnd = { on: { dataChange: true } };
        state.pendingEndMeasurements = new Set(["item-2", "removed-key"]);
        doMaintainScrollAtEndSpy.mockImplementation(() => {
            state.pendingMaintainScrollAtEnd = pending;
            return false;
        });

        checkResetContainers(ctx, data);

        expect(state.pendingEndMeasurements).toEqual(pending ? new Set(["item-2", "item-3"]) : undefined);
    });

    it.each([true, false])("anchors new data after a scroll jump reset (data MVCP=%s)", (mvcpData) => {
        const data = [{ id: "item-0", value: "Z" }, ...state.props.data];
        state.props.data = data;
        state.props.maintainVisibleContentPosition = normalizeMaintainVisibleContentPosition(mvcpData);
        const reset = { keys: new Set(["item-1"]) };
        state.userScrollAnchorReset = reset;

        checkResetContainers(ctx, data);

        expect(state.userScrollAnchorReset).toBe(mvcpData ? undefined : reset);
    });

    it("retains appended measurements after an immediate follow", () => {
        const previousData = state.props.data;
        const data = [...previousData, { id: "item-3", value: "C" }];
        state.previousData = previousData;
        state.props.data = data;
        state.props.maintainScrollAtEnd = { on: { dataChange: true } };
        doMaintainScrollAtEndSpy.mockReturnValue(true);
        checkResetContainers(ctx, data);
        expect(state.pendingEndMeasurements).toEqual(new Set(["item-3"]));
    });

    for (const [kind, ids, columns, follows] of [
        ["references", ["item-1", "item-2", "item-3"], false, true],
        ["immutable keys", ["item-1", "item-2", "item-3"], false, true],
        ["reorder", ["item-2", "item-1", "item-3"], false, false],
        ["truncate", ["item-1"], false, false],
        ["replace", ["new", "item-2", "item-3"], false, false],
        ["columns", ["item-1", "item-2", "item-3"], true, false],
    ] as const) {
        it(`follows only a strict key-preserving append (${kind})`, () => {
            const previous = state.props.data;
            const data = ids.map((id) =>
                kind === "references" ? (previous.find((item) => item.id === id) ?? { id }) : { id },
            );
            state.previousData = previous;
            state.props.data = data;
            state.props.maintainScrollAtEnd = { on: { dataAppend: true } };
            checkResetContainers(ctx, data, { didColumnsChange: columns });
            expect(doMaintainScrollAtEndSpy).toHaveBeenCalledTimes(follows ? 1 : 0);
        });
    }

    it("skips key extraction for an unchanged reference prefix in append mode", () => {
        const previousData = Array.from({ length: 5000 }, (_, id) => ({ id }));
        const data = [...previousData, { id: 5000 }];
        const keyExtractor = mock((item: { id: number }) => String(item.id));
        state.previousData = previousData;
        state.props.data = data;
        state.props.keyExtractor = keyExtractor;
        state.props.maintainScrollAtEnd = { on: { dataAppend: true, itemLayout: true } };
        checkResetContainers(ctx, data);
        expect(keyExtractor).not.toHaveBeenCalled();
        expect(doMaintainScrollAtEndSpy).toHaveBeenCalled();
    });

    it("checks boundaries without resetting the last dispatched edge when maintainScrollAtEnd is disabled", () => {
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
        expect(state.isEndReached).toBe(true);
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
        state.positionRecalculationStartIndex = 4;
        state.scrollForNextCalculateItemsInView = { bottom: 100, top: 0 };

        checkResetContainers(ctx, newData, { didColumnsChange: true });

        expect(calculateItemsInViewSpy).toHaveBeenCalledWith(ctx, {
            dataChanged: true,
            doMVCP: true,
        });
        expect(state.sizes.size).toBe(0);
        expect(state.sizesKnown.size).toBe(0);
        expect(Object.keys(state.averageSizes)).toEqual([]);
        expect(state.positionRecalculationStartIndex).toBe(0);
        expect(state.scrollForNextCalculateItemsInView).toBeUndefined();
        expect(doMaintainScrollAtEndSpy).not.toHaveBeenCalled();
        expect(checkThresholdsSpy).toHaveBeenCalledWith(ctx);
    });
});
