import { afterEach, describe, expect, it, spyOn } from "bun:test";
import "../setup";

import { prepareMVCP, resolvePendingNativeMVCPAdjust } from "@/core/mvcp";
import { Platform } from "@/platform/Platform";
import type { StateContext } from "@/state/state";
import { normalizeMaintainVisibleContentPosition } from "@/utils/normalizeMaintainVisibleContentPosition";
import * as requestAdjustModule from "@/utils/requestAdjust";
import { createMockContext } from "../__mocks__/createMockContext";

const originalPlatform = Platform.OS;

describe("mvcp helpers", () => {
    afterEach(() => {
        Platform.OS = originalPlatform;
    });

    it("clears a web anchor lock immediately when its anchor disappears", () => {
        Platform.OS = "web";

        const mockCtx = createMockContext(
            { totalSize: 1000 },
            {
                didContainersLayout: true,
                idCache: ["item-0", "item-1", "item-2"],
                idsInView: ["item-2"],
                indexByKey: new Map([
                    ["item-0", 0],
                    ["item-2", 2],
                ]),
                mvcpAnchorLock: {
                    expiresAt: Date.now() + 500,
                    id: "item-1",
                    position: 100,
                    quietPasses: 0,
                },
                positions: [0, 100, 250],
                props: {
                    data: [{ id: 0 }, { id: 1 }, { id: 2 }],
                    keyExtractor: (item: { id: number }) => `item-${item.id}`,
                    maintainVisibleContentPosition: normalizeMaintainVisibleContentPosition(true),
                },
            },
        );

        const adjustFunction = prepareMVCP(mockCtx);

        expect(adjustFunction).toBeDefined();
        expect(mockCtx.state.mvcpAnchorLock).toBeUndefined();
    });

    it("does not refresh the web anchor lock while a scrollTo target is active", () => {
        Platform.OS = "web";

        const mockCtx = createMockContext(
            { totalSize: 1000 },
            {
                didContainersLayout: true,
                idCache: ["item-0", "item-1", "item-2"],
                idsInView: ["item-0", "item-1"],
                indexByKey: new Map([
                    ["item-0", 0],
                    ["item-1", 1],
                    ["item-2", 2],
                ]),
                positions: [0, 100, 250],
                props: {
                    data: [{ id: 0 }, { id: 1 }, { id: 2 }],
                    keyExtractor: (item: { id: number }) => `item-${item.id}`,
                    maintainVisibleContentPosition: normalizeMaintainVisibleContentPosition(true),
                },
                scrollingTo: {
                    animated: true,
                    index: 2,
                    itemSize: 100,
                    offset: 250,
                },
                sizes: new Map([["item-2", 150]]),
            },
        );

        const requestAdjustSpy = spyOn(requestAdjustModule, "requestAdjust");
        try {
            const adjustFunction = prepareMVCP(mockCtx, true);
            mockCtx.state.positions[2] = 300;

            adjustFunction?.();

            expect(requestAdjustSpy).toHaveBeenCalledWith(mockCtx, 50, true);
            expect(mockCtx.state.mvcpAnchorLock).toBeUndefined();
        } finally {
            requestAdjustSpy.mockRestore();
        }
    });

    // Builds a native list whose viewport overlaps the bottom inset zone. The anchor item
    // (item-1) is the first item in view; moving its position up (simulating an above-viewport
    // shrink) makes MVCP want a negative adjust. With a bottom inset this is the geometry where
    // the spacer-only adjust fights the native end-clamp and must be routed through the handoff.
    //
    // NOTE: these unit mocks do not shrink `totalSize`/`sizes` when `positions` is hand-edited,
    // so `getContentSize`/maxScroll stay at their pre-shrink values. That faithfully exercises the
    // ARMING decision and the isResize routing, but not the partial native-clamp split (where
    // predictedNativeClamp is a non-zero fraction of the amount) — that split is covered by the
    // on-device verification and the resolve-path tests below that set the pending directly.
    const buildNativeResizeAgainstInsetContext = (anchoredEndSpaceVisible: boolean) => {
        const SCROLL_LENGTH = 300;
        const ANCHORED_END_SPACE = 250;
        const RAW_CONTENT = 580;

        const mockCtx = createMockContext(
            {
                anchoredEndSpaceSize: anchoredEndSpaceVisible ? ANCHORED_END_SPACE : 0,
                readyToRender: true,
                totalSize: RAW_CONTENT,
            },
            {
                didContainersLayout: true,
                didFinishInitialScroll: true,
                hasScrolled: true,
                idCache: ["item-0", "item-1", "item-2"],
                idsInView: ["item-1", "item-2"],
                indexByKey: new Map([
                    ["item-0", 0],
                    ["item-1", 1],
                    ["item-2", 2],
                ]),
                positions: [0, 400, 500],
                props: {
                    anchoredEndSpace: anchoredEndSpaceVisible ? { anchorIndex: 1, includeInEndInset: true } : undefined,
                    data: [{ id: 0 }, { id: 1 }, { id: 2 }],
                    keyExtractor: (item: { id: number }) => `item-${item.id}`,
                    maintainVisibleContentPosition: normalizeMaintainVisibleContentPosition(true),
                },
                scrollLength: SCROLL_LENGTH,
                sizes: new Map([
                    ["item-0", 400],
                    ["item-1", 100],
                    ["item-2", 80],
                ]),
            },
        );

        // Scroll to the end (content size includes the blank inset).
        const contentSize = RAW_CONTENT + (anchoredEndSpaceVisible ? ANCHORED_END_SPACE : 0);
        mockCtx.state.scroll = Math.max(0, contentSize - SCROLL_LENGTH);
        return mockCtx;
    };

    it("routes a resize in the bottom-inset zone through the native-clamp handoff", () => {
        Platform.OS = "ios";
        const mockCtx = buildNativeResizeAgainstInsetContext(/* anchoredEndSpaceVisible */ true);

        const requestAdjustSpy = spyOn(requestAdjustModule, "requestAdjust");
        try {
            const adjustFunction = prepareMVCP(mockCtx);
            // Item-0 above the viewport shrank by 200, so the anchor (item-1) recomputes up by 200.
            mockCtx.state.positions[1] = 200;

            adjustFunction?.();

            // The resize against a bottom inset is routed through the native-clamp handoff (a pending
            // adjust is queued with isResize) rather than a plain spacer adjust, so it can reconcile
            // against native instead of being eaten by the end-clamp.
            expect(mockCtx.state.pendingNativeMVCPAdjust).toBeDefined();
            expect(mockCtx.state.pendingNativeMVCPAdjust?.amount).toBeCloseTo(-200, 1);
            expect(mockCtx.state.pendingNativeMVCPAdjust?.isResize).toBe(true);
        } finally {
            requestAdjustSpy.mockRestore();
        }
    });

    it("does not queue a handoff for a resize with no bottom inset", () => {
        Platform.OS = "ios";
        const mockCtx = buildNativeResizeAgainstInsetContext(/* anchoredEndSpaceVisible */ false);

        const requestAdjustSpy = spyOn(requestAdjustModule, "requestAdjust");
        try {
            const adjustFunction = prepareMVCP(mockCtx);
            mockCtx.state.positions[1] = 200;

            adjustFunction?.();

            // Without a bottom inset there is no end-clamp to fight, so the plain adjust path runs.
            expect(mockCtx.state.pendingNativeMVCPAdjust).toBeUndefined();
            expect(requestAdjustSpy).toHaveBeenCalledWith(mockCtx, -200, undefined);
        } finally {
            requestAdjustSpy.mockRestore();
        }
    });

    it("does not queue a handoff for a mid-list resize against a bottom inset", () => {
        Platform.OS = "ios";
        const mockCtx = buildNativeResizeAgainstInsetContext(/* anchoredEndSpaceVisible */ true);
        // Move well away from the end (viewport entirely above the inset zone) so the native clamp
        // would not eat the adjustment and the plain spacer path is correct.
        mockCtx.state.scroll = 100;

        const requestAdjustSpy = spyOn(requestAdjustModule, "requestAdjust");
        try {
            const adjustFunction = prepareMVCP(mockCtx);
            mockCtx.state.positions[1] = 200;

            adjustFunction?.();

            expect(mockCtx.state.pendingNativeMVCPAdjust).toBeUndefined();
            expect(requestAdjustSpy).toHaveBeenCalledWith(mockCtx, -200, undefined);
        } finally {
            requestAdjustSpy.mockRestore();
        }
    });

    it("arms the handoff for a resize while only PARTIALLY into the inset zone", () => {
        // Regression for the partial-inset upward-shift bug: the viewport overlaps the bottom inset
        // but is not pinned hard at the end, so the handoff must arm even though the shrink does not
        // exceed the distance to the end. Pre-fix this fell through to a plain requestAdjust(-200)
        // which over-compensated upward (native had room and absorbed nothing).
        Platform.OS = "ios";
        const mockCtx = buildNativeResizeAgainstInsetContext(/* anchoredEndSpaceVisible */ true);
        // contentSize=830, realContentEnd=830-250=580. Park partway into the inset zone: the
        // viewport [430,730] covers 150px of real content + 150px of inset.
        mockCtx.state.scroll = 430;

        const requestAdjustSpy = spyOn(requestAdjustModule, "requestAdjust");
        try {
            const adjustFunction = prepareMVCP(mockCtx);
            mockCtx.state.positions[1] = 200;

            adjustFunction?.();

            // It arms the handoff (isResize) instead of taking the plain spacer path.
            expect(mockCtx.state.pendingNativeMVCPAdjust).toBeDefined();
            expect(mockCtx.state.pendingNativeMVCPAdjust?.amount).toBeCloseTo(-200, 1);
            expect(mockCtx.state.pendingNativeMVCPAdjust?.isResize).toBe(true);
        } finally {
            requestAdjustSpy.mockRestore();
        }
    });

    it("settles immediately when only the manual native MVCP adjustment remained", () => {
        const mockCtx = createMockContext(
            { totalSize: 300 },
            {
                pendingNativeMVCPAdjust: {
                    amount: -80,
                    furthestProgressTowardAmount: 0,
                    isResize: false,
                    manualApplied: -80,
                    startScroll: 420,
                },
                scrollLength: 100,
            },
        );
        const requestAdjustSpy = spyOn(requestAdjustModule, "requestAdjust");
        try {
            const didSettle = resolvePendingNativeMVCPAdjust(mockCtx as StateContext, 340);

            expect(didSettle).toBe(true);
            expect(mockCtx.state.pendingNativeMVCPAdjust).toBeUndefined();
            expect(requestAdjustSpy).not.toHaveBeenCalled();
        } finally {
            requestAdjustSpy.mockRestore();
        }
    });

    // When native reaches its true max with a large remaining amount (a big shrink scrolled deep
    // into the now-gone content), a resize must settle WITHOUT a further spacer adjust — applying
    // the leftover would force native to re-clamp and overshoot the visible position. A data change
    // in the same situation keeps its tuned behavior of applying the remainder. These two tests pin
    // that divergence (the hardest-won part of the fix); reverting the resize branch fails the first.
    const buildClampSettleContext = (isResize: boolean) =>
        createMockContext(
            // totalSize 300 + scrollLength 100 => native max scroll is 200.
            { totalSize: 300 },
            {
                pendingNativeMVCPAdjust: {
                    amount: -300,
                    furthestProgressTowardAmount: 0,
                    isResize,
                    manualApplied: -80,
                    startScroll: 420,
                },
                scrollLength: 100,
            },
        );

    it("settles a resize at the native clamp without applying a further spacer adjust", () => {
        Platform.OS = "ios";
        const mockCtx = buildClampSettleContext(/* isResize */ true);
        const requestAdjustSpy = spyOn(requestAdjustModule, "requestAdjust");
        try {
            // newScroll === expectedNativeClampScroll (200) => native has clamped to its true max.
            const didSettle = resolvePendingNativeMVCPAdjust(mockCtx as StateContext, 200);

            expect(didSettle).toBe(true);
            expect(mockCtx.state.pendingNativeMVCPAdjust).toBeUndefined();
            // The resize must NOT nudge the spacer further once native is pinned at the clamp.
            expect(requestAdjustSpy).not.toHaveBeenCalled();
        } finally {
            requestAdjustSpy.mockRestore();
        }
    });

    it("applies the remaining amount for a data change at the native clamp (unchanged behavior)", () => {
        Platform.OS = "ios";
        const mockCtx = buildClampSettleContext(/* isResize */ false);
        const requestAdjustSpy = spyOn(requestAdjustModule, "requestAdjust");
        try {
            // Same geometry, but a data change still applies the leftover remainder via settle.
            const didSettle = resolvePendingNativeMVCPAdjust(mockCtx as StateContext, 200);

            expect(didSettle).toBe(true);
            expect(mockCtx.state.pendingNativeMVCPAdjust).toBeUndefined();
            // remainingAfterManual(-220) - nativeDelta(200 - (420 + -80) = -140) = -80 applied.
            expect(requestAdjustSpy).toHaveBeenCalledWith(mockCtx, -80, true);
        } finally {
            requestAdjustSpy.mockRestore();
        }
    });
});
