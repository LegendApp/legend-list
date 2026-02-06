import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import "../setup"; // Import global test setup

import { updateScroll } from "@/core/updateScroll";
import * as flushSyncModule from "@/platform/flushSync";
import { Platform } from "@/platform/Platform";
import type { StateContext } from "@/state/state";
import { createMockContext } from "../__mocks__/createMockContext";

describe("updateScroll flushSync", () => {
    let mockCtx: StateContext;
    let flushSyncSpy: ReturnType<typeof spyOn>;

    beforeEach(() => {
        Platform.OS = "ios";
        mockCtx = createMockContext({}, { scroll: 0, scrollLength: 100, triggerCalculateItemsInView: () => {} });
        flushSyncSpy = spyOn(flushSyncModule, "flushSync").mockImplementation((fn: () => void) => {
            fn();
        });
    });

    afterEach(() => {
        flushSyncSpy.mockRestore();
    });

    it("uses flushSync for large web deltas", () => {
        Platform.OS = "web";

        updateScroll(mockCtx, 150);

        expect(flushSyncSpy).toHaveBeenCalledTimes(1);
    });

    it("skips flushSync for small web deltas", () => {
        Platform.OS = "web";

        updateScroll(mockCtx, 50);

        expect(flushSyncSpy).not.toHaveBeenCalled();
    });

    it("skips flushSync on non-web platforms", () => {
        Platform.OS = "ios";

        updateScroll(mockCtx, 150);

        expect(flushSyncSpy).not.toHaveBeenCalled();
    });
});

describe("updateScroll mvcp active mode", () => {
    let mockCtx: StateContext;

    beforeEach(() => {
        Platform.OS = "ios";
        mockCtx = createMockContext({}, { scroll: 100, scrollLastCalculate: 100, scrollLength: 100 });
    });

    it("forces recalculation while an mvcp anchor lock is active", () => {
        const triggerCalculateItemsInViewSpy = spyOn(mockCtx.state, "triggerCalculateItemsInView").mockImplementation(
            () => undefined,
        );
        mockCtx.state.mvcpAnchorLock = {
            expiresAt: Date.now() + 500,
            id: "item-1",
            position: 100,
            quietPasses: 0,
        };

        updateScroll(mockCtx, 101);

        expect(triggerCalculateItemsInViewSpy).toHaveBeenCalledTimes(1);
        expect(triggerCalculateItemsInViewSpy).toHaveBeenCalledWith({ doMVCP: false });
        triggerCalculateItemsInViewSpy.mockRestore();
    });

    it("expires stale mvcp anchor locks before deciding active mode", () => {
        const triggerCalculateItemsInViewSpy = spyOn(mockCtx.state, "triggerCalculateItemsInView").mockImplementation(
            () => undefined,
        );
        mockCtx.state.mvcpAnchorLock = {
            expiresAt: Date.now() - 1,
            id: "item-1",
            position: 100,
            quietPasses: 0,
        };

        updateScroll(mockCtx, 101);

        expect(mockCtx.state.mvcpAnchorLock).toBeUndefined();
        expect(triggerCalculateItemsInViewSpy).not.toHaveBeenCalled();
        triggerCalculateItemsInViewSpy.mockRestore();
    });
});
