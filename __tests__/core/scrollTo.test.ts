import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import "../setup";

import * as doScrollToModule from "@/core/doScrollTo";
import { scrollTo } from "@/core/scrollTo";
import * as updateScrollModule from "@/core/updateScroll";
import { Platform } from "@/platform/Platform";
import type { StateContext } from "@/state/state";
import { createMockContext } from "../__mocks__/createMockContext";

describe("scrollTo", () => {
    let mockCtx: StateContext;
    let doScrollToSpy: ReturnType<typeof spyOn>;
    let updateScrollSpy: ReturnType<typeof spyOn>;
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
        updateScrollSpy = spyOn(updateScrollModule, "updateScroll").mockImplementation(() => undefined);
    });

    afterEach(() => {
        Platform.OS = originalPlatform;
        doScrollToSpy.mockRestore();
        updateScrollSpy.mockRestore();
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
        expect(mockCtx.state.initialScrollSession?.completion?.watchdog).toEqual({
            startScroll: 25,
            targetOffset: 120,
        });
        expect(mockCtx.state.hasScrolled).toBe(false);
        expect(updateScrollSpy).not.toHaveBeenCalled();
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

    it("captures a frozen average size snapshot when starting a scroll", () => {
        mockCtx.state.averageSizes = {
            "": { avg: 80, num: 4 },
            large: { avg: 120, num: 2 },
        };

        scrollTo(mockCtx, {
            animated: true,
            index: 5,
            itemSize: 80,
            offset: 200,
        });

        expect(mockCtx.state.scrollingTo).toMatchObject({
            animated: true,
            averageSizeSnapshot: { "": 80, large: 120 },
            index: 5,
            itemSize: 80,
            offset: 200,
            targetOffset: 200,
        });
    });

    it("precomputes the target range for non-animated imperative scrolls", () => {
        mockCtx.state.props.data = Array.from({ length: 10 }, (_, index) => ({ id: index }));
        mockCtx.state.props.estimatedItemSize = 80;
        mockCtx.state.scrollLength = 300;
        for (let index = 0; index < 10; index++) {
            mockCtx.state.positions[index] = index * 80;
        }

        scrollTo(mockCtx, {
            animated: false,
            index: 5,
            itemSize: 80,
            offset: 200,
        });

        expect(mockCtx.state.scrollTargetPinnedRange).toEqual({
            end: 6,
            start: 2,
        });
        expect(updateScrollSpy).toHaveBeenCalledWith(mockCtx, 200, true, {
            markHasScrolled: false,
        });
        expect(doScrollToSpy).toHaveBeenCalledWith(mockCtx, {
            animated: false,
            horizontal: false,
            isInitialScroll: undefined,
            offset: 200,
        });
    });

    it("pins and prewarms the target range for animated scrolls without moving state scroll", () => {
        const triggerCalculateItemsInView = mock(() => undefined);
        mockCtx.state.props.data = Array.from({ length: 20 }, (_, index) => ({ id: index }));
        mockCtx.state.props.estimatedItemSize = 50;
        mockCtx.state.scrollLength = 100;
        mockCtx.state.triggerCalculateItemsInView = triggerCalculateItemsInView;
        for (let index = 0; index < 20; index++) {
            mockCtx.state.positions[index] = index * 50;
        }

        scrollTo(mockCtx, {
            animated: true,
            index: 6,
            itemSize: 50,
            offset: 300,
        });

        expect(mockCtx.state.scrollTargetPinnedRange).toEqual({
            end: 8,
            start: 6,
        });
        expect(updateScrollSpy).not.toHaveBeenCalled();
        expect(triggerCalculateItemsInView).toHaveBeenCalledWith();
        expect(mockCtx.state.scroll).toBe(25);
    });

    it("does not expand scroll target pins through uncomputed tail positions", () => {
        const triggerCalculateItemsInView = mock(() => undefined);
        mockCtx.state.props.data = Array.from({ length: 10_000 }, (_, index) => ({ id: index }));
        mockCtx.state.props.estimatedItemSize = 50;
        mockCtx.state.scrollLength = 100;
        mockCtx.state.triggerCalculateItemsInView = triggerCalculateItemsInView;
        mockCtx.state.positions[900] = 45_000;

        scrollTo(mockCtx, {
            animated: true,
            index: 900,
            itemSize: 50,
            offset: 45_000,
        });

        expect(mockCtx.state.scrollTargetPinnedRange).toEqual({
            end: 900,
            start: 900,
        });
        expect(triggerCalculateItemsInView).toHaveBeenCalledWith();
    });

    it("pins only the target index when its position is not computed yet", () => {
        const triggerCalculateItemsInView = mock(() => undefined);
        mockCtx.state.props.data = Array.from({ length: 10_000 }, (_, index) => ({ id: index }));
        mockCtx.state.props.estimatedItemSize = 50;
        mockCtx.state.scrollLength = 100;
        mockCtx.state.triggerCalculateItemsInView = triggerCalculateItemsInView;

        scrollTo(mockCtx, {
            animated: true,
            index: 900,
            itemSize: 50,
            offset: 45_000,
        });

        expect(mockCtx.state.scrollTargetPinnedRange).toEqual({
            end: 900,
            start: 900,
        });
        expect(triggerCalculateItemsInView).toHaveBeenCalledWith();
    });

    it("pins the whole target viewport for bottom-aligned index scrolls", () => {
        const triggerCalculateItemsInView = mock(() => undefined);
        mockCtx.state.props.data = Array.from({ length: 20 }, (_, index) => ({ id: index }));
        mockCtx.state.props.estimatedItemSize = 50;
        mockCtx.state.scrollLength = 100;
        mockCtx.state.triggerCalculateItemsInView = triggerCalculateItemsInView;
        for (let index = 0; index < 20; index++) {
            mockCtx.state.positions[index] = index * 50;
        }

        scrollTo(mockCtx, {
            animated: true,
            index: 9,
            itemSize: 50,
            offset: 450,
            viewPosition: 1,
        });

        expect(mockCtx.state.scrollTargetPinnedRange).toEqual({
            end: 10,
            start: 8,
        });
        expect(updateScrollSpy).not.toHaveBeenCalled();
        expect(triggerCalculateItemsInView).toHaveBeenCalledWith();
    });

    it("pins offset-only animated scroll targets from the position table", () => {
        const triggerCalculateItemsInView = mock(() => undefined);
        mockCtx.state.props.data = Array.from({ length: 20 }, (_, index) => ({ id: index }));
        mockCtx.state.props.estimatedItemSize = 50;
        mockCtx.state.scrollForNextCalculateItemsInView = { bottom: 250, top: 50 };
        mockCtx.state.scrollLength = 100;
        mockCtx.state.triggerCalculateItemsInView = triggerCalculateItemsInView;
        for (let index = 0; index < 20; index++) {
            mockCtx.state.positions[index] = index * 50;
        }

        scrollTo(mockCtx, {
            animated: true,
            offset: 175,
        });

        expect(mockCtx.state.scrollTargetPinnedRange).toEqual({
            end: 5,
            start: 3,
        });
        expect(mockCtx.state.scrollForNextCalculateItemsInView).toBeUndefined();
        expect(updateScrollSpy).not.toHaveBeenCalled();
        expect(triggerCalculateItemsInView).toHaveBeenCalledWith();
    });

    it("skips offset-only target pinning when known positions do not cover the target offset", () => {
        const triggerCalculateItemsInView = mock(() => undefined);
        mockCtx.state.props.data = Array.from({ length: 10_000 }, (_, index) => ({ id: index }));
        mockCtx.state.props.estimatedItemSize = 50;
        mockCtx.state.scrollLength = 100;
        mockCtx.state.triggerCalculateItemsInView = triggerCalculateItemsInView;
        mockCtx.state.totalSize = 500_000;
        for (let index = 0; index < 100; index++) {
            mockCtx.state.positions[index] = index * 50;
        }

        scrollTo(mockCtx, {
            animated: true,
            offset: 45_000,
        });

        expect(mockCtx.state.scrollTargetPinnedRange).toBeUndefined();
        expect(triggerCalculateItemsInView).not.toHaveBeenCalled();
    });

    it("does not precompute the target range for synthetic noScrollingTo scrolls", () => {
        scrollTo(mockCtx, {
            animated: false,
            noScrollingTo: true,
            offset: 200,
        });

        expect(updateScrollSpy).not.toHaveBeenCalled();
    });

    it("preserves the original watchdog start scroll across forced retries", () => {
        mockCtx.state.initialScrollSession = {
            completion: {
                watchdog: {
                    startScroll: 25,
                    targetOffset: 100,
                },
            },
            kind: "bootstrap",
            previousDataLength: 0,
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
        expect(mockCtx.state.initialScrollSession?.completion?.watchdog).toEqual({
            startScroll: 25,
            targetOffset: 140,
        });
        expect(mockCtx.state.hasScrolled).toBe(false);
    });

    it("clears a stale watchdog target when an initial retry recomputes to zero", () => {
        mockCtx.state.initialScrollSession = {
            completion: {
                watchdog: {
                    startScroll: 25,
                    targetOffset: 36,
                },
            },
            kind: "bootstrap",
            previousDataLength: 0,
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
        expect(mockCtx.state.initialScrollSession?.completion?.watchdog).toBeUndefined();
        expect(mockCtx.state.scrollingTo).toEqual({
            animated: false,
            isInitialScroll: true,
            offset: 0,
            targetOffset: 0,
        });
    });
});
