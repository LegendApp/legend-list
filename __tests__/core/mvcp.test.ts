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

    it.each([
        { bottom: 0, manual: -20, minimum: undefined },
        { bottom: 20, manual: -170, minimum: 350 },
    ])("predicts the native shrink clamp with minimum $minimum", ({ minimum, bottom, manual }) => {
        Platform.OS = "ios";
        const ctx = createMockContext(
            { totalSize: 100 },
            {
                pendingNativeMVCPAdjust: {
                    amount: -200,
                    furthestProgressTowardAmount: 0,
                    manualApplied: 0,
                    startScroll: 100,
                },
                props: {
                    contentContainerMinSize: minimum,
                    contentInset: { bottom, left: 0, right: 0, top: 80 },
                    maintainVisibleContentPosition: normalizeMaintainVisibleContentPosition(true),
                },
                scroll: 100,
                scrollLength: 300,
            },
        );
        const requestAdjustSpy = spyOn(requestAdjustModule, "requestAdjust");
        try {
            expect(prepareMVCP(ctx, true)).toBeUndefined();
            expect(ctx.state.pendingNativeMVCPAdjust?.manualApplied).toBe(manual);
            expect(requestAdjustSpy).toHaveBeenCalledWith(ctx, manual, "data");
        } finally {
            requestAdjustSpy.mockRestore();
            ctx.state.scheduledWork.dispose();
        }
    });

    it.each([
        { bottom: 0, end: -80, minimum: undefined, remainder: -70 },
        { bottom: 20, end: 70, minimum: 350, remainder: -220 },
    ])("settles a pending native shrink with minimum $minimum", ({ minimum, bottom, end, remainder }) => {
        Platform.OS = "ios";
        const ctx = createMockContext(
            { totalSize: 100 },
            {
                pendingNativeMVCPAdjust: {
                    amount: -250,
                    furthestProgressTowardAmount: 0,
                    manualApplied: 0,
                    startScroll: 100,
                },
                props: { contentContainerMinSize: minimum, contentInset: { bottom, left: 0, right: 0, top: 80 } },
                scroll: 100,
                scrollLength: 300,
            },
        );
        const requestAdjustSpy = spyOn(requestAdjustModule, "requestAdjust");
        try {
            expect(resolvePendingNativeMVCPAdjust(ctx, end)).toBe(true);
            expect(ctx.state.pendingNativeMVCPAdjust).toBeUndefined();
            expect(requestAdjustSpy).toHaveBeenCalledWith(ctx, remainder, "data");
        } finally {
            requestAdjustSpy.mockRestore();
            ctx.state.scheduledWork.dispose();
        }
    });

    it.each([
        { bottom: 0, end: -80, minimum: undefined },
        { bottom: 20, end: 70, minimum: 350 },
    ])("syncs a shrinking end target with minimum $minimum", ({ minimum, bottom, end }) => {
        Platform.OS = "ios";
        const ctx = createMockContext(
            { totalSize: 500 },
            {
                idCache: ["a", "b"],
                indexByKey: new Map([
                    ["a", 0],
                    ["b", 1],
                ]),
                positions: [0, 400],
                props: {
                    contentContainerMinSize: minimum,
                    contentInset: { bottom, left: 0, right: 0, top: 80 },
                    data: [{ id: "a" }, { id: "b" }],
                    getFixedItemSize: () => 100,
                    keyExtractor: (item: { id: string }) => item.id,
                    maintainVisibleContentPosition: normalizeMaintainVisibleContentPosition(true),
                },
                scroll: 200,
                scrollingTo: { animated: false, index: 1, itemSize: 100, offset: 200, viewPosition: 1 },
                scrollLength: 300,
                scrollPending: 200,
            },
        );
        const requestAdjustSpy = spyOn(requestAdjustModule, "requestAdjust");
        try {
            const adjust = prepareMVCP(ctx);
            ctx.state.totalSize = 100;
            ctx.state.positions[1] = 0;
            adjust?.();
            expect(ctx.state.scroll).toBe(end);
            expect(ctx.state.scrollPending).toBe(end);
            expect(requestAdjustSpy).not.toHaveBeenCalled();
        } finally {
            requestAdjustSpy.mockRestore();
            ctx.state.scheduledWork.dispose();
        }
    });

    it("keeps the keyed scroll target across a prepend before the key map is rebuilt", () => {
        Platform.OS = "web";
        const ctx = createMockContext(
            { totalSize: 1000 },
            {
                indexByKey: new Map([
                    ["a", 0],
                    ["b", 1],
                    ["c", 2],
                ]),
                positions: [0, 100, 200],
                props: {
                    data: [{ id: "new" }, { id: "a" }, { id: "b" }, { id: "c" }],
                    getFixedItemSize: (item: { id: string }) => (item.id === "b" ? 200 : 100),
                    keyExtractor: (item: { id: string }) => item.id,
                    maintainVisibleContentPosition: normalizeMaintainVisibleContentPosition(true),
                },
                scroll: 100,
                scrollingTo: { animated: true, index: 1, itemSize: 200, key: "b", offset: 100, viewPosition: 0.5 },
            },
        );
        const adjust = prepareMVCP(ctx, true);
        ctx.state.indexByKey.clear();
        for (const [index, item] of ctx.state.props.data.entries()) ctx.state.indexByKey.set(item.id, index);
        ctx.state.positions.splice(0, 0, 0);
        ctx.state.positions[1] = 100;
        ctx.state.positions[2] = 200;
        ctx.state.positions[3] = 300;
        adjust?.();
        expect(ctx.state.scrollingTo?.index).toBe(2);
        expect(ctx.state.scroll).toBe(200);
        ctx.state.scheduledWork.dispose();
    });

    it("does not restore native row positions while both restoration modes are disabled", () => {
        Platform.OS = "ios";
        const ctx = createMockContext(
            { totalSize: 1000 },
            {
                didContainersLayout: true,
                idCache: ["item-0", "item-1"],
                idsInView: ["item-1"],
                indexByKey: new Map([
                    ["item-0", 0],
                    ["item-1", 1],
                ]),
                positions: [0, 100],
                props: {
                    data: [{ id: 0 }, { id: 1 }],
                    keyExtractor: (item: { id: number }) => `item-${item.id}`,
                    maintainVisibleContentPosition: normalizeMaintainVisibleContentPosition(false),
                },
                scroll: 120,
            },
        );
        for (const dataChanged of [false, true]) {
            const adjust = prepareMVCP(ctx, dataChanged);
            ctx.state.positions[1] += 50;
            adjust?.();
            expect(ctx.state.scroll).toBe(120);
            expect(ctx.values.get("scrollAdjust")).toBe(0);
            expect(ctx.state.pendingNativeMVCPAdjust).toBeUndefined();
        }
    });

    it("restores an explicit reader anchor even while both restoration modes are disabled", () => {
        Platform.OS = "ios";
        for (const dataChanged of [false, true]) {
            const ctx = createMockContext(
                { readyToRender: true, totalSize: 1000 },
                {
                    didContainersLayout: true,
                    idCache: ["item-0", "item-1"],
                    idsInView: ["item-1"],
                    indexByKey: new Map([
                        ["item-0", 0],
                        ["item-1", 1],
                    ]),
                    positions: [0, 100],
                    props: {
                        data: [{ id: 0 }, { id: 1 }],
                        keyExtractor: (item: { id: number }) => `item-${item.id}`,
                        maintainVisibleContentPosition: normalizeMaintainVisibleContentPosition(false),
                    },
                    scroll: 120,
                    visibleContentAnchor: { key: "item-1", offset: 20 },
                },
            );
            const adjust = prepareMVCP(ctx, dataChanged);
            ctx.state.positions[1] += 50;
            adjust?.();
            expect(ctx.state.scroll - ctx.state.positions[1]!).toBe(20);
            expect(ctx.state.pendingNativeMVCPAdjust).toBeUndefined();
            ctx.state.scheduledWork.dispose();
        }
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

            expect(requestAdjustSpy).toHaveBeenCalledWith(mockCtx, 50, "data");
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
