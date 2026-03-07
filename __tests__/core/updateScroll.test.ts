import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import "../setup"; // Import global test setup

import * as doMaintainScrollAtEndModule from "@/core/doMaintainScrollAtEnd";
import { updateScroll } from "@/core/updateScroll";
import * as flushSyncModule from "@/platform/flushSync";
import { Platform } from "@/platform/Platform";
import type { StateContext } from "@/state/state";
import * as requestAdjustModule from "@/utils/requestAdjust";
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
    let doMaintainScrollAtEndSpy: ReturnType<typeof spyOn>;

    beforeEach(() => {
        Platform.OS = "ios";
        mockCtx = createMockContext({}, { scroll: 100, scrollLastCalculate: 100, scrollLength: 100 });
        doMaintainScrollAtEndSpy = spyOn(doMaintainScrollAtEndModule, "doMaintainScrollAtEnd").mockImplementation(
            () => false,
        );
    });

    afterEach(() => {
        doMaintainScrollAtEndSpy.mockRestore();
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
        expect(doMaintainScrollAtEndSpy).not.toHaveBeenCalled();
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
        expect(doMaintainScrollAtEndSpy).not.toHaveBeenCalled();
        triggerCalculateItemsInViewSpy.mockRestore();
    });

    it("applies only the remaining native mvcp remainder after partial end shrink scroll", () => {
        const requestAdjustSpy = spyOn(requestAdjustModule, "requestAdjust");
        mockCtx.state.dataChangeNeedsScrollUpdate = true;
        mockCtx.state.pendingNativeMVCPAdjust = {
            amount: -300,
            manualApplied: 0,
            startScroll: 420,
        };

        updateScroll(mockCtx, 200);

        expect(requestAdjustSpy).toHaveBeenCalledWith(mockCtx, -80, true);
        expect(mockCtx.state.pendingNativeMVCPAdjust).toBeUndefined();
        expect(doMaintainScrollAtEndSpy).not.toHaveBeenCalled();
        requestAdjustSpy.mockRestore();
    });

    it("waits for a native scroll in the shrink direction before consuming a queued remainder", () => {
        const requestAdjustSpy = spyOn(requestAdjustModule, "requestAdjust");
        mockCtx.state.dataChangeNeedsScrollUpdate = true;
        mockCtx.state.pendingNativeMVCPAdjust = {
            amount: -300,
            manualApplied: 0,
            startScroll: 420,
        };

        updateScroll(mockCtx, 430);

        expect(requestAdjustSpy).not.toHaveBeenCalled();
        expect(mockCtx.state.pendingNativeMVCPAdjust).toBeDefined();
        expect(doMaintainScrollAtEndSpy).not.toHaveBeenCalled();

        updateScroll(mockCtx, 200);

        expect(requestAdjustSpy).toHaveBeenCalledWith(mockCtx, -80, true);
        expect(mockCtx.state.pendingNativeMVCPAdjust).toBeUndefined();
        expect(doMaintainScrollAtEndSpy).not.toHaveBeenCalled();
        requestAdjustSpy.mockRestore();
    });

    it("drops the queued native mvcp remainder when native already consumed the full delta", () => {
        const requestAdjustSpy = spyOn(requestAdjustModule, "requestAdjust");
        mockCtx.state.dataChangeNeedsScrollUpdate = true;
        mockCtx.state.pendingNativeMVCPAdjust = {
            amount: -300,
            manualApplied: 0,
            startScroll: 420,
        };

        updateScroll(mockCtx, 120);

        expect(requestAdjustSpy).not.toHaveBeenCalled();
        expect(mockCtx.state.pendingNativeMVCPAdjust).toBeUndefined();
        expect(doMaintainScrollAtEndSpy).not.toHaveBeenCalled();
        requestAdjustSpy.mockRestore();
    });

    it("waits at the predicted target until native moves beyond the manual pre-adjust", () => {
        const requestAdjustSpy = spyOn(requestAdjustModule, "requestAdjust");
        mockCtx.state.dataChangeNeedsScrollUpdate = true;
        mockCtx.state.pendingNativeMVCPAdjust = {
            amount: -300,
            manualApplied: -80,
            startScroll: 420,
        };

        updateScroll(mockCtx, 340);

        expect(requestAdjustSpy).not.toHaveBeenCalled();
        expect(mockCtx.state.pendingNativeMVCPAdjust).toEqual({
            amount: -300,
            manualApplied: -80,
            startScroll: 420,
        });
        expect(doMaintainScrollAtEndSpy).not.toHaveBeenCalled();
        requestAdjustSpy.mockRestore();
    });

    it("applies only the remaining remainder after a predicted pre-adjust and partial native clamp", () => {
        const requestAdjustSpy = spyOn(requestAdjustModule, "requestAdjust");
        mockCtx.state.dataChangeNeedsScrollUpdate = true;
        mockCtx.state.pendingNativeMVCPAdjust = {
            amount: -300,
            manualApplied: -80,
            startScroll: 420,
        };

        updateScroll(mockCtx, 200);

        expect(requestAdjustSpy).toHaveBeenCalledWith(mockCtx, -80, true);
        expect(mockCtx.state.pendingNativeMVCPAdjust).toBeUndefined();
        expect(doMaintainScrollAtEndSpy).not.toHaveBeenCalled();
        requestAdjustSpy.mockRestore();
    });

    it("requests a positive correction when native over-consumes after a predicted pre-adjust", () => {
        const requestAdjustSpy = spyOn(requestAdjustModule, "requestAdjust");
        mockCtx.state.dataChangeNeedsScrollUpdate = true;
        mockCtx.state.pendingNativeMVCPAdjust = {
            amount: -300,
            manualApplied: -80,
            startScroll: 420,
        };

        updateScroll(mockCtx, 100);

        expect(requestAdjustSpy).toHaveBeenCalledWith(mockCtx, 20, true);
        expect(mockCtx.state.pendingNativeMVCPAdjust).toBeUndefined();
        expect(doMaintainScrollAtEndSpy).not.toHaveBeenCalled();
        requestAdjustSpy.mockRestore();
    });

    it("hands off to maintainScrollAtEnd after a pending native mvcp settle on data change", () => {
        mockCtx = createMockContext(
            { totalSize: 181 },
            {
                didContainersLayout: true,
                isAtEnd: true,
                pendingNativeMVCPAdjust: {
                    amount: -20,
                    manualApplied: 0,
                    startScroll: 100,
                },
                props: {
                    maintainScrollAtEnd: { onDataChange: true },
                },
                queuedInitialLayout: true,
                refScroller: {
                    current: {
                        scrollToEnd: () => undefined,
                    } as any,
                },
                scroll: 100,
                scrollLastCalculate: 100,
                scrollLength: 100,
            },
        );
        doMaintainScrollAtEndSpy.mockRestore();
        doMaintainScrollAtEndSpy = spyOn(doMaintainScrollAtEndModule, "doMaintainScrollAtEnd").mockImplementation(
            () => true,
        );

        updateScroll(mockCtx, 80);

        expect(mockCtx.state.pendingNativeMVCPAdjust).toBeUndefined();
        expect(doMaintainScrollAtEndSpy).toHaveBeenCalledWith(mockCtx, false);
    });
});
