import {
    applyDeferredPositionDelta,
    canUseDeferredPositionDelta,
    flushDeferredPositionRebaseBeforeScroll,
    resetDeferredPositionDelta,
    setupDeferredPositionPass,
    shouldFlushDeferredPositionForCap,
    shouldDeferPositionDeltaVisualAdjust,
} from "@/core/deferredPositionDelta";
import { Platform } from "@/platform/Platform";
import * as requestAdjustModule from "@/utils/requestAdjust";
import { describe, expect, it, spyOn } from "bun:test";
import { createMockContext } from "../__mocks__/createMockContext";
import { createMockState } from "../__mocks__/createMockState";

describe("deferredPositionDelta", () => {
    const _originalPlatform = Platform.OS;

    it("enables deferred position delta after initial scroll when the layout is supported", () => {
        const state = createMockState({
            deferredPositionNeedsStablePass: false,
            didFinishInitialScroll: true,
            initialScroll: undefined,
            scrollingTo: undefined,
        });

        expect(canUseDeferredPositionDelta(state, 1)).toBe(true);
        expect(shouldDeferPositionDeltaVisualAdjust(state, 1)).toBe(true);
    });

    it("disables deferred position delta while initial scroll is active", () => {
        Platform.OS = "web";
        const state = createMockState({
            didFinishInitialScroll: false,
            initialScroll: {
                contentOffset: 100,
            },
        });

        expect(canUseDeferredPositionDelta(state, 1)).toBe(false);
        expect(shouldDeferPositionDeltaVisualAdjust(state, 1)).toBe(false);
    });

    it("disables deferred position delta while an imperative scroll is active", () => {
        Platform.OS = "web";
        const state = createMockState({
            didFinishInitialScroll: true,
            initialScroll: undefined,
            scrollingTo: {
                animated: true,
                index: 10,
                isInitialScroll: false,
                offset: 1000,
            },
        });

        expect(canUseDeferredPositionDelta(state, 1)).toBe(false);
        expect(shouldDeferPositionDeltaVisualAdjust(state, 1)).toBe(false);
    });

    it("keeps deferred visual adjust off until the post-initial settle pass is stable", () => {
        Platform.OS = "web";
        const state = createMockState({
            deferredPositionNeedsStablePass: true,
            didFinishInitialScroll: true,
            initialScroll: undefined,
            postInitialSettleTarget: {
                index: 3,
                isInitialScroll: true,
                offset: 120,
            } as any,
            scrollingTo: undefined,
        });

        expect(canUseDeferredPositionDelta(state, 1)).toBe(true);
        expect(shouldDeferPositionDeltaVisualAdjust(state, 1)).toBe(false);

        state.deferredPositionNeedsStablePass = false;

        expect(shouldDeferPositionDeltaVisualAdjust(state, 1)).toBe(false);

        state.postInitialSettleTarget = undefined;

        expect(shouldDeferPositionDeltaVisualAdjust(state, 1)).toBe(true);
    });

    it("disables deferred position delta when the layout shape is unsupported", () => {
        Platform.OS = "web";
        const state = createMockState({
            props: {
                stickyIndicesArr: [0],
            },
        });

        expect(canUseDeferredPositionDelta(state, 1)).toBe(false);
        expect(canUseDeferredPositionDelta(state, 2)).toBe(false);
    });

    it("disables deferred position delta for horizontal layouts", () => {
        const state = createMockState({
            didFinishInitialScroll: true,
            initialScroll: undefined,
            props: {
                horizontal: true,
            },
            scrollingTo: undefined,
        });

        expect(canUseDeferredPositionDelta(state, 1)).toBe(false);
        expect(shouldDeferPositionDeltaVisualAdjust(state, 1)).toBe(false);
    });

    it("uses the centralized cap policy for deferred visual adjust", () => {
        expect(
            shouldFlushDeferredPositionForCap({
                pendingDeferredPositionDelta: 500,
                scrollLength: 300,
                scrollState: 80,
            }),
        ).toBe(true);
    });

    it("flushes when the pending deferred position delta exceeds the hard cap", () => {
        expect(
            shouldFlushDeferredPositionForCap({
                pendingDeferredPositionDelta: 900,
                scrollLength: 300,
                scrollState: 600,
            }),
        ).toBe(true);
    });

    it("keeps the deferred baseline map on state", () => {
        const state = createMockState();
        state.deferredPositionBaseline.set(1, 200);
        expect(state.deferredPositionBaseline.get(1)).toBe(200);
    });

    it("resets the deferred position delta state and baseline", () => {
        const ctx = createMockContext();
        ctx.state.deferredPositionDelta = 240;
        ctx.state.deferredPositionBaseline.set(0, 50);

        resetDeferredPositionDelta(ctx.state);

        expect(ctx.state.deferredPositionDelta).toBe(0);
        expect(ctx.state.deferredPositionBaseline.size).toBe(0);
    });

    it("flushes pending deferred position rebases before an imperative scroll starts", () => {
        const ctx = createMockContext(
            { readyToRender: true },
            {
                deferredPositionNeedsStablePass: false,
                pendingDeferredGeometryFlush: true,
                props: {
                    data: [1, 2, 3],
                },
            },
        );
        ctx.state.deferredPositionDelta = 240;
        ctx.state.deferredPositionBaseline.set(0, 50);
        const requestAdjustSpy = spyOn(requestAdjustModule, "requestAdjust").mockImplementation(() => {});
        const triggerCalculateItemsInView = spyOn(ctx.state, "triggerCalculateItemsInView");

        try {
            const result = flushDeferredPositionRebaseBeforeScroll(ctx);

            expect(result).toBe(true);
            expect(ctx.state.deferredPositionDelta).toBe(0);
            expect(ctx.state.deferredPositionBaseline.size).toBe(0);
            expect(ctx.state.pendingDeferredGeometryFlush).toBe(false);
            expect(requestAdjustSpy).toHaveBeenCalledWith(ctx, 240);
            expect(triggerCalculateItemsInView).toHaveBeenCalledWith({ forceFullItemPositions: true });
        } finally {
            requestAdjustSpy.mockRestore();
            triggerCalculateItemsInView.mockRestore();
        }
    });

    it("setupDeferredPositionPass resets stale deferred state when the layout becomes unsupported", () => {
        Platform.OS = "web";
        const ctx = createMockContext(
            {},
            {
                didFinishInitialScroll: true,
                initialScroll: undefined,
                props: {
                    stickyIndicesArr: [0],
                },
                scrollingTo: undefined,
            },
        );
        ctx.state.deferredPositionDelta = 220;
        ctx.state.deferredPositionBaseline.set(0, 80);

        const result = setupDeferredPositionPass({
            ctx,
            numColumns: 1,
            scrollLength: 300,
            scrollState: 100,
        });

        expect(result.canUseDeferredPositionDelta).toBe(false);
        expect(result.shouldDeferPositionDeltaVisualAdjust).toBe(false);
        expect(result.deferredPositionDeltaBefore).toBe(0);
        expect(ctx.state.deferredPositionBaseline.size).toBe(0);
    });

    it("setupDeferredPositionPass keeps the deferred delta in logical space until a flush is needed", () => {
        Platform.OS = "android";
        const ctx = createMockContext(
            {},
            {
                deferredPositionNeedsStablePass: false,
                didFinishInitialScroll: true,
                initialScroll: undefined,
                scrollingTo: undefined,
            },
        );
        ctx.state.deferredPositionDelta = 220;
        ctx.state.scrollPrev = 1000;

        const result = setupDeferredPositionPass({
            ctx,
            numColumns: 1,
            scrollLength: 300,
            scrollState: 1000,
        });

        expect(result.canUseDeferredPositionDelta).toBe(true);
        expect(result.shouldDeferPositionDeltaVisualAdjust).toBe(true);
        expect(result.didFlushDeferredPosition).toBe(false);
        expect(result.deferredPositionDeltaBefore).toBe(220);
    });

    it("setupDeferredPositionPass rebases cap-bounded pending delta and requests scroll compensation when needed", () => {
        Platform.OS = "android";
        const ctx = createMockContext(
            {},
            {
                deferredPositionNeedsStablePass: false,
                didFinishInitialScroll: true,
                initialScroll: undefined,
                scrollingTo: undefined,
            },
        );
        ctx.state.deferredPositionDelta = 250;

        const requestAdjustSpy = spyOn(requestAdjustModule, "requestAdjust").mockImplementation(() => {});
        try {
            const result = setupDeferredPositionPass({
                ctx,
                numColumns: 1,
                scrollLength: 300,
                scrollState: 200,
            });

            expect(result.didFlushDeferredPosition).toBe(true);
            expect(result.canUseDeferredPositionDelta).toBe(false);
            expect(ctx.state.deferredPositionDelta).toBe(0);
            expect(requestAdjustSpy).toHaveBeenCalledWith(ctx, 250);
        } finally {
            requestAdjustSpy.mockRestore();
        }
    });

    it("setupDeferredPositionPass rebases the deferred delta back into local positions on settle", () => {
        Platform.OS = "android";
        const ctx = createMockContext(
            {},
            {
                deferredPositionNeedsStablePass: false,
                didFinishInitialScroll: true,
                initialScroll: undefined,
                scrollingTo: undefined,
            },
        );
        ctx.state.deferredPositionDelta = 250;
        ctx.state.pendingDeferredGeometryFlush = true;
        ctx.state.deferredPositionBaseline.set(0, 80);

        const requestAdjustSpy = spyOn(requestAdjustModule, "requestAdjust").mockImplementation(() => {});
        try {
            const result = setupDeferredPositionPass({
                ctx,
                numColumns: 1,
                queuedBoundary: true,
                scrollLength: 300,
                scrollState: 200,
            });

            expect(result.didFlushDeferredPosition).toBe(true);
            expect(result.canUseDeferredPositionDelta).toBe(false);
            expect(result.deferredPositionDeltaBefore).toBe(0);
            expect(ctx.state.deferredPositionDelta).toBe(0);
            expect(ctx.state.deferredPositionBaseline.size).toBe(0);
            expect(requestAdjustSpy).toHaveBeenCalledWith(ctx, 250);
        } finally {
            requestAdjustSpy.mockRestore();
        }
    });

    it("setupDeferredPositionPass rebases the pending delta on data-change passes", () => {
        Platform.OS = "android";
        const ctx = createMockContext({}, {
            didFinishInitialScroll: true,
            initialScroll: undefined,
            scrollingTo: undefined,
        } as any);
        ctx.state.deferredPositionDelta = 150;
        const requestAdjustSpy = spyOn(requestAdjustModule, "requestAdjust").mockImplementation(() => {});

        try {
            const result = setupDeferredPositionPass({
                ctx,
                dataChanged: true,
                numColumns: 1,
                scrollLength: 300,
                scrollState: 200,
            });

            expect(result.canUseDeferredPositionDelta).toBe(false);
            expect(result.shouldDeferPositionDeltaVisualAdjust).toBe(false);
            expect(result.didFlushDeferredPosition).toBe(true);
            expect(result.deferredPositionDeltaBefore).toBe(0);
            expect(ctx.state.deferredPositionDelta).toBe(0);
            expect(requestAdjustSpy).toHaveBeenCalledWith(ctx, 150);
        } finally {
            requestAdjustSpy.mockRestore();
        }
    });

    it("applyDeferredPositionDelta keeps unsupported passes in the plain coordinate system", () => {
        const result = applyDeferredPositionDelta({
            canUseDeferredPositionDelta: false,
            deferredPositionDeltaBefore: 80,
            deferredPositionDeltaCandidates: [20, 20],
        });

        expect(result).toEqual({
            deferredPositionDelta: 0,
            deltaApplied: 0,
            matchCount: 0,
        });
    });

    it("applyDeferredPositionDelta keeps the dominant delta in logical deferred state", () => {
        const result = applyDeferredPositionDelta({
            canUseDeferredPositionDelta: true,
            deferredPositionDeltaBefore: 0,
            deferredPositionDeltaCandidates: [40, 40, 15],
        });

        expect(result).toEqual({
            deferredPositionDelta: 40,
            deltaApplied: 40,
            matchCount: 2,
        });
    });

    it("applyDeferredPositionDelta defers a lone mounted-row delta", () => {
        const result = applyDeferredPositionDelta({
            canUseDeferredPositionDelta: true,
            deferredPositionDeltaBefore: 0,
            deferredPositionDeltaCandidates: [40],
        });

        expect(result).toEqual({
            deferredPositionDelta: 40,
            deltaApplied: 40,
            matchCount: 1,
        });
    });
});
