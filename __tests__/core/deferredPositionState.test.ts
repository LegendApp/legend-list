import { describe, expect, it, spyOn } from "bun:test";
import {
    flushDeferredPositionStateBoundary,
    resetDeferredPositionState,
    shouldDeferDeferredPositionRebaseForActiveMVCP,
} from "../../src/core/deferredPositionState";
import { Platform } from "../../src/platform/Platform";
import * as requestAdjustModule from "../../src/utils/requestAdjust";
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
    });

    it("flushes deferred position state at a boundary and forces a full position pass", () => {
        const ctx = createMockContext({}, { deferredPositionDelta: 120, pendingDeferredSizeShift: 40 });
        const triggerCalculateItemsInView = spyOn(ctx.state, "triggerCalculateItemsInView").mockImplementation(
            () => undefined,
        );
        const requestAdjustSpy = spyOn(requestAdjustModule, "requestAdjust");

        try {
            expect(flushDeferredPositionStateBoundary(ctx)).toBe(true);

            expect(ctx.state.deferredPositionDelta).toBe(0);
            expect(ctx.state.pendingDeferredSizeShift).toBe(0);
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
            expect(flushDeferredPositionStateBoundary(ctx)).toBe(false);

            expect(requestAdjustSpy).not.toHaveBeenCalled();
            expect(triggerCalculateItemsInView).not.toHaveBeenCalled();
        } finally {
            requestAdjustSpy.mockRestore();
            triggerCalculateItemsInView.mockRestore();
        }
    });

    it("defers native deferred-position rebases while a fresh mvcp adjust is still active", () => {
        const previousPlatform = Platform.OS;
        Platform.OS = "ios";

        try {
            expect(
                shouldDeferDeferredPositionRebaseForActiveMVCP(
                    createMockState({
                        nativeMVCPSettling: true,
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
                        nativeMVCPSettling: true,
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

    it("defers web deferred-position rebases while the initial-scroll mvcp anchor window is active", () => {
        const previousPlatform = Platform.OS;
        Platform.OS = "web";

        try {
            expect(
                shouldDeferDeferredPositionRebaseForActiveMVCP(
                    createMockState({
                        initialScrollMVCPAnchorUntil: Date.now() + 1000,
                    }),
                ),
            ).toBe(true);
        } finally {
            Platform.OS = previousPlatform;
        }
    });
});
