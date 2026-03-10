import {
    applySharedOriginDelta,
    canUseSharedContainerOrigin,
    ensureSharedContainerAbsolutePositions,
    getSharedOriginFlushReason,
    resetSharedContainerOrigin,
    setupSharedOriginPass,
    shouldUseDeferredSharedOriginVisualAdjust,
} from "@/core/sharedOrigin";
import { INTERNAL_PERF_CONFIG } from "@/core/internalPerfConfig";
import { Platform } from "@/platform/Platform";
import * as requestAdjustModule from "@/utils/requestAdjust";
import { afterEach, describe, expect, it, spyOn } from "bun:test";
import { createMockContext } from "../__mocks__/createMockContext";
import { createMockState } from "../__mocks__/createMockState";

describe("sharedOrigin", () => {
    const originalPlatform = Platform.OS;
    const defaultInternalPerfConfig = { ...INTERNAL_PERF_CONFIG };

    afterEach(() => {
        Platform.OS = originalPlatform;
        Object.assign(INTERNAL_PERF_CONFIG, defaultInternalPerfConfig);
    });

    it("enables shared container origin after initial scroll when the global toggle is on", () => {
        const state = createMockState({
            didFinishInitialScroll: true,
            initialScroll: undefined,
            sharedContainerNeedsStablePass: false,
            scrollingTo: undefined,
        });

        expect(canUseSharedContainerOrigin(state, 1)).toBe(true);
        expect(shouldUseDeferredSharedOriginVisualAdjust(state, 1)).toBe(true);
    });

    it("disables shared container origin while initial scroll is active", () => {
        Platform.OS = "web";
        const state = createMockState({
            didFinishInitialScroll: false,
            initialScroll: {
                contentOffset: 100,
            },
        });

        expect(canUseSharedContainerOrigin(state, 1)).toBe(false);
        expect(shouldUseDeferredSharedOriginVisualAdjust(state, 1)).toBe(false);
    });

    it("disables shared container origin while an imperative scroll is active", () => {
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

        expect(canUseSharedContainerOrigin(state, 1)).toBe(false);
        expect(shouldUseDeferredSharedOriginVisualAdjust(state, 1)).toBe(false);
    });

    it("keeps deferred visual adjust off until the post-initial settle pass is stable", () => {
        Platform.OS = "web";
        const state = createMockState({
            didFinishInitialScroll: true,
            initialScroll: undefined,
            postInitialSettleTarget: {
                index: 3,
                isInitialScroll: true,
                offset: 120,
            } as any,
            scrollingTo: undefined,
            sharedContainerNeedsStablePass: true,
        });

        expect(canUseSharedContainerOrigin(state, 1)).toBe(true);
        expect(shouldUseDeferredSharedOriginVisualAdjust(state, 1)).toBe(false);

        state.sharedContainerNeedsStablePass = false;

        expect(shouldUseDeferredSharedOriginVisualAdjust(state, 1)).toBe(false);

        state.postInitialSettleTarget = undefined;

        expect(shouldUseDeferredSharedOriginVisualAdjust(state, 1)).toBe(true);
    });

    it("uses the global deferred visual adjust toggle when shared origin is enabled", () => {
        const state = createMockState({
            didFinishInitialScroll: true,
            initialScroll: undefined,
            sharedContainerNeedsStablePass: false,
            scrollingTo: undefined,
        });

        Object.assign(INTERNAL_PERF_CONFIG, {
            deferSharedOriginVisualAdjust: true,
            sharedOriginEnabled: true,
        });

        expect(shouldUseDeferredSharedOriginVisualAdjust(state, 1)).toBe(true);

        INTERNAL_PERF_CONFIG.deferSharedOriginVisualAdjust = false;

        expect(shouldUseDeferredSharedOriginVisualAdjust(state, 1)).toBe(false);
    });

    it("disables shared container origin when the layout shape is unsupported", () => {
        Platform.OS = "web";
        const state = createMockState({
            props: {
                stickyIndicesArr: [0],
            },
        });

        expect(canUseSharedContainerOrigin(state, 1)).toBe(false);
        expect(canUseSharedContainerOrigin(state, 2)).toBe(false);
    });

    it("disables shared container origin for horizontal layouts", () => {
        const state = createMockState({
            didFinishInitialScroll: true,
            initialScroll: undefined,
            props: {
                horizontal: true,
            },
            scrollingTo: undefined,
        });

        expect(canUseSharedContainerOrigin(state, 1)).toBe(false);
        expect(shouldUseDeferredSharedOriginVisualAdjust(state, 1)).toBe(false);
    });

    it("uses the centralized flush policy for deferred visual adjust", () => {
        Platform.OS = "web";
        const state = createMockState({
            scrollPrev: 100,
        });

        expect(
            getSharedOriginFlushReason({
                pendingSharedOriginOffset: 500,
                scrollLength: 300,
                scrollState: 80,
                state,
            }),
        ).toBe("top-cap");

        state.sharedContainerFlushPending = true;

        expect(
            getSharedOriginFlushReason({
                pendingSharedOriginOffset: 20,
                scrollLength: 300,
                scrollState: 80,
                state,
            }),
        ).toBe("momentum-end");
    });

    it("flushes on direction changes before pending reaches the hard cap", () => {
        const state = createMockState({
            scrollPrev: 100,
            sharedContainerLastScrollDirection: 1,
        });

        expect(
            getSharedOriginFlushReason({
                pendingSharedOriginOffset: 40,
                scrollLength: 300,
                scrollState: 80,
                state,
            }),
        ).toBe("direction-change");
    });

    it("flushes on data changes before evaluating pending thresholds", () => {
        const state = createMockState({
            scrollPrev: 100,
            sharedContainerLastScrollDirection: 1,
        });

        expect(
            getSharedOriginFlushReason({
                dataChanged: true,
                pendingSharedOriginOffset: 20,
                scrollLength: 300,
                scrollState: 80,
                state,
            }),
        ).toBe("data-change");
    });

    it("flushes when pending shared-origin offset exceeds the hard cap", () => {
        const state = createMockState({
            scrollPrev: 10,
        });

        expect(
            getSharedOriginFlushReason({
                pendingSharedOriginOffset: 900,
                scrollLength: 300,
                scrollState: 600,
                state,
            }),
        ).toBe("hard-cap");
    });

    it("disables shared container origin when the global toggle is off", () => {
        INTERNAL_PERF_CONFIG.sharedOriginEnabled = false;
        const state = createMockState({
            didFinishInitialScroll: true,
            initialScroll: undefined,
            scrollingTo: undefined,
        });

        expect(canUseSharedContainerOrigin(state, 1)).toBe(false);
        expect(shouldUseDeferredSharedOriginVisualAdjust(state, 1)).toBe(false);
    });

    it("creates and reuses the shared absolute position map", () => {
        const state = createMockState();

        const first = ensureSharedContainerAbsolutePositions(state);
        first.set(1, 200);
        const second = ensureSharedContainerAbsolutePositions(state);

        expect(first).toBe(second);
        expect(second.get(1)).toBe(200);
    });

    it("resets the shared-origin wrapper state and absolute positions", () => {
        const ctx = createMockContext({
            containerOriginOffset: 180,
        });
        ctx.state.sharedContainerFlushPending = true;
        ctx.state.sharedContainerLastScrollDirection = -1;
        ctx.state.sharedContainerLogicalOriginOffset = 240;
        ctx.state.sharedContainerAbsolutePositions.set(0, 50);

        resetSharedContainerOrigin(ctx, ctx.state);

        expect(ctx.values.get("containerOriginOffset")).toBe(0);
        expect(ctx.state.sharedContainerFlushPending).toBe(false);
        expect(ctx.state.sharedContainerLastScrollDirection).toBe(0);
        expect(ctx.state.sharedContainerLogicalOriginOffset).toBe(0);
        expect(ctx.state.sharedContainerAbsolutePositions.size).toBe(0);
    });

    it("setupSharedOriginPass resets stale shared-origin state when the layout becomes unsupported", () => {
        Platform.OS = "web";
        const ctx = createMockContext(
            {
                containerOriginOffset: 160,
            },
            {
                didFinishInitialScroll: true,
                initialScroll: undefined,
                props: {
                    stickyIndicesArr: [0],
                },
                scrollingTo: undefined,
            },
        );
        ctx.state.sharedContainerFlushPending = true;
        ctx.state.sharedContainerLastScrollDirection = 1;
        ctx.state.sharedContainerLogicalOriginOffset = 220;
        ctx.state.sharedContainerAbsolutePositions.set(0, 80);

        const result = setupSharedOriginPass({
            ctx,
            numColumns: 1,
            scrollLength: 300,
            scrollState: 100,
        });

        expect(result.canUseSharedOrigin).toBe(false);
        expect(result.shouldDeferSharedOriginVisualAdjust).toBe(false);
        expect(result.shouldSuppressVisualAdjustForPass).toBe(false);
        expect(result.appliedSharedOriginOffsetBefore).toBe(0);
        expect(result.logicalSharedOriginOffsetBefore).toBe(0);
        expect(result.pendingSharedOriginOffsetBefore).toBe(0);
        expect(ctx.values.get("containerOriginOffset")).toBe(0);
        expect(ctx.state.sharedContainerAbsolutePositions.size).toBe(0);
    });

    it("setupSharedOriginPass keeps deferred pending offset in logical space until a flush is needed", () => {
        Platform.OS = "android";
        const ctx = createMockContext(
            {
                containerOriginOffset: 100,
            },
            {
                didFinishInitialScroll: true,
                initialScroll: undefined,
                sharedContainerNeedsStablePass: false,
                scrollingTo: undefined,
            },
        );
        ctx.state.sharedContainerLogicalOriginOffset = 220;
        ctx.state.scrollPrev = 1000;

        const result = setupSharedOriginPass({
            ctx,
            numColumns: 1,
            scrollLength: 300,
            scrollState: 1000,
        });

        expect(result.canUseSharedOrigin).toBe(true);
        expect(result.shouldDeferSharedOriginVisualAdjust).toBe(true);
        expect(result.shouldSuppressVisualAdjustForPass).toBe(true);
        expect(result.sharedOriginFlushReason).toBeUndefined();
        expect(result.appliedSharedOriginOffsetBefore).toBe(100);
        expect(result.logicalSharedOriginOffsetBefore).toBe(220);
        expect(result.pendingSharedOriginOffsetBefore).toBe(120);
        expect(ctx.values.get("containerOriginOffset")).toBe(100);
    });

    it("setupSharedOriginPass rebases pending offset and requests scroll compensation when needed", () => {
        Platform.OS = "android";
        const ctx = createMockContext(
            {
                containerOriginOffset: 90,
            },
            {
                didFinishInitialScroll: true,
                initialScroll: undefined,
                sharedContainerNeedsStablePass: false,
                scrollingTo: undefined,
            },
        );
        ctx.state.sharedContainerLogicalOriginOffset = 250;
        ctx.state.sharedContainerFlushPending = true;

        const requestAdjustSpy = spyOn(requestAdjustModule, "requestAdjust").mockImplementation(() => {});
        try {
            const result = setupSharedOriginPass({
                ctx,
                numColumns: 1,
                scrollLength: 300,
                scrollState: 200,
            });

            expect(result.sharedOriginFlushReason).toBe("momentum-end");
            expect(result.canUseSharedOrigin).toBe(false);
            expect(result.shouldSuppressVisualAdjustForPass).toBe(false);
            expect(result.appliedSharedOriginOffsetBefore).toBe(0);
            expect(result.pendingSharedOriginOffsetBefore).toBe(0);
            expect(ctx.values.get("containerOriginOffset")).toBe(0);
            expect(ctx.state.sharedContainerFlushPending).toBe(false);
            expect(ctx.state.sharedContainerLogicalOriginOffset).toBe(0);
            expect(requestAdjustSpy).toHaveBeenCalledWith(ctx, 160);
        } finally {
            requestAdjustSpy.mockRestore();
        }
    });

    it("setupSharedOriginPass rebases committed shared origin back into local positions on settle", () => {
        Platform.OS = "android";
        const ctx = createMockContext(
            {
                containerOriginOffset: 250,
            },
            {
                didFinishInitialScroll: true,
                initialScroll: undefined,
                sharedContainerNeedsStablePass: false,
                scrollingTo: undefined,
            },
        );
        ctx.state.sharedContainerLogicalOriginOffset = 250;
        ctx.state.sharedContainerRebasePending = true;
        ctx.state.sharedContainerAbsolutePositions.set(0, 80);

        const requestAdjustSpy = spyOn(requestAdjustModule, "requestAdjust").mockImplementation(() => {});
        try {
            const result = setupSharedOriginPass({
                ctx,
                numColumns: 1,
                scrollLength: 300,
                scrollState: 200,
            });

            expect(result.sharedOriginFlushReason).toBe("settle-rebase");
            expect(result.canUseSharedOrigin).toBe(false);
            expect(result.appliedSharedOriginOffsetBefore).toBe(0);
            expect(result.logicalSharedOriginOffsetBefore).toBe(0);
            expect(result.pendingSharedOriginOffsetBefore).toBe(0);
            expect(ctx.values.get("containerOriginOffset")).toBe(0);
            expect(ctx.state.sharedContainerLogicalOriginOffset).toBe(0);
            expect(ctx.state.sharedContainerRebasePending).toBe(false);
            expect(ctx.state.sharedContainerAbsolutePositions.size).toBe(0);
            expect(requestAdjustSpy).not.toHaveBeenCalled();
        } finally {
            requestAdjustSpy.mockRestore();
        }
    });

    it("setupSharedOriginPass rebases pending shared origin on data-change passes", () => {
        Platform.OS = "android";
        const ctx = createMockContext(
            {
                containerOriginOffset: 75,
            },
            {
                didFinishInitialScroll: true,
                initialScroll: undefined,
                scrollingTo: undefined,
            },
        );
        ctx.state.sharedContainerLogicalOriginOffset = 150;

        const result = setupSharedOriginPass({
            ctx,
            dataChanged: true,
            numColumns: 1,
            scrollLength: 300,
            scrollState: 200,
        });

        expect(result.canUseSharedOrigin).toBe(false);
        expect(result.shouldDeferSharedOriginVisualAdjust).toBe(false);
        expect(result.shouldSuppressVisualAdjustForPass).toBe(false);
        expect(result.sharedOriginFlushReason).toBe("data-change");
        expect(result.appliedSharedOriginOffsetBefore).toBe(0);
        expect(result.logicalSharedOriginOffsetBefore).toBe(0);
        expect(result.pendingSharedOriginOffsetBefore).toBe(0);
        expect(ctx.values.get("containerOriginOffset")).toBe(0);
        expect(ctx.state.sharedContainerLogicalOriginOffset).toBe(0);
    });

    it("applySharedOriginDelta keeps unsupported passes in the plain coordinate system", () => {
        const ctx = createMockContext({
            containerOriginOffset: 55,
        });

        const result = applySharedOriginDelta({
            appliedSharedOriginOffsetBefore: 55,
            canUseSharedOrigin: false,
            ctx,
            sharedOriginBefore: 80,
            sharedOriginCandidateDeltas: [20, 20],
            shouldSuppressVisualAdjustForPass: false,
        });

        expect(result).toEqual({
            appliedSharedOriginOffset: 0,
            pendingSharedOriginOffset: 0,
            sharedOriginDeltaApplied: 0,
            sharedOriginMatchCount: 0,
            sharedOriginOffset: 0,
        });
        expect(ctx.values.get("containerOriginOffset")).toBe(55);
    });

    it("applySharedOriginDelta keeps the dominant delta in logical shared-origin state", () => {
        const ctx = createMockContext({
            containerOriginOffset: 0,
        });
        ctx.state.sharedContainerLogicalOriginOffset = 0;

        const result = applySharedOriginDelta({
            appliedSharedOriginOffsetBefore: 0,
            canUseSharedOrigin: true,
            ctx,
            sharedOriginBefore: 0,
            sharedOriginCandidateDeltas: [40, 40, 15],
            shouldSuppressVisualAdjustForPass: false,
        });

        expect(result).toEqual({
            appliedSharedOriginOffset: 0,
            pendingSharedOriginOffset: 40,
            sharedOriginDeltaApplied: 40,
            sharedOriginMatchCount: 2,
            sharedOriginOffset: 40,
        });
        expect(ctx.state.sharedContainerLogicalOriginOffset).toBe(40);
        expect(ctx.values.get("containerOriginOffset")).toBe(0);
    });

    it("applySharedOriginDelta keeps wrapper movement deferred when suppression is active", () => {
        const ctx = createMockContext({
            containerOriginOffset: 0,
        });
        ctx.state.sharedContainerLogicalOriginOffset = 0;

        const result = applySharedOriginDelta({
            appliedSharedOriginOffsetBefore: 0,
            canUseSharedOrigin: true,
            ctx,
            sharedOriginBefore: 0,
            sharedOriginCandidateDeltas: [30, 30, 5],
            shouldSuppressVisualAdjustForPass: true,
        });

        expect(result).toEqual({
            appliedSharedOriginOffset: 0,
            pendingSharedOriginOffset: 30,
            sharedOriginDeltaApplied: 30,
            sharedOriginMatchCount: 2,
            sharedOriginOffset: 30,
        });
        expect(ctx.state.sharedContainerLogicalOriginOffset).toBe(30);
        expect(ctx.values.get("containerOriginOffset")).toBe(0);
    });
});
