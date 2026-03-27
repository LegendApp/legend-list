import { describe, expect, it, mock, spyOn } from "bun:test";
import {
    canFlushDeferredPositionStateBoundary,
    flushDeferredPositionStateBoundary,
    getDeferredGeometrySettleAdjust,
    resetDeferredPositionState,
    setDeferredGeometryAnchor,
    shouldDeferDeferredPositionRebaseForActiveMVCP,
    syncDeferredGeometryAnchorMeasurement,
} from "../../src/core/deferredPositionState";
import { setRuntimeCallbacks } from "../../src/core/runtimeCallbacks";
import { Platform } from "../../src/platform/Platform";
import { createMockContext } from "../__mocks__/createMockContext";
import { createMockState } from "../__mocks__/createMockState";

describe("deferredPositionState", () => {
    it("resets deferred position state back to its idle values", () => {
        const state = createMockState({
            deferredPositionDelta: 120,
            pendingDeferredSizeShift: 40,
        });

        resetDeferredPositionState(state);

        expect(state.deferredPositionDelta).toBe(0);
        expect(state.pendingDeferredSizeShift).toBe(0);
        expect(state.deferredGeometry.residualAnchorError).toBe(0);
        expect(state.deferredGeometry.anchor).toEqual({
            desiredViewportOffset: undefined,
            indexHint: undefined,
            key: undefined,
            lastMeasuredViewportOffset: undefined,
        });
    });

    it("flushes deferred position state at a boundary and forces a full position pass", () => {
        const ctx = createMockContext({}, { deferredPositionDelta: 120, pendingDeferredSizeShift: 40 });
        const triggerCalculateItemsInView = spyOn(ctx.state, "triggerCalculateItemsInView").mockImplementation(
            () => undefined,
        );
        const requestAdjustSpy = mock(() => undefined);
        setRuntimeCallbacks(ctx, {
            requestAdjust: requestAdjustSpy,
        });

        try {
            expect(flushDeferredPositionStateBoundary(ctx)).toBe(true);

            expect(ctx.state.deferredPositionDelta).toBe(0);
            expect(ctx.state.pendingDeferredSizeShift).toBe(0);
            expect(requestAdjustSpy).toHaveBeenCalledWith(120, undefined);
            expect(triggerCalculateItemsInView).toHaveBeenCalledWith({ forceFullItemPositions: true });
        } finally {
            triggerCalculateItemsInView.mockRestore();
        }
    });

    it("does nothing when there is no deferred position state to flush", () => {
        const ctx = createMockContext();
        const triggerCalculateItemsInView = spyOn(ctx.state, "triggerCalculateItemsInView").mockImplementation(
            () => undefined,
        );
        const requestAdjustSpy = mock(() => undefined);
        setRuntimeCallbacks(ctx, {
            requestAdjust: requestAdjustSpy,
        });

        try {
            expect(flushDeferredPositionStateBoundary(ctx)).toBe(false);

            expect(requestAdjustSpy).not.toHaveBeenCalled();
            expect(triggerCalculateItemsInView).not.toHaveBeenCalled();
        } finally {
            triggerCalculateItemsInView.mockRestore();
        }
    });

    it("tracks residual anchor error separately from projected deferred delta", () => {
        const state = createMockState({
            deferredPositionDelta: 120,
        });

        setDeferredGeometryAnchor(state, {
            desiredViewportOffset: 200,
            indexHint: 3,
            key: "item_3",
        });

        expect(syncDeferredGeometryAnchorMeasurement(state, 188)).toBe(-12);
        expect(state.deferredGeometry.anchor.lastMeasuredViewportOffset).toBe(188);
        expect(state.deferredGeometry.residualAnchorError).toBe(-12);
        expect(getDeferredGeometrySettleAdjust(state)).toBe(-12);
    });

    it("only reports a boundary flush as available when deferred state exists and no owner blocks it", () => {
        expect(canFlushDeferredPositionStateBoundary(createMockState())).toBe(false);
        expect(
            canFlushDeferredPositionStateBoundary(
                createMockState({
                    deferredPositionDelta: 120,
                }),
            ),
        ).toBe(true);
        expect(
            canFlushDeferredPositionStateBoundary(
                createMockState({
                    deferredPositionDelta: 120,
                    ignoreScrollFromMVCP: { lt: 20 } as any,
                }),
            ),
        ).toBe(false);
    });

    it("defers native deferred-position rebases while a fresh mvcp adjust is still active", () => {
        const previousPlatform = Platform.OS;
        Platform.OS = "ios";

        try {
            expect(
                shouldDeferDeferredPositionRebaseForActiveMVCP(
                    createMockState({
                        pendingNativeMVCPAdjust: {
                            amount: -20,
                            furthestProgressTowardAmount: 0,
                            manualApplied: 0,
                            startScroll: 100,
                        },
                    }),
                ),
            ).toBe(true);
        } finally {
            Platform.OS = previousPlatform;
        }
    });

    it("defers web deferred-position rebases while mvcp settling is active", () => {
        const previousPlatform = Platform.OS;
        Platform.OS = "web";

        try {
            expect(
                shouldDeferDeferredPositionRebaseForActiveMVCP(
                    createMockState({
                        ignoreScrollFromMVCP: { lt: 20 },
                    }),
                ),
            ).toBe(true);
        } finally {
            Platform.OS = previousPlatform;
        }
    });

    it("defers web deferred-position rebases while an mvcp anchor lock is active", () => {
        const previousPlatform = Platform.OS;
        Platform.OS = "web";

        try {
            expect(
                shouldDeferDeferredPositionRebaseForActiveMVCP(
                    createMockState({
                        mvcpAnchorLock: {
                            expiresAt: Date.now() + 1000,
                            id: "item_0",
                            position: 0,
                            quietPasses: 0,
                        },
                    }),
                ),
            ).toBe(true);
        } finally {
            Platform.OS = previousPlatform;
        }
    });
});
