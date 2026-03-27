import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import "../setup"; // Import global test setup

import * as doMaintainScrollAtEndModule from "@/core/doMaintainScrollAtEnd";
import { updateScroll } from "@/core/updateScroll";
import * as flushSyncModule from "@/platform/flushSync";
import { Platform } from "@/platform/Platform";
import type { StateContext } from "@/state/state";
import type { InitialBootstrapState } from "@/typesInternal";
import * as requestAdjustModule from "@/utils/requestAdjust";
import { createMockContext } from "../__mocks__/createMockContext";

function createBootstrapState(
    overrides: Partial<InitialBootstrapState> & {
        target?: Partial<InitialBootstrapState["target"]>;
    } = {},
): InitialBootstrapState {
    return {
        commitStableFrames: 0,
        commitTargetOffset: undefined,
        didObservePlatformScroll: false,
        expectsObservedPlatformSettle: false,
        observedPlatformScrollOffset: undefined,
        observedPlatformScrollStableFrames: 0,
        phase: "projecting",
        projectionOffset: 0,
        previousObservedPlatformScrollOffset: undefined,
        stableFrames: 0,
        target: {
            desiredOffset: undefined,
            indexHint: undefined,
            key: undefined,
            viewOffset: 0,
            viewPosition: 0,
            ...overrides.target,
        },
        ...overrides,
    };
}

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

    it("resolves a pending deferred boundary handoff into a full position pass when the native scroll lands", () => {
        const triggerCalculateItemsInViewSpy = spyOn(mockCtx.state, "triggerCalculateItemsInView").mockImplementation(
            () => undefined,
        );
        mockCtx.state.scroll = 550;
        mockCtx.state.scrollLastCalculate = 550;
        mockCtx.state.scrollLength = 100;
        mockCtx.state.deferredGeometry.delta = 100;
        mockCtx.state.deferredGeometry.pendingBoundaryHandoff = {
            startScroll: 550,
            targetScroll: 650,
        };

        updateScroll(mockCtx, 650);

        expect(mockCtx.state.deferredPositionDelta).toBe(0);
        expect(mockCtx.state.deferredGeometry.pendingBoundaryHandoff).toBeUndefined();
        expect(triggerCalculateItemsInViewSpy).toHaveBeenCalledWith({
            doMVCP: false,
            forceFullItemPositions: true,
        });
        triggerCalculateItemsInViewSpy.mockRestore();
    });

    it("ignores stale web scroll events while a prepend transaction is active", () => {
        const previousPlatform = Platform.OS;
        const triggerCalculateItemsInViewSpy = spyOn(mockCtx.state, "triggerCalculateItemsInView").mockImplementation(
            () => undefined,
        );
        Platform.OS = "web";
        mockCtx.state.pendingPrependTransaction = {
            insertedKeys: new Set(["item-pre-1", "item-pre-2"]),
            remainingKeys: new Set(["item-pre-1"]),
        };
        mockCtx.state.ignoreScrollFromMVCP = { lt: 150 };

        try {
            updateScroll(mockCtx, 120);

            expect(mockCtx.state.scroll).toBe(100);
            expect(mockCtx.state.ignoreScrollFromMVCPIgnored).toBe(true);
            expect(triggerCalculateItemsInViewSpy).not.toHaveBeenCalled();
            expect(doMaintainScrollAtEndSpy).not.toHaveBeenCalled();
        } finally {
            Platform.OS = previousPlatform;
            triggerCalculateItemsInViewSpy.mockRestore();
        }
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
            furthestProgressTowardAmount: 0,
            manualApplied: 0,
            startScroll: 420,
        };
        mockCtx.values.set("totalSize", 300);

        updateScroll(mockCtx, 200);

        expect(requestAdjustSpy).toHaveBeenCalledWith(mockCtx, -80, true, "mvcp-settle-remaining");
        expect(mockCtx.state.pendingNativeMVCPAdjust).toBeUndefined();
        expect(doMaintainScrollAtEndSpy).not.toHaveBeenCalled();
        requestAdjustSpy.mockRestore();
    });

    it("abandons a queued native mvcp remainder when scroll events move in the wrong direction", () => {
        const requestAdjustSpy = spyOn(requestAdjustModule, "requestAdjust");
        mockCtx.state.dataChangeNeedsScrollUpdate = true;
        mockCtx.state.pendingNativeMVCPAdjust = {
            amount: -300,
            furthestProgressTowardAmount: 0,
            manualApplied: 0,
            startScroll: 420,
        };
        mockCtx.values.set("totalSize", 300);

        updateScroll(mockCtx, 430);

        expect(requestAdjustSpy).not.toHaveBeenCalled();
        expect(mockCtx.state.pendingNativeMVCPAdjust).toBeUndefined();
        expect(doMaintainScrollAtEndSpy).not.toHaveBeenCalled();
        requestAdjustSpy.mockRestore();
    });

    it("keeps the queued native mvcp remainder across intermediate clamp frames", () => {
        const requestAdjustSpy = spyOn(requestAdjustModule, "requestAdjust");
        mockCtx.state.dataChangeNeedsScrollUpdate = true;
        mockCtx.state.pendingNativeMVCPAdjust = {
            amount: -300,
            furthestProgressTowardAmount: 0,
            manualApplied: 0,
            startScroll: 420,
        };
        mockCtx.values.set("totalSize", 220);

        updateScroll(mockCtx, 300);

        expect(requestAdjustSpy).not.toHaveBeenCalled();
        expect(mockCtx.state.pendingNativeMVCPAdjust).toEqual(
            expect.objectContaining({
                amount: -300,
                furthestProgressTowardAmount: 120,
                manualApplied: 0,
                startScroll: 420,
            }),
        );
        expect(doMaintainScrollAtEndSpy).not.toHaveBeenCalled();
        requestAdjustSpy.mockRestore();
    });

    it("drops the queued native mvcp remainder when native already consumed the full delta", () => {
        const requestAdjustSpy = spyOn(requestAdjustModule, "requestAdjust");
        mockCtx.state.dataChangeNeedsScrollUpdate = true;
        mockCtx.state.pendingNativeMVCPAdjust = {
            amount: -300,
            furthestProgressTowardAmount: 0,
            manualApplied: 0,
            startScroll: 420,
        };
        mockCtx.values.set("totalSize", 220);

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
            furthestProgressTowardAmount: 0,
            manualApplied: -80,
            startScroll: 420,
        };
        mockCtx.values.set("totalSize", 220);

        updateScroll(mockCtx, 340);

        expect(requestAdjustSpy).not.toHaveBeenCalled();
        expect(mockCtx.state.pendingNativeMVCPAdjust).toEqual(
            expect.objectContaining({
                amount: -300,
                furthestProgressTowardAmount: 0,
                manualApplied: -80,
                startScroll: 420,
            }),
        );
        expect(doMaintainScrollAtEndSpy).not.toHaveBeenCalled();
        requestAdjustSpy.mockRestore();
    });

    it("applies only the remaining remainder after a predicted pre-adjust and partial native clamp", () => {
        const requestAdjustSpy = spyOn(requestAdjustModule, "requestAdjust");
        mockCtx.state.dataChangeNeedsScrollUpdate = true;
        mockCtx.state.pendingNativeMVCPAdjust = {
            amount: -300,
            furthestProgressTowardAmount: 0,
            manualApplied: -80,
            startScroll: 420,
        };
        mockCtx.values.set("totalSize", 300);

        updateScroll(mockCtx, 200);

        expect(requestAdjustSpy).toHaveBeenCalledWith(mockCtx, -80, true, "mvcp-settle-remaining");
        expect(mockCtx.state.pendingNativeMVCPAdjust).toBeUndefined();
        expect(doMaintainScrollAtEndSpy).not.toHaveBeenCalled();
        requestAdjustSpy.mockRestore();
    });

    it("requests a positive correction when native over-consumes after a predicted pre-adjust", () => {
        const requestAdjustSpy = spyOn(requestAdjustModule, "requestAdjust");
        mockCtx.state.dataChangeNeedsScrollUpdate = true;
        mockCtx.state.pendingNativeMVCPAdjust = {
            amount: -300,
            furthestProgressTowardAmount: 0,
            manualApplied: -80,
            startScroll: 420,
        };
        mockCtx.values.set("totalSize", 200);

        updateScroll(mockCtx, 100);

        expect(requestAdjustSpy).toHaveBeenCalledWith(mockCtx, 20, true, "mvcp-settle-remaining");
        expect(mockCtx.state.pendingNativeMVCPAdjust).toBeUndefined();
        expect(doMaintainScrollAtEndSpy).not.toHaveBeenCalled();
        requestAdjustSpy.mockRestore();
    });

    it("drops the queued native mvcp remainder when native reverses away after approaching the clamp", () => {
        const requestAdjustSpy = spyOn(requestAdjustModule, "requestAdjust");
        mockCtx.state.dataChangeNeedsScrollUpdate = true;
        mockCtx.state.pendingNativeMVCPAdjust = {
            amount: -300,
            furthestProgressTowardAmount: 120,
            manualApplied: 0,
            startScroll: 420,
        };
        mockCtx.values.set("totalSize", 220);

        updateScroll(mockCtx, 340);

        expect(requestAdjustSpy).not.toHaveBeenCalled();
        expect(mockCtx.state.pendingNativeMVCPAdjust).toBeUndefined();
        expect(doMaintainScrollAtEndSpy).not.toHaveBeenCalled();
        requestAdjustSpy.mockRestore();
    });

    it("hands off to maintainScrollAtEnd after a pending native mvcp settle on data change", () => {
        mockCtx = createMockContext(
            { totalSize: 180 },
            {
                didContainersLayout: true,
                isAtEnd: true,
                pendingNativeMVCPAdjust: {
                    amount: -20,
                    furthestProgressTowardAmount: 0,
                    manualApplied: 0,
                    startScroll: 100,
                },
                props: {
                    maintainScrollAtEnd: { animated: true, on: { dataChange: true } },
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
        expect(doMaintainScrollAtEndSpy).toHaveBeenCalledWith(mockCtx);
    });

    it("settles once native consumes the queued remainder even before reaching the computed clamp", () => {
        const requestAdjustSpy = spyOn(requestAdjustModule, "requestAdjust");
        mockCtx = createMockContext(
            { totalSize: 1589 },
            {
                didContainersLayout: true,
                isAtEnd: true,
                pendingMaintainScrollAtEnd: true,
                pendingNativeMVCPAdjust: {
                    amount: -92.25,
                    furthestProgressTowardAmount: 0,
                    manualApplied: -37.91664632161462,
                    startScroll: 984.6666666666666,
                },
                props: {
                    maintainScrollAtEnd: { animated: true, on: { dataChange: true } },
                },
                queuedInitialLayout: true,
                refScroller: {
                    current: {
                        scrollToEnd: () => undefined,
                    } as any,
                },
                scroll: 946.750020345052,
                scrollLastCalculate: 946.750020345052,
                scrollLength: 658.6666870117188,
            },
        );
        doMaintainScrollAtEndSpy.mockRestore();
        doMaintainScrollAtEndSpy = spyOn(doMaintainScrollAtEndModule, "doMaintainScrollAtEnd").mockImplementation(
            () => true,
        );

        updateScroll(mockCtx, 892.3333333333334);

        expect(requestAdjustSpy).not.toHaveBeenCalled();
        expect(mockCtx.state.pendingNativeMVCPAdjust).toBeUndefined();
        expect(mockCtx.state.pendingMaintainScrollAtEnd).toBe(false);
        expect(doMaintainScrollAtEndSpy).toHaveBeenCalledWith(mockCtx);
        requestAdjustSpy.mockRestore();
    });

    it("hands off to maintainScrollAtEnd when native stops short but remains inside the end threshold", () => {
        const requestAdjustSpy = spyOn(requestAdjustModule, "requestAdjust");
        mockCtx = createMockContext(
            { totalSize: 2410.5 },
            {
                didContainersLayout: true,
                isAtEnd: true,
                pendingMaintainScrollAtEnd: true,
                pendingNativeMVCPAdjust: {
                    amount: -100,
                    furthestProgressTowardAmount: 0,
                    manualApplied: -38.16664632161451,
                    startScroll: 1813.6666666666667,
                },
                props: {
                    maintainScrollAtEnd: { animated: true, on: { dataChange: true } },
                },
                queuedInitialLayout: true,
                refScroller: {
                    current: {
                        scrollToEnd: () => undefined,
                    } as any,
                },
                scroll: 1775.5000203450522,
                scrollLastCalculate: 1775.5000203450522,
                scrollLength: 658.6666870117188,
            },
        );
        doMaintainScrollAtEndSpy.mockRestore();
        doMaintainScrollAtEndSpy = spyOn(doMaintainScrollAtEndModule, "doMaintainScrollAtEnd").mockImplementation(
            () => true,
        );

        updateScroll(mockCtx, 1714);

        expect(requestAdjustSpy).toHaveBeenCalledWith(
            mockCtx,
            -0.33333333333325754,
            true,
            "mvcp-settle-remaining",
        );
        expect(mockCtx.state.pendingNativeMVCPAdjust).toBeUndefined();
        expect(mockCtx.state.pendingMaintainScrollAtEnd).toBe(false);
        expect(doMaintainScrollAtEndSpy).toHaveBeenCalledWith(mockCtx);
        requestAdjustSpy.mockRestore();
    });

    it("hands off to maintainScrollAtEnd after a pending native mvcp settle that was originally queued by layout/item triggers", () => {
        mockCtx = createMockContext(
            { totalSize: 180 },
            {
                didContainersLayout: true,
                isAtEnd: true,
                pendingMaintainScrollAtEnd: true,
                pendingNativeMVCPAdjust: {
                    amount: -20,
                    furthestProgressTowardAmount: 0,
                    manualApplied: 0,
                    startScroll: 100,
                },
                props: {
                    maintainScrollAtEnd: { animated: true, on: { layout: true } },
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
        expect(mockCtx.state.pendingMaintainScrollAtEnd).toBe(false);
        expect(doMaintainScrollAtEndSpy).toHaveBeenCalledWith(mockCtx);
    });
});

describe("updateScroll bootstrap observation", () => {
    let mockCtx: StateContext;

    beforeEach(() => {
        Platform.OS = "web";
        mockCtx = createMockContext({}, { scroll: 1000, scrollLastCalculate: 1000, scrollLength: 100 });
        mockCtx.state.initialBootstrap = createBootstrapState({
            projectionOffset: 20,
            target: {
                desiredOffset: 1000,
                indexHint: 9,
                key: "item-9",
                viewOffset: 0,
                viewPosition: 1,
            },
        });
    });

    it("keeps bootstrap active and resyncs projection when observed platform scroll moves away from the desired target", () => {
        updateScroll(mockCtx, 940);

        expect(mockCtx.state.initialBootstrap?.phase).not.toBe("inactive");
        expect(mockCtx.state.initialBootstrap?.projectionOffset).toBe(60);
        expect(mockCtx.state.initialBootstrap?.didObservePlatformScroll).toBe(true);
        expect(mockCtx.state.initialBootstrap?.observedPlatformScrollOffset).toBe(940);
    });

    it("keeps bootstrap active during synthetic adjust-driven movement", () => {
        mockCtx.state.lastScrollAdjustForHistory = 0;
        mockCtx.state.scrollAdjustHandler.getAdjust = () => 30;

        updateScroll(mockCtx, 970);

        expect(mockCtx.state.initialBootstrap?.phase).not.toBe("inactive");
    });

    it("keeps bootstrap active when movement stays within epsilon of the desired target", () => {
        updateScroll(mockCtx, 980.5);

        expect(mockCtx.state.initialBootstrap?.phase).not.toBe("inactive");
        expect(mockCtx.state.initialBootstrap?.projectionOffset).toBe(19.5);
    });

    it("recomputes bootstrap projection when a native scroll lands near the desired target", () => {
        Platform.OS = "android";
        mockCtx.state.scroll = 39753.66796875;
        mockCtx.state.scrollLastCalculate = 39753.66796875;
        mockCtx.state.initialBootstrap = createBootstrapState({
            projectionOffset: 0.83203125,
            stableFrames: 1,
            target: {
                desiredOffset: 39754.5,
                indexHint: 99,
                key: "id99",
                viewOffset: 0,
                viewPosition: 1,
            },
        });

        updateScroll(mockCtx, 39754.66796875);

        expect(mockCtx.state.initialBootstrap?.phase).not.toBe("inactive");
        expect(mockCtx.state.initialBootstrap?.projectionOffset).toBeCloseTo(-0.16796875, 6);
    });
});
