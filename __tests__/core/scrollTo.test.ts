import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import "../setup";

import * as checkFinishedScrollModule from "@/core/checkFinishedScroll";
import * as doScrollToModule from "@/core/doScrollTo";
import { scrollTo } from "@/core/scrollTo";
import { Platform } from "@/platform/Platform";
import type { StateContext } from "@/state/state";
import { createMockContext } from "../__mocks__/createMockContext";

describe("scrollTo", () => {
    let mockCtx: StateContext;
    let checkFinishedScrollSpy: ReturnType<typeof spyOn>;
    let doScrollToSpy: ReturnType<typeof spyOn>;
    const originalPlatform = Platform.OS;

    beforeEach(() => {
        Platform.OS = "ios";
        mockCtx = createMockContext(
            { totalSize: 1000 },
            {
                didFinishInitialScroll: false,
                scroll: 25,
                scrollLength: 300,
            },
        );
        checkFinishedScrollSpy = spyOn(checkFinishedScrollModule, "checkFinishedScroll").mockImplementation(
            () => undefined,
        );
        doScrollToSpy = spyOn(doScrollToModule, "doScrollTo").mockImplementation(() => undefined);
    });

    afterEach(() => {
        Platform.OS = originalPlatform;
        checkFinishedScrollSpy.mockRestore();
        doScrollToSpy.mockRestore();
    });

    it("cancels pending finish checks before starting a new scroll", () => {
        const cancelCalls: number[] = [];
        const clearTimeoutCalls: Array<ReturnType<typeof setTimeout>> = [];
        const originalCancelAnimationFrame = globalThis.cancelAnimationFrame;
        const clearTimeoutSpy = spyOn(globalThis, "clearTimeout").mockImplementation((timeout) => {
            clearTimeoutCalls.push(timeout);
        });

        globalThis.cancelAnimationFrame = ((id: number) => {
            cancelCalls.push(id);
        }) as typeof cancelAnimationFrame;
        mockCtx.state.animFrameCheckFinishedScroll = 11 as never;
        mockCtx.state.timeoutCheckFinishedScrollFallback = 22 as never;

        try {
            scrollTo(mockCtx, { animated: true, offset: 60 });
        } finally {
            globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
            clearTimeoutSpy.mockRestore();
        }

        expect(cancelCalls).toEqual([11]);
        expect(clearTimeoutCalls).toEqual([22]);
    });

    it("keeps initial iOS scrolls local without forcing a native scroll", () => {
        scrollTo(mockCtx, {
            animated: false,
            isInitialScroll: true,
            offset: 120,
        });

        expect(doScrollToSpy).not.toHaveBeenCalled();
        expect(mockCtx.state.scroll).toBe(120);
        expect(mockCtx.state.scrollPending).toBe(120);
        expect(mockCtx.state.scrollingTo).toEqual({
            animated: false,
            isInitialScroll: true,
            logicalTargetOffset: 120,
            offset: 120,
            targetOffset: 120,
        });
    });

    it("stores the resolved clamped target offset on scrollingTo", () => {
        mockCtx.state.totalSize = 1000;
        mockCtx.state.scrollLength = 300;

        scrollTo(mockCtx, {
            animated: false,
            index: 99,
            isInitialScroll: true,
            itemSize: 200,
            offset: 900,
            viewPosition: 1,
        });

        expect(mockCtx.state.scrollingTo).toEqual({
            animated: false,
            index: 99,
            isInitialScroll: true,
            itemSize: 200,
            logicalTargetOffset: 900,
            offset: 900,
            targetOffset: 700,
            viewPosition: 1,
        });
        expect(mockCtx.state.scrollPending).toBe(700);
    });

    it("flushes deferred position state before starting an imperative scroll", () => {
        const triggerCalculateItemsInView = spyOn(mockCtx.state, "triggerCalculateItemsInView");
        mockCtx.state.deferredPositionDelta = 120;
        mockCtx.state.pendingDeferredSizeShift = 40;

        scrollTo(mockCtx, {
            animated: false,
            forceScroll: true,
            offset: 140,
        });

        expect(mockCtx.state.deferredPositionDelta).toBe(0);
        expect(mockCtx.state.pendingDeferredSizeShift).toBe(0);
        expect(mockCtx.state.scroll).toBe(145);
        expect(triggerCalculateItemsInView).toHaveBeenCalledWith({ forceFullItemPositions: true });
        expect(mockCtx.state.scrollingTo).toEqual({
            animated: false,
            logicalTargetOffset: 140,
            offset: 140,
            targetOffset: 140,
        });
    });

    it("forces native scroll dispatches for initial retries", () => {
        scrollTo(mockCtx, {
            animated: true,
            forceScroll: true,
            isInitialScroll: true,
            offset: 140,
        });

        expect(doScrollToSpy).toHaveBeenCalledWith(mockCtx, {
            animated: true,
            horizontal: false,
            isInitialScroll: true,
            offset: 140,
        });
    });

    it("stores zero-offset initial retries without extra bookkeeping", () => {
        scrollTo(mockCtx, {
            animated: false,
            forceScroll: true,
            isInitialScroll: true,
            offset: 0,
        });

        expect(doScrollToSpy).toHaveBeenCalledWith(mockCtx, {
            animated: false,
            horizontal: false,
            isInitialScroll: true,
            offset: 0,
        });
        expect(mockCtx.state.scrollingTo).toEqual({
            animated: false,
            isInitialScroll: true,
            logicalTargetOffset: 0,
            offset: 0,
            targetOffset: 0,
        });
    });

    it("skips a duplicate settled initial-scroll target instead of re-arming the watchdog", () => {
        mockCtx.state.hasScrolled = true;
        mockCtx.state.scroll = 140;
        mockCtx.state.scrollPending = 140;
        mockCtx.state.scrollingTo = {
            animated: false,
            index: 3,
            isInitialScroll: true,
            offset: 140,
            targetOffset: 140,
        };

        scrollTo(mockCtx, {
            animated: false,
            forceScroll: true,
            index: 3,
            isInitialScroll: true,
            offset: 140,
            precomputedWithViewOffset: true,
        });

        expect(doScrollToSpy).not.toHaveBeenCalled();
        expect(checkFinishedScrollSpy).toHaveBeenCalledWith(mockCtx);
        expect(mockCtx.state.scrollingTo).toEqual({
            animated: false,
            index: 3,
            isInitialScroll: true,
            offset: 140,
            targetOffset: 140,
        });
    });

    it("keeps the active initial scroll logical target when a clamp retry uses noScrollingTo", () => {
        mockCtx.state.scrollingTo = {
            animated: false,
            index: 5,
            isInitialScroll: true,
            logicalTargetOffset: 220,
            offset: 220,
            targetOffset: 220,
            viewOffset: 0,
        };
        scrollTo(mockCtx, {
            animated: false,
            forceScroll: true,
            isInitialScroll: true,
            noScrollingTo: true,
            offset: 180,
            precomputedWithViewOffset: true,
        });

        expect(doScrollToSpy).toHaveBeenCalledWith(mockCtx, {
            animated: false,
            horizontal: false,
            isInitialScroll: true,
            offset: 180,
        });
        expect(mockCtx.state.scrollingTo).toEqual({
            animated: false,
            index: 5,
            isInitialScroll: true,
            logicalTargetOffset: 220,
            offset: 180,
            targetOffset: 220,
            viewOffset: 0,
        });
    });

    it("still issues the first native scroll before native movement has been observed", () => {
        mockCtx.state.initialBootstrap = {
            active: false,
            desiredOffset: 220,
            stableFrames: 0,
            targetIndexHint: 5,
            targetKey: "item_5",
            viewOffset: 0,
            viewPosition: 0,
        } as any;
        mockCtx.state.queuedInitialLayout = true;
        mockCtx.state.scrollPending = 220;
        mockCtx.state.scrollingTo = {
            animated: false,
            index: 5,
            isInitialScroll: true,
            logicalTargetOffset: 220,
            offset: 220,
            targetOffset: 220,
            viewOffset: 0,
        };

        scrollTo(mockCtx, {
            animated: false,
            forceScroll: true,
            index: 5,
            isInitialScroll: true,
            offset: 900,
            precomputedWithViewOffset: true,
        });

        expect(doScrollToSpy).toHaveBeenCalledWith(mockCtx, {
            animated: false,
            horizontal: false,
            isInitialScroll: true,
            offset: 700,
        });
        expect(mockCtx.state.scrollPending).toBe(700);
        expect(mockCtx.state.scrollingTo).toEqual({
            animated: false,
            index: 5,
            isInitialScroll: true,
            logicalTargetOffset: 900,
            offset: 900,
            precomputedWithViewOffset: true,
            targetOffset: 700,
        });
    });

    it("does not issue a second native scroll for a queued-layout clamp recompute after native dispatch", () => {
        mockCtx.state.initialBootstrap = {
            active: false,
            desiredOffset: 220,
            stableFrames: 0,
            targetIndexHint: 5,
            targetKey: "item_5",
            viewOffset: 0,
            viewPosition: 0,
        } as any;
        mockCtx.state.didDispatchNativeScroll = true;
        mockCtx.state.queuedInitialLayout = true;
        mockCtx.state.scrollPending = 220;
        mockCtx.state.scrollingTo = {
            animated: false,
            index: 5,
            isInitialScroll: true,
            logicalTargetOffset: 220,
            offset: 220,
            targetOffset: 220,
            viewOffset: 0,
        };

        scrollTo(mockCtx, {
            animated: false,
            forceScroll: true,
            index: 5,
            isInitialScroll: true,
            offset: 900,
            precomputedWithViewOffset: true,
        });

        expect(doScrollToSpy).not.toHaveBeenCalled();
        expect(mockCtx.state.scrollPending).toBe(220);
        expect(mockCtx.state.scrollingTo).toEqual({
            animated: false,
            index: 5,
            isInitialScroll: true,
            logicalTargetOffset: 900,
            offset: 900,
            precomputedWithViewOffset: true,
            targetOffset: 700,
        });
    });
});
