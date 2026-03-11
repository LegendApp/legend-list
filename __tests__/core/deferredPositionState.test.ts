import { describe, expect, it, spyOn } from "bun:test";
import { flushDeferredPositionStateBoundary, resetDeferredPositionState } from "../../src/core/deferredPositionState";
import * as requestAdjustModule from "../../src/utils/requestAdjust";
import { createMockContext } from "../__mocks__/createMockContext";
import { createMockState } from "../__mocks__/createMockState";

describe("deferredPositionState", () => {
    it("resets deferred position state back to its idle values", () => {
        const state = createMockState({
            deferredPositionDelta: 120,
            pendingDeferredSizeShift: 40,
            pendingDeferredSizeShiftMinIndex: 3,
        });

        resetDeferredPositionState(state);

        expect(state.deferredPositionDelta).toBe(0);
        expect(state.pendingDeferredSizeShift).toBe(0);
        expect(state.pendingDeferredSizeShiftMinIndex).toBe(Infinity);
    });

    it("flushes deferred position state at a boundary and forces a full position pass", () => {
        const ctx = createMockContext({}, { deferredPositionDelta: 120, pendingDeferredSizeShift: 40 });
        const triggerCalculateItemsInView = spyOn(ctx.state, "triggerCalculateItemsInView").mockImplementation(
            () => undefined,
        );
        const requestAdjustSpy = spyOn(requestAdjustModule, "requestAdjust");

        try {
            expect(flushDeferredPositionStateBoundary(ctx, "scrollEnd")).toBe(true);

            expect(ctx.state.deferredPositionDelta).toBe(0);
            expect(ctx.state.pendingDeferredSizeShift).toBe(0);
            expect(ctx.state.pendingDeferredSizeShiftMinIndex).toBe(Infinity);
            expect(requestAdjustSpy).toHaveBeenCalledWith(ctx, 120);
            expect(triggerCalculateItemsInView).toHaveBeenCalledWith({ forceFullItemPositions: true });
        } finally {
            requestAdjustSpy.mockRestore();
            triggerCalculateItemsInView.mockRestore();
        }
    });

    it("does nothing when there is no deferred position state to flush", () => {
        const ctx = createMockContext();
        const triggerCalculateItemsInView = spyOn(ctx.state, "triggerCalculateItemsInView").mockImplementation(
            () => undefined,
        );
        const requestAdjustSpy = spyOn(requestAdjustModule, "requestAdjust");

        try {
            expect(flushDeferredPositionStateBoundary(ctx, "scrollEnd")).toBe(false);

            expect(requestAdjustSpy).not.toHaveBeenCalled();
            expect(triggerCalculateItemsInView).not.toHaveBeenCalled();
        } finally {
            requestAdjustSpy.mockRestore();
            triggerCalculateItemsInView.mockRestore();
        }
    });
});
