import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import "../setup";

import * as doScrollToModule from "@/core/doScrollTo";
import { scrollTo } from "@/core/scrollTo";
import { Platform } from "@/platform/Platform";
import type { StateContext } from "@/state/state";
import { createMockContext } from "../__mocks__/createMockContext";

describe("scrollTo", () => {
    let mockCtx: StateContext;
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
        doScrollToSpy = spyOn(doScrollToModule, "doScrollTo").mockImplementation(() => undefined);
    });

    afterEach(() => {
        Platform.OS = originalPlatform;
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

    it("keeps initial iOS scrolls local while arming the native watchdog", () => {
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
            offset: 120,
            targetOffset: 120,
        });
        expect(mockCtx.state.initialNativeScrollWatchdog).toEqual({
            startScroll: 25,
            targetOffset: 120,
        });
        expect(mockCtx.state.hasScrolled).toBe(false);
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
            offset: 140,
            targetOffset: 140,
        });
    });

    it("preserves the original watchdog start scroll across forced retries", () => {
        mockCtx.state.initialNativeScrollWatchdog = {
            startScroll: 25,
            targetOffset: 100,
        };
        mockCtx.state.scroll = 80;

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
        expect(mockCtx.state.initialNativeScrollWatchdog).toEqual({
            startScroll: 25,
            targetOffset: 140,
        });
        expect(mockCtx.state.hasScrolled).toBe(false);
    });

    it("clears a stale watchdog target when an initial retry recomputes to zero", () => {
        mockCtx.state.initialNativeScrollWatchdog = {
            startScroll: 25,
            targetOffset: 36,
        };

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
        expect(mockCtx.state.initialNativeScrollWatchdog).toBeUndefined();
        expect(mockCtx.state.scrollingTo).toEqual({
            animated: false,
            isInitialScroll: true,
            offset: 0,
            targetOffset: 0,
        });
    });
});
