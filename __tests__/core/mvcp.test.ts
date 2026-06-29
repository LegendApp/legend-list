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

    it("syncs scroll state to maxScroll instead of anchor-adjusting when an end target is clamped by shrink", () => {
        // Mirrors an Android end-aligned chat mount where measured rows above the target shrink total content.
        const mockCtx = createMockContext(
            { totalSize: 12006.25 },
            {
                idCache: ["item-0", "item-1", "item-2"],
                indexByKey: new Map([
                    ["item-0", 0],
                    ["item-1", 1],
                    ["item-2", 2],
                ]),
                positions: [0, 100, 11818.25],
                props: {
                    data: [{ id: 0 }, { id: 1 }, { id: 2 }],
                    keyExtractor: (item: { id: number }) => `item-${item.id}`,
                    maintainVisibleContentPosition: normalizeMaintainVisibleContentPosition(true),
                },
                scroll: 11395.583374023438,
                scrollingTo: {
                    animated: false,
                    index: 2,
                    itemSize: 159,
                    offset: 11395.583374023438,
                    viewPosition: 1,
                },
                scrollLength: 610.6666259765625,
                scrollPending: 11395.583374023438,
            },
        );
        const requestAdjustSpy = spyOn(requestAdjustModule, "requestAdjust");
        try {
            const adjustFunction = prepareMVCP(mockCtx);
            mockCtx.state.positions[2] = 11785.25;
            mockCtx.state.totalSize = 11973.25;

            adjustFunction?.();

            const maxScroll = 11973.25 - 610.6666259765625;
            expect(mockCtx.state.scroll).toBe(maxScroll);
            expect(mockCtx.state.scrollPending).toBe(maxScroll);
            expect(requestAdjustSpy).not.toHaveBeenCalled();
        } finally {
            requestAdjustSpy.mockRestore();
        }
    });

    it("does not clamp a shrinking end target while the current scroll is still inside the new content bounds", () => {
        const mockCtx = createMockContext(
            { totalSize: 1000 },
            {
                idCache: ["item-0", "item-1", "item-2"],
                indexByKey: new Map([
                    ["item-0", 0],
                    ["item-1", 1],
                    ["item-2", 2],
                ]),
                positions: [0, 200, 700],
                props: {
                    data: [{ id: 0 }, { id: 1 }, { id: 2 }],
                    keyExtractor: (item: { id: number }) => `item-${item.id}`,
                    maintainVisibleContentPosition: normalizeMaintainVisibleContentPosition(true),
                },
                scroll: 300,
                scrollingTo: {
                    animated: false,
                    index: 2,
                    itemSize: 100,
                    offset: 300,
                    viewPosition: 1,
                },
                scrollLength: 300,
                scrollPending: 300,
                sizes: new Map([
                    ["item-0", 200],
                    ["item-1", 500],
                    ["item-2", 100],
                ]),
            },
        );
        const requestAdjustSpy = spyOn(requestAdjustModule, "requestAdjust");
        try {
            const adjustFunction = prepareMVCP(mockCtx);
            mockCtx.state.positions[2] = 650;
            mockCtx.state.totalSize = 950;

            adjustFunction?.();

            expect(mockCtx.state.scroll).toBe(250);
            expect(mockCtx.state.scrollPending).toBe(300);
            expect(requestAdjustSpy).toHaveBeenCalledWith(mockCtx, -50, undefined);
        } finally {
            requestAdjustSpy.mockRestore();
        }
    });

    it("does not clamp a shrinking target that is not end-aligned", () => {
        const mockCtx = createMockContext(
            { totalSize: 1000 },
            {
                idCache: ["item-0", "item-1", "item-2"],
                indexByKey: new Map([
                    ["item-0", 0],
                    ["item-1", 1],
                    ["item-2", 2],
                ]),
                positions: [0, 200, 700],
                props: {
                    data: [{ id: 0 }, { id: 1 }, { id: 2 }],
                    keyExtractor: (item: { id: number }) => `item-${item.id}`,
                    maintainVisibleContentPosition: normalizeMaintainVisibleContentPosition(true),
                },
                scroll: 650,
                scrollingTo: {
                    animated: false,
                    index: 2,
                    itemSize: 100,
                    offset: 650,
                    viewPosition: 0,
                },
                scrollLength: 300,
                scrollPending: 650,
                sizes: new Map([
                    ["item-0", 200],
                    ["item-1", 500],
                    ["item-2", 100],
                ]),
            },
        );
        const requestAdjustSpy = spyOn(requestAdjustModule, "requestAdjust");
        try {
            const adjustFunction = prepareMVCP(mockCtx);
            mockCtx.state.positions[2] = 650;
            mockCtx.state.totalSize = 950;

            adjustFunction?.();

            expect(mockCtx.state.scroll).toBe(600);
            expect(mockCtx.state.scrollPending).toBe(650);
            expect(requestAdjustSpy).toHaveBeenCalledWith(mockCtx, -50, undefined);
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
});
