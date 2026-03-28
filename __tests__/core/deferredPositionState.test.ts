import { describe, expect, it, mock, spyOn } from "bun:test";
import {
    canFlushDeferredPositionStateBoundary,
    flushDeferredPositionStateBoundary,
    getDeferredGeometrySettleAdjust,
    resetDeferredPositionState,
    resolvePendingDeferredPositionBoundaryHandoff,
    setDeferredGeometryAnchor,
    shouldDeferDeferredPositionRebaseForActiveMVCP,
    syncDeferredGeometryAnchorMeasurement,
} from "../../src/core/deferredPositionState";
import { ScrollAdjustHandler } from "../../src/core/ScrollAdjustHandler";
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

    it("starts a native deferred boundary handoff without forcing an immediate full position pass", () => {
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

            expect(ctx.state.deferredPositionDelta).toBe(120);
            expect(ctx.state.pendingDeferredSizeShift).toBe(40);
            expect(ctx.state.deferredGeometry.pendingBoundaryHandoff).toEqual(
                expect.objectContaining({
                    startScroll: 0,
                    targetScroll: 120,
                }),
            );
            expect(requestAdjustSpy).toHaveBeenCalledWith(120, undefined, {
                mutateScrollState: false,
                source: "deferred-boundary-flush",
            });
            expect(triggerCalculateItemsInView).toHaveBeenCalledTimes(1);
            expect(triggerCalculateItemsInView).toHaveBeenCalledWith({});
        } finally {
            resetDeferredPositionState(ctx.state);
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

    it("adds projected deferred delta to residual anchor error for settle handoff", () => {
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
        expect(getDeferredGeometrySettleAdjust(state)).toBe(108);
    });

    it("starts a native deferred boundary handoff with projected delta plus residual anchor error", () => {
        const ctx = createMockContext({}, { deferredPositionDelta: 120, pendingDeferredSizeShift: 40 });
        const triggerCalculateItemsInView = spyOn(ctx.state, "triggerCalculateItemsInView").mockImplementation(
            () => undefined,
        );
        const requestAdjustSpy = mock(() => undefined);
        setRuntimeCallbacks(ctx, {
            requestAdjust: requestAdjustSpy,
        });
        setDeferredGeometryAnchor(ctx.state, {
            desiredViewportOffset: 200,
            indexHint: 3,
            key: "item_3",
        });
        syncDeferredGeometryAnchorMeasurement(ctx.state, 188);

        try {
            expect(flushDeferredPositionStateBoundary(ctx)).toBe(true);

            expect(ctx.state.deferredGeometry.pendingBoundaryHandoff).toEqual(
                expect.objectContaining({
                    startScroll: 0,
                    targetScroll: 108,
                }),
            );
            expect(requestAdjustSpy).toHaveBeenCalledWith(108, undefined, {
                mutateScrollState: false,
                source: "deferred-boundary-flush",
            });
            expect(triggerCalculateItemsInView).toHaveBeenCalledTimes(1);
            expect(triggerCalculateItemsInView).toHaveBeenCalledWith({});
        } finally {
            resetDeferredPositionState(ctx.state);
            triggerCalculateItemsInView.mockRestore();
        }
    });

    it("falls back to materializing the deferred boundary handoff when no native scroll event arrives", () => {
        const originalSetTimeout = globalThis.setTimeout;
        globalThis.setTimeout = ((callback: (...args: any[]) => void) => {
            callback();
            return 1 as unknown as ReturnType<typeof setTimeout>;
        }) as typeof globalThis.setTimeout;
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

            expect(requestAdjustSpy).toHaveBeenCalledWith(120, undefined, {
                mutateScrollState: false,
                source: "deferred-boundary-flush",
            });
            expect(ctx.state.scroll).toBe(120);
            expect(ctx.state.scrollPending).toBe(120);
            expect(ctx.state.scrollAdjustHandler.getAdjust()).toBe(0);
            expect(ctx.state.deferredPositionDelta).toBe(0);
            expect(ctx.state.deferredGeometry.pendingBoundaryHandoff).toBeUndefined();
            expect(ctx.state.pendingStartReachedAfterDeferredBoundaryHandoff).toBe(true);
            expect(triggerCalculateItemsInView).toHaveBeenNthCalledWith(1, {});
            expect(triggerCalculateItemsInView).toHaveBeenNthCalledWith(2, { forceFullItemPositions: true });
        } finally {
            globalThis.setTimeout = originalSetTimeout;
            triggerCalculateItemsInView.mockRestore();
        }
    });

    it("consumes the synthetic scroll adjust once native reaches the deferred handoff target", () => {
        const ctx = createMockContext(
            {
                readyToRender: true,
            },
            { deferredPositionDelta: 120, pendingDeferredSizeShift: 40 },
        );
        ctx.state.scrollAdjustHandler = new ScrollAdjustHandler(ctx);
        const triggerCalculateItemsInView = spyOn(ctx.state, "triggerCalculateItemsInView").mockImplementation(
            () => undefined,
        );

        try {
            expect(flushDeferredPositionStateBoundary(ctx)).toBe(true);
            expect(ctx.state.scrollAdjustHandler.getAdjust()).toBe(120);

            expect(resolvePendingDeferredPositionBoundaryHandoff(ctx.state, 120)).toBe(true);

            expect(ctx.state.scrollAdjustHandler.getAdjust()).toBe(0);
            expect(ctx.state.deferredGeometry.pendingBoundaryHandoff).toBeUndefined();
            expect(ctx.state.deferredPositionDelta).toBe(0);
        } finally {
            resetDeferredPositionState(ctx.state);
            triggerCalculateItemsInView.mockRestore();
        }
    });

    it("still forces an immediate full position pass for web deferred boundary flushes", () => {
        const previousPlatform = Platform.OS;
        Platform.OS = "web";
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
            expect(ctx.state.deferredGeometry.pendingBoundaryHandoff).toBeUndefined();
            expect(requestAdjustSpy).toHaveBeenCalledWith(120, undefined, undefined);
            expect(triggerCalculateItemsInView).toHaveBeenNthCalledWith(1, {});
            expect(triggerCalculateItemsInView).toHaveBeenNthCalledWith(2, { forceFullItemPositions: true });
        } finally {
            Platform.OS = previousPlatform;
            triggerCalculateItemsInView.mockRestore();
        }
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
        expect(
            canFlushDeferredPositionStateBoundary(
                createMockState({
                    deferredPositionDelta: 120,
                    pendingPrependTransaction: {
                        anchorIndex: 0,
                        anchorKey: "item_0",
                        anchorPosition: 0,
                        estimatedInsertedTotal: 120,
                        insertedKeys: new Set(["item_pre_0"]),
                        remainingKeys: new Set(["item_pre_0"]),
                        usesDeferredGeometry: true,
                    },
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
