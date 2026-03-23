import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import "../setup";

mock.module("@/constants-platform", () => ({
    IsNewArchitecture: true,
}));

import { Platform } from "@/platform/Platform";
import * as calculateItemsInViewModule from "../../src/core/calculateItemsInView";
import { checkResetContainers } from "../../src/core/checkResetContainers";
import * as doMaintainScrollAtEndModule from "../../src/core/doMaintainScrollAtEnd";
import type { StateContext } from "../../src/state/state";
import type { InternalState } from "../../src/types";
import * as checkThresholdsModule from "../../src/utils/checkThresholds";
import * as requestAdjustModule from "../../src/utils/requestAdjust";
import * as updateAveragesOnDataChangeModule from "../../src/utils/updateAveragesOnDataChange";
import { createMockContext } from "../__mocks__/createMockContext";

describe("checkResetContainers", () => {
    let ctx: StateContext;
    let state: InternalState;
    let calculateItemsInViewSpy: ReturnType<typeof spyOn>;
    let doMaintainScrollAtEndSpy: ReturnType<typeof spyOn>;
    let checkThresholdsSpy: ReturnType<typeof spyOn>;
    let requestAdjustSpy: ReturnType<typeof spyOn>;
    let updateAveragesSpy: ReturnType<typeof spyOn>;

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
        doMaintainScrollAtEndSpy = spyOn(doMaintainScrollAtEndModule, "doMaintainScrollAtEnd").mockImplementation(
            () => false,
        );
        checkThresholdsSpy = spyOn(checkThresholdsModule, "checkThresholds").mockImplementation(() => undefined);
        requestAdjustSpy = spyOn(requestAdjustModule, "requestAdjust").mockImplementation(() => undefined);
        updateAveragesSpy = spyOn(updateAveragesOnDataChangeModule, "updateAveragesOnDataChange").mockImplementation(
            () => undefined,
        );
    });

    afterEach(() => {
        calculateItemsInViewSpy.mockRestore();
        doMaintainScrollAtEndSpy.mockRestore();
        checkThresholdsSpy.mockRestore();
        requestAdjustSpy.mockRestore();
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

    it("treats modifier-only object options as all triggers", () => {
        const previousData = state.props.data;
        const newData = previousData.slice();
        state.props.maintainScrollAtEnd = { animated: true };
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

        expect(updateAveragesSpy).toHaveBeenCalledWith(state, previousData, newData);
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

    it("uses the prepend transaction path instead of running the old reset path", () => {
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

        checkResetContainers(ctx, newData);

        expect(calculateItemsInViewSpy).not.toHaveBeenCalled();
        expect(updateAveragesSpy).toHaveBeenCalledWith(state, previousData, newData);
        expect(state.pendingPrependTransaction?.remainingKeys).toEqual(new Set(["item-pre-1", "item-pre-2"]));
        expect(state.positions[0]).toBe(0);
        expect(state.positions[1]).toBe(100);
        expect(state.positions[2]).toBe(200);
        expect(state.positions[6]).toBe(600);
        expect(state.startBuffered).toBe(5);
        expect(state.endBuffered).toBe(6);
        expect(ctx.values.get("containerItemKey0")).toBe("item-pre-1");
        expect(ctx.values.get("containerItemKey1")).toBe("item-pre-2");
        expect(ctx.values.get("containerPosition0")).toBe(0);
        expect(ctx.values.get("containerPosition1")).toBe(100);
        expect(ctx.values.get("containerPosition2")).toBe(500);
        expect(ctx.values.get("containerPosition3")).toBe(600);
        expect(state.previousData).toBe(previousData);
    });

    it("clears active bootstrap ownership before handing off to prepend transaction", () => {
        const previousData = [
            { id: "item-1", value: "A" },
            { id: "item-2", value: "B" },
            { id: "item-3", value: "C" },
            { id: "item-4", value: "D" },
        ];
        const newData = [{ id: "item-pre-1", value: "P1" }, ...previousData];
        state.previousData = previousData;
        state.props.data = newData;
        state.props.estimatedItemSize = 100;
        state.didContainersLayout = true;
        state.didFinishInitialScroll = true;
        state.startBuffered = 2;
        state.endBuffered = 3;
        state.startNoBuffer = 2;
        state.endNoBuffer = 3;
        state.firstFullyOnScreenIndex = 2;
        state.idsInView = ["item-3", "item-4"];
        state.idCache = previousData.map((item) => item.id);
        state.indexByKey = new Map(previousData.map((item, index) => [item.id, index]));
        state.positions = [0, 100, 200, 300];
        state.scroll = 200;
        state.deferredPositionDelta = 55;
        state.pendingDeferredSizeShift = 30;
        state.initialBootstrap = {
            active: true,
            anchorIndexHint: 2,
            anchorKey: "item-3",
            anchorViewOffset: 0,
            anchorViewPosition: 0.5,
            bootstrapVisualOffset: 80,
            desiredAnchorOffset: 280,
            desiredOffset: 280,
            observedNativeScroll: false,
            pendingRebase: false,
            stableFrames: 0,
            targetIndexHint: 2,
            targetKey: "item-3",
            viewOffset: 0,
            viewPosition: 0.5,
        };
        ctx.values.set("numContainers", 5);
        ctx.values.set("numContainersPooled", 5);
        ctx.values.set("containerItemKey1", "item-3");
        ctx.values.set("containerPosition1", 200);
        ctx.values.set("containerItemKey2", "item-4");
        ctx.values.set("containerPosition2", 300);

        checkResetContainers(ctx, newData);

        expect(calculateItemsInViewSpy).not.toHaveBeenCalled();
        expect(state.initialBootstrap?.active).toBe(false);
        expect(state.initialBootstrap?.bootstrapVisualOffset).toBe(0);
        expect(state.deferredPositionDelta).toBe(0);
        expect(state.pendingDeferredSizeShift).toBe(0);
        expect(state.pendingPrependTransaction?.remainingKeys).toEqual(new Set(["item-pre-1"]));
    });

    it("uses the prepend transaction path even when the inserted batch exceeds startBuffered", () => {
        const previousData = [
            { id: "item-1", value: "A" },
            { id: "item-2", value: "B" },
            { id: "item-3", value: "C" },
            { id: "item-4", value: "D" },
        ];
        const newData = [{ id: "item-pre-1", value: "P1" }, { id: "item-pre-2", value: "P2" }, ...previousData];
        state.previousData = previousData;
        state.props.data = newData;
        state.props.estimatedItemSize = 100;
        state.didContainersLayout = true;
        state.didFinishInitialScroll = true;
        state.startBuffered = 1;
        state.endBuffered = 3;
        state.startNoBuffer = 2;
        state.endNoBuffer = 3;
        state.firstFullyOnScreenIndex = -1;
        state.idsInView = ["item-2", "item-3"];
        state.idCache = previousData.map((item) => item.id);
        state.indexByKey = new Map(previousData.map((item, index) => [item.id, index]));
        state.positions = [0, 100, 200, 300];
        state.scroll = 100;
        ctx.values.set("numContainers", 5);
        ctx.values.set("numContainersPooled", 5);
        ctx.values.set("containerItemKey2", "item-2");
        ctx.values.set("containerPosition2", 100);
        ctx.values.set("containerItemKey3", "item-3");
        ctx.values.set("containerPosition3", 200);

        checkResetContainers(ctx, newData);

        expect(calculateItemsInViewSpy).not.toHaveBeenCalled();
        expect(state.pendingPrependTransaction?.remainingKeys).toEqual(new Set(["item-pre-1", "item-pre-2"]));
        expect(state.startBuffered).toBe(3);
        expect(state.startNoBuffer).toBe(4);
    });

    it("uses the prepend transaction path on web when deferred geometry is supported", () => {
        const previousPlatform = Platform.OS;
        Platform.OS = "web";
        try {
            const previousData = [
                { id: "item-1", value: "A" },
                { id: "item-2", value: "B" },
                { id: "item-3", value: "C" },
                { id: "item-4", value: "D" },
            ];
            const newData = [{ id: "item-pre-1", value: "P1" }, { id: "item-pre-2", value: "P2" }, ...previousData];
            state.previousData = previousData;
            state.props.data = newData;
            state.props.estimatedItemSize = 100;
            state.didContainersLayout = true;
            state.didFinishInitialScroll = true;
            state.startBuffered = 2;
            state.endBuffered = 3;
            state.startNoBuffer = 2;
            state.endNoBuffer = 3;
            state.firstFullyOnScreenIndex = 2;
            state.idsInView = ["item-3", "item-4"];
            state.idCache = previousData.map((item) => item.id);
            state.indexByKey = new Map(previousData.map((item, index) => [item.id, index]));
            state.positions = [0, 100, 200, 300];
            state.scroll = 200;
            ctx.values.set("numContainers", 5);
            ctx.values.set("numContainersPooled", 5);
            ctx.values.set("containerItemKey1", "item-3");
            ctx.values.set("containerPosition1", 200);
            ctx.values.set("containerItemKey2", "item-4");
            ctx.values.set("containerPosition2", 300);

            checkResetContainers(ctx, newData);

            expect(calculateItemsInViewSpy).not.toHaveBeenCalled();
            expect(updateAveragesSpy).toHaveBeenCalledWith(state, previousData, newData);
            expect(state.pendingPrependTransaction?.remainingKeys).toEqual(new Set(["item-pre-1", "item-pre-2"]));
            expect(state.positions[4]).toBe(400);
            expect(ctx.values.get("containerPosition1")).toBe(400);
            expect(ctx.values.get("containerPosition2")).toBe(500);
        } finally {
            Platform.OS = previousPlatform;
        }
    });
});
