import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import "../setup"; // Import global test setup

import * as doMaintainScrollAtEndModule from "@/core/doMaintainScrollAtEnd";
import { updateScroll } from "@/core/updateScroll";
import * as flushSyncModule from "@/platform/flushSync";
import { Platform } from "@/platform/Platform";
import type { StateContext } from "@/state/state";
import { peek$ } from "@/state/state";
import * as requestAdjustModule from "@/utils/requestAdjust";
import { createMockContext } from "../__mocks__/createMockContext";

describe("updateScroll large user jumps", () => {
    let mockCtx: StateContext;
    let flushSyncSpy: ReturnType<typeof spyOn>;
    let originalRequestAnimationFrame: typeof globalThis.requestAnimationFrame;
    let rafCallbacks: Array<(time: number) => void>;

    beforeEach(() => {
        Platform.OS = "ios";
        mockCtx = createMockContext({}, { scroll: 0, scrollLength: 100, triggerCalculateItemsInView: () => {} });
        flushSyncSpy = spyOn(flushSyncModule, "flushSync").mockImplementation((fn: () => void) => {
            fn();
        });
        originalRequestAnimationFrame = globalThis.requestAnimationFrame;
        rafCallbacks = [];
        globalThis.requestAnimationFrame = (callback: (time: number) => void) => {
            rafCallbacks.push(callback);
            return rafCallbacks.length;
        };
    });

    afterEach(() => {
        mockCtx.state.scheduledWork.dispose();
        globalThis.requestAnimationFrame = originalRequestAnimationFrame;
        flushSyncSpy.mockRestore();
    });

    it("uses flushSync for large user scroll jumps", () => {
        Platform.OS = "web";

        updateScroll(mockCtx, 150);

        expect(flushSyncSpy).toHaveBeenCalledTimes(1);
    });

    it("resets MVCP anchoring state for large user scroll jumps on every platform", () => {
        Platform.OS = "ios";
        const cancelCalls: number[] = [];
        const originalCancelAnimationFrame = globalThis.cancelAnimationFrame;
        globalThis.cancelAnimationFrame = (id: number) => {
            cancelCalls.push(id);
        };
        try {
            mockCtx.state.mvcpAnchorLock = {
                expiresAt: Date.now() + 500,
                id: "item_0",
                position: 0,
                quietPasses: 0,
            };
            mockCtx.state.scheduledWork.frame(() => {}, "mvcpRecalculate");
            mockCtx.state.pendingNativeMVCPAdjust = {
                amount: -500,
                furthestProgressTowardAmount: 0,
                manualApplied: 0,
                startScroll: 0,
            };

            updateScroll(mockCtx, 150);

            expect(mockCtx.state.mvcpAnchorLock).toBeUndefined();
            expect(mockCtx.state.pendingNativeMVCPAdjust).toBeUndefined();
            expect(mockCtx.state.userScrollAnchorReset?.keys).toEqual(new Set());
            expect(mockCtx.state.scheduledWork.has("mvcpRecalculate")).toBe(false);
            expect(cancelCalls).toEqual([1]);
        } finally {
            globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
        }
    });

    it("does not reset MVCP anchoring state for large programmatic scroll jumps", () => {
        Platform.OS = "ios";
        const triggerCalculateItemsInViewSpy = spyOn(mockCtx.state, "triggerCalculateItemsInView").mockImplementation(
            () => undefined,
        );
        const anchorLock = {
            expiresAt: Date.now() + 500,
            id: "item_0",
            position: 0,
            quietPasses: 0,
        };
        mockCtx.state.mvcpAnchorLock = anchorLock;
        mockCtx.state.scheduledWork.frame(() => {}, "mvcpRecalculate");
        mockCtx.state.pendingNativeMVCPAdjust = {
            amount: 500,
            furthestProgressTowardAmount: 0,
            manualApplied: 0,
            startScroll: 0,
        };
        mockCtx.state.scrollingTo = { offset: 150 } as any;

        updateScroll(mockCtx, 150);

        expect(flushSyncSpy).not.toHaveBeenCalled();
        expect(triggerCalculateItemsInViewSpy).toHaveBeenCalledWith({ doMVCP: true, scrollVelocity: 0 });
        expect(mockCtx.state.mvcpAnchorLock).toBe(anchorLock);
        expect(mockCtx.state.pendingNativeMVCPAdjust).toBeDefined();
        expect(mockCtx.state.userScrollAnchorReset).toBeUndefined();
        expect(mockCtx.state.scheduledWork.has("mvcpRecalculate")).toBe(true);
        triggerCalculateItemsInViewSpy.mockRestore();
    });

    it("skips flushSync for small web deltas", () => {
        Platform.OS = "web";

        updateScroll(mockCtx, 50);

        expect(flushSyncSpy).not.toHaveBeenCalled();
    });

    it("cancels end maintenance when observed web scrolling moves away from the end", () => {
        Platform.OS = "web";
        mockCtx = createMockContext(
            { alignItemsAtEndPadding: 400, readyToRender: true, totalSize: 700 },
            {
                isWithinMaintainScrollAtEndThreshold: true,
                maintainingScrollAtEnd: "animated",
                pendingMaintainScrollAtEnd: true,
                props: { alignItemsAtEndPaddingEnabled: true, data: [{}] },
                queuedInitialLayout: true,
                scroll: 100,
                scrollLastCalculate: 100,
                scrollLength: 840,
                triggerCalculateItemsInView: () => {},
            },
        );
        const animationRequestAdjust = spyOn(mockCtx.state.scrollAdjustHandler, "requestAdjust");

        updateScroll(mockCtx, 120, undefined, { fromNativeScrollEvent: true });

        expect(mockCtx.state.maintainingScrollAtEnd).toBe("animated");
        expect(mockCtx.state.pendingMaintainScrollAtEnd).toBe(true);

        updateScroll(mockCtx, 100, undefined, { fromNativeScrollEvent: true });

        expect(mockCtx.state.maintainingScrollAtEnd).toBeUndefined();
        expect(mockCtx.state.pendingMaintainScrollAtEnd).toBe(false);
        expect(peek$(mockCtx, "alignItemsAtEndPadding")).toBe(140);
        expect(mockCtx.state.scroll).toBe(0);
        expect(animationRequestAdjust).toHaveBeenCalledWith(-100);
    });

    it("updates adaptive render from the current scroll sample", () => {
        const originalDateNow = Date.now;
        const changes: Array<[string, string]> = [];
        const now = 1000;
        Date.now = () => now;

        try {
            mockCtx = createMockContext(
                {
                    adaptiveRender: "normal",
                    readyToRender: true,
                },
                {
                    props: {
                        adaptiveRender: {
                            enterVelocity: 1,
                            onChange: (mode, reason) => changes.push([mode, reason]),
                        },
                    },
                    scroll: 0,
                    scrollHistory: [{ scroll: 0, time: 900 }],
                    scrollLength: 1000,
                    triggerCalculateItemsInView: () => {},
                },
            );

            updateScroll(mockCtx, 200);

            expect(peek$(mockCtx, "adaptiveRender")).toBe("light");
            expect(changes).toEqual([["light", "scroll"]]);
        } finally {
            mockCtx.state.scheduledWork.dispose();
            Date.now = originalDateNow;
        }
    });

    it("enters adaptive light mode for large user scroll jumps even without velocity", () => {
        const changes: Array<[string, string]> = [];
        const triggerCalculateItemsInViewSpy = spyOn(mockCtx.state, "triggerCalculateItemsInView").mockImplementation(
            () => undefined,
        );
        mockCtx.values.set("adaptiveRender", "normal");
        mockCtx.values.set("readyToRender", true);
        mockCtx.state.props.adaptiveRender = {
            enterVelocity: 10_000,
            onChange: (mode, reason) => changes.push([mode, reason]),
        };
        mockCtx.state.scrollHistory = [];

        updateScroll(mockCtx, 150);

        expect(peek$(mockCtx, "adaptiveRender")).toBe("light");
        expect(changes).toEqual([["light", "scroll"]]);
        expect(flushSyncSpy).toHaveBeenCalledTimes(1);
        expect(triggerCalculateItemsInViewSpy).toHaveBeenCalledWith({
            doMVCP: false,
            drawDistanceMode: "visible-first",
            scrollVelocity: 0,
        });
        triggerCalculateItemsInViewSpy.mockRestore();
    });

    it("uses visible-first drawDistance for large user scroll jumps and prewarms the full range", () => {
        const triggerCalculateItemsInViewSpy = spyOn(mockCtx.state, "triggerCalculateItemsInView").mockImplementation(
            () => undefined,
        );
        mockCtx.state.props.drawDistance = 1_000;

        updateScroll(mockCtx, 150);

        expect(triggerCalculateItemsInViewSpy.mock.calls[0]).toEqual([
            {
                doMVCP: false,
                drawDistanceMode: "visible-first",
                scrollVelocity: 0,
            },
        ]);
        expect(rafCallbacks).toHaveLength(1);
        expect(mockCtx.state.scheduledWork.has("fullDrawDistancePrewarm")).toBe(true);

        rafCallbacks[0](Date.now());

        expect(triggerCalculateItemsInViewSpy.mock.calls[1]).toEqual([]);
        expect(mockCtx.state.scheduledWork.has("fullDrawDistancePrewarm")).toBe(false);
        triggerCalculateItemsInViewSpy.mockRestore();
    });

    it("dedupes full drawDistance prewarm passes across repeated large user scroll jumps", () => {
        const triggerCalculateItemsInViewSpy = spyOn(mockCtx.state, "triggerCalculateItemsInView").mockImplementation(
            () => undefined,
        );
        mockCtx.state.props.drawDistance = 1_000;

        updateScroll(mockCtx, 150);
        updateScroll(mockCtx, 300);

        expect(triggerCalculateItemsInViewSpy).toHaveBeenCalledTimes(2);
        expect(triggerCalculateItemsInViewSpy.mock.calls).toEqual([
            [
                expect.objectContaining({
                    doMVCP: false,
                    drawDistanceMode: "visible-first",
                }),
            ],
            [
                expect.objectContaining({
                    doMVCP: false,
                    drawDistanceMode: "visible-first",
                }),
            ],
        ]);
        expect(rafCallbacks).toHaveLength(1);
        expect(mockCtx.state.scheduledWork.has("fullDrawDistancePrewarm")).toBe(true);
        triggerCalculateItemsInViewSpy.mockRestore();
    });

    it("does not force adaptive light mode for large programmatic scroll jumps", () => {
        const changes: string[] = [];
        const triggerCalculateItemsInViewSpy = spyOn(mockCtx.state, "triggerCalculateItemsInView").mockImplementation(
            () => undefined,
        );
        mockCtx.values.set("adaptiveRender", "normal");
        mockCtx.values.set("readyToRender", true);
        mockCtx.state.props.adaptiveRender = {
            enterVelocity: 10_000,
            onChange: (mode) => changes.push(mode),
        };
        mockCtx.state.scrollingTo = { offset: 150 } as any;
        mockCtx.state.scrollHistory = [];

        updateScroll(mockCtx, 150);

        expect(peek$(mockCtx, "adaptiveRender")).toBe("normal");
        expect(changes).toEqual([]);
        expect(flushSyncSpy).not.toHaveBeenCalled();
        expect(triggerCalculateItemsInViewSpy).toHaveBeenCalledWith({ doMVCP: true, scrollVelocity: 0 });
        triggerCalculateItemsInViewSpy.mockRestore();
    });

    it("uses flushSync for large non-web user scroll jumps", () => {
        Platform.OS = "ios";

        updateScroll(mockCtx, 150);

        expect(flushSyncSpy).toHaveBeenCalledTimes(1);
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
        expect(triggerCalculateItemsInViewSpy).toHaveBeenCalledWith({ doMVCP: false, scrollVelocity: 0 });
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
            furthestProgressTowardAmount: 0,
            manualApplied: 0,
            startScroll: 420,
        };
        mockCtx.values.set("totalSize", 300);

        updateScroll(mockCtx, 200);

        expect(requestAdjustSpy).toHaveBeenCalledWith(mockCtx, -80, "data");
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

        expect(requestAdjustSpy).toHaveBeenCalledWith(mockCtx, -80, "data");
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

        expect(requestAdjustSpy).toHaveBeenCalledWith(mockCtx, 20, "data");
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
                isWithinMaintainScrollAtEndThreshold: true,
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
                isWithinMaintainScrollAtEndThreshold: true,
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
                isWithinMaintainScrollAtEndThreshold: true,
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

        expect(requestAdjustSpy).toHaveBeenCalledWith(mockCtx, -0.33333333333325754, "data");
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
                isWithinMaintainScrollAtEndThreshold: true,
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

describe("updateScroll user scroll ownership", () => {
    const originalPlatform = Platform.OS;

    afterEach(() => {
        Platform.OS = originalPlatform;
    });

    function createUserScrollContext(isFollowingEnd = false) {
        const onUserScroll = mock(() => {});
        const ctx = createMockContext(
            { isFollowingEnd },
            { props: { onUserScroll }, scroll: 500, scrollLength: 100, triggerCalculateItemsInView: () => {} },
        );
        return { ctx, onUserScroll };
    }

    it.each(["ios", "android"] as const)("releases native following after an unowned scroll away on %s", (platform) => {
        Platform.OS = platform;
        const ctx = createMockContext(
            { isFollowingEnd: true, totalSize: 1000 },
            {
                didContainersLayout: true,
                didFinishInitialScroll: true,
                props: { data: [{}], maintainScrollAtEnd: true },
                queuedInitialLayout: true,
                scroll: 800,
                scrollLength: 200,
                triggerCalculateItemsInView: () => {},
            },
        );

        updateScroll(ctx, 0, true, { fromNativeScrollEvent: true });

        expect(peek$(ctx, "isFollowingEnd")).toBe(false);
        expect(peek$(ctx, "isWithinMaintainScrollAtEndThreshold")).toBe(false);
        expect(doMaintainScrollAtEndModule.doMaintainScrollAtEnd(ctx)).toBe(false);
        ctx.state.scheduledWork.dispose();
    });

    it.each(["isDragging", "isMomentumScrolling", "endFollowRearm"] as const)(
        "leaves native gesture ownership with %s",
        (owner) => {
            Platform.OS = "ios";
            const ctx = createMockContext(
                { isFollowingEnd: true, totalSize: 1000 },
                {
                    isDragging: owner === "isDragging",
                    isMomentumScrolling: owner === "isMomentumScrolling",
                    scroll: 800,
                    scrollLength: 200,
                    triggerCalculateItemsInView: () => {},
                    userScrollContentSize: owner === "isDragging" ? undefined : 1000,
                },
            );
            if (owner === "endFollowRearm") {
                ctx.state.scheduledWork.timeout(() => {}, 1000, "endFollowRearm");
            }
            updateScroll(ctx, 600, true, { fromNativeScrollEvent: true });
            expect(peek$(ctx, "isFollowingEnd")).toBe(true);
            ctx.state.scheduledWork.dispose();
        },
    );

    it.each(["ios", "android"] as const)("releases following during baseline-free momentum on %s", (platform) => {
        Platform.OS = platform;
        const ctx = createMockContext(
            { isFollowingEnd: true, totalSize: 1000 },
            {
                isMomentumScrolling: true,
                scroll: 690,
                scrollLength: 300,
                triggerCalculateItemsInView: () => {},
            },
        );
        try {
            updateScroll(ctx, 400, true, { fromNativeScrollEvent: true });

            expect(peek$(ctx, "isFollowingEnd")).toBe(false);
            expect(peek$(ctx, "isWithinMaintainScrollAtEndThreshold")).toBe(false);
            expect(ctx.state.endFollowInterrupted).toBe(true);
            expect(ctx.state.isMomentumScrolling).toBe(true);
        } finally {
            ctx.state.scheduledWork.dispose();
        }
    });

    it.each(["geometry", "adjustment", "mvcp", "request", "active maintenance", "pending maintenance"] as const)(
        "preserves following during baseline-free momentum with %s ownership",
        (owner) => {
            Platform.OS = "ios";
            const ctx = createMockContext(
                { isFollowingEnd: true, totalSize: 1000 },
                {
                    isMomentumScrolling: true,
                    scroll: 690,
                    scrollLength: 300,
                    triggerCalculateItemsInView: () => {},
                },
            );
            if (owner === "adjustment") ctx.state.lastScrollAdjustForHistory = 10;
            if (owner === "mvcp") {
                ctx.state.pendingNativeMVCPAdjust = {
                    amount: -300,
                    furthestProgressTowardAmount: 0,
                    manualApplied: 0,
                    startScroll: 690,
                };
            }
            if (owner === "request") {
                ctx.state.scrollingTo = { offset: 400 } as any;
                ctx.state.pendingScrollResolve = mock(() => {});
            }
            if (owner === "active maintenance") ctx.state.maintainingScrollAtEnd = "animated";
            if (owner === "pending maintenance") ctx.state.pendingMaintainScrollAtEnd = true;
            const request = ctx.state.scrollingTo;
            const resolve = ctx.state.pendingScrollResolve;
            try {
                updateScroll(ctx, 400, true, {
                    fromNativeScrollEvent: true,
                    nativeGeometryChanged: owner === "geometry",
                });

                expect(peek$(ctx, "isFollowingEnd")).toBe(true);
                expect(ctx.state.endFollowInterrupted).not.toBe(true);
                expect(ctx.state.scrollingTo).toBe(request);
                expect(ctx.state.pendingScrollResolve).toBe(resolve);
                if (resolve) expect(resolve).not.toHaveBeenCalled();
            } finally {
                ctx.state.scheduledWork.dispose();
            }
        },
    );

    function createMomentumGeometryContext() {
        const ctx = createMockContext(
            { isFollowingEnd: false, totalSize: 1000 },
            {
                didContainersLayout: true,
                didFinishInitialScroll: true,
                endFollowInterrupted: true,
                isMomentumScrolling: true,
                props: { data: [{}], maintainScrollAtEnd: true, maintainScrollAtEndThreshold: 0.25 },
                queuedInitialLayout: true,
                scroll: 400,
                scrollLength: 300,
                triggerCalculateItemsInView: () => {},
            },
        );
        ctx.state.scheduledWork.timeout(() => {}, 1000, "endFollowRearm");
        return ctx;
    }

    it.each([
        { follows: true, path: [690], start: 400 },
        { follows: true, path: [700], start: 400 },
        { follows: true, path: [690], start: 700 },
        { follows: false, path: [690, 400], start: 400 },
        { follows: true, path: [400, 690], start: 690 },
    ])("recomputes baseline-free momentum geometry: %j", ({ start, path, follows }) => {
        Platform.OS = "ios";
        const ctx = createMomentumGeometryContext();
        ctx.state.scroll = start;
        try {
            for (const offset of path) updateScroll(ctx, offset, true, { fromNativeScrollEvent: true });
            expect(peek$(ctx, "isWithinMaintainScrollAtEndThreshold")).toBe(follows);
            expect(peek$(ctx, "isFollowingEnd")).toBe(follows);
            expect(ctx.state.endFollowInterrupted).toBe(!follows);
            expect(ctx.state.scroll).toBe(path.at(-1)!);
            expect(ctx.state.isMomentumScrolling).toBe(true);
            expect(ctx.state.scheduledWork.has("endFollowRearm")).toBe(true);
        } finally {
            ctx.state.scheduledWork.dispose();
        }
    });

    it.each(["active request", "pending request", "reader anchor", "app timer", "dragging", "release baseline"])(
        "preserves %s ownership when near-end geometry is recomputed",
        (owner) => {
            Platform.OS = "ios";
            const ctx = createMomentumGeometryContext();
            if (owner === "active request") ctx.state.scrollingTo = { offset: 690 } as any;
            if (owner === "pending request") ctx.state.pendingScrollResolve = mock(() => {});
            if (owner === "reader anchor") ctx.state.visibleContentAnchor = { key: "reader", offset: 20 };
            if (owner === "app timer") ctx.state.scheduledWork.timeout(() => {}, 1000, "appScrollRearm");
            if (owner === "dragging") ctx.state.isDragging = true;
            if (owner === "release baseline") ctx.state.userScrollContentSize = 1000;
            const request = ctx.state.scrollingTo;
            const resolve = ctx.state.pendingScrollResolve;
            const anchor = ctx.state.visibleContentAnchor;
            try {
                updateScroll(ctx, 690, true);
                expect(peek$(ctx, "isWithinMaintainScrollAtEndThreshold")).toBe(true);
                expect(peek$(ctx, "isFollowingEnd")).toBe(false);
                expect(ctx.state.endFollowInterrupted).toBe(true);
                expect(ctx.state.scrollingTo).toBe(request);
                expect(ctx.state.pendingScrollResolve).toBe(resolve);
                expect(ctx.state.visibleContentAnchor).toBe(anchor);
                if (resolve) expect(resolve).not.toHaveBeenCalled();
            } finally {
                ctx.state.scheduledWork.dispose();
            }
        },
    );

    it("reads the web maximum only when an observed offset moves backward", () => {
        Platform.OS = "web";
        const getMaxScrollOffset = mock(() => 700);
        const ctx = createMockContext(
            { isFollowingEnd: true, totalSize: 1000 },
            {
                didFinishInitialScroll: true,
                props: { data: [{}], maintainScrollAtEnd: true },
                queuedInitialLayout: true,
                refScroller: { current: { getMaxScrollOffset } } as any,
                scroll: 800,
                scrollLength: 200,
            },
        );
        try {
            updateScroll(ctx, 800, true, { fromNativeScrollEvent: true });
            expect(getMaxScrollOffset).not.toHaveBeenCalled();
            updateScroll(ctx, 900, true, { fromNativeScrollEvent: true });
            expect(getMaxScrollOffset).not.toHaveBeenCalled();
            updateScroll(ctx, 700, true, { fromNativeScrollEvent: true });
            expect(getMaxScrollOffset).toHaveBeenCalledTimes(1);
            expect(peek$(ctx, "isFollowingEnd")).toBe(true);
            updateScroll(ctx, 600, true, { fromNativeScrollEvent: true });
            expect(getMaxScrollOffset).toHaveBeenCalledTimes(2);
            expect(peek$(ctx, "isFollowingEnd")).toBe(false);
        } finally {
            ctx.state.scheduledWork.dispose();
        }
    });

    it("never reports user input from unowned web or native offset events", () => {
        for (const platform of ["web", "ios"] as const) {
            Platform.OS = platform;
            for (const following of [false, true]) {
                const { ctx, onUserScroll } = createUserScrollContext(following);
                updateScroll(ctx, 400, true, { fromNativeScrollEvent: true });
                updateScroll(ctx, 350, true, { fromNativeScrollEvent: true });
                expect(onUserScroll).not.toHaveBeenCalled();
            }
        }
    });

    it("releases the reader anchor only for user scroll events", () => {
        const { ctx } = createUserScrollContext();
        const anchor = { key: "reader", offset: 20 };
        ctx.state.visibleContentAnchor = anchor;

        updateScroll(ctx, 550, true);
        expect(ctx.state.visibleContentAnchor).toBe(anchor);

        updateScroll(ctx, 600, true, { fromNativeScrollEvent: true });
        expect(ctx.state.visibleContentAnchor).toBeUndefined();
    });
});
