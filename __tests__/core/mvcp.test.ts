import { afterEach, describe, expect, it, spyOn } from "bun:test";
import "../setup";

import { prepareMVCP, resolvePendingNativeMVCPAdjust } from "@/core/mvcp";
import { Platform } from "@/platform/Platform";
import type { StateContext } from "@/state/state";
import { normalizeMaintainVisibleContentPosition } from "@/utils/normalizeMaintainVisibleContentPosition";
import * as requestAdjustModule from "@/utils/requestAdjust";
import { createMockContext } from "../__mocks__/createMockContext";

const originalPlatform = Platform.OS;
const originalNavigator = globalThis.navigator;

describe("mvcp helpers", () => {
    afterEach(() => {
        Platform.OS = originalPlatform;
        if (originalNavigator === undefined) {
            delete (globalThis as typeof globalThis & { navigator?: Navigator }).navigator;
        } else {
            Object.defineProperty(globalThis, "navigator", {
                configurable: true,
                value: originalNavigator,
                writable: true,
            });
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

            expect(requestAdjustSpy).toHaveBeenCalledWith(mockCtx, 50, true, {
                markNativeMVCPSettling: true,
                source: "mvcp:positionDiff",
            });
            expect(mockCtx.state.mvcpAnchorLock).toBeUndefined();
        } finally {
            requestAdjustSpy.mockRestore();
        }
    });

    it("keeps web mvcp anchored to the initial target briefly after initial scroll finishes", () => {
        Platform.OS = "web";
        Object.defineProperty(globalThis, "navigator", {
            configurable: true,
            value: {
                maxTouchPoints: 5,
                userAgent:
                    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Mobile/15E148 Safari/604.1",
            },
            writable: true,
        });

        const mockCtx = createMockContext(
            { totalSize: 1000 },
            {
                didContainersLayout: true,
                didFinishInitialScroll: true,
                idCache: ["item-0", "item-1", "item-2", "item-3"],
                idsInView: ["item-1"],
                indexByKey: new Map([
                    ["item-0", 0],
                    ["item-1", 1],
                    ["item-2", 2],
                    ["item-3", 3],
                ]),
                initialScrollLastTarget: { index: 3, viewOffset: 0, viewPosition: 0 },
                initialScrollMVCPAnchorUntil: Date.now() + 1000,
                positions: [0, 100, 250, 450],
                props: {
                    data: [{ id: 0 }, { id: 1 }, { id: 2 }, { id: 3 }],
                    keyExtractor: (item: { id: number }) => `item-${item.id}`,
                    maintainVisibleContentPosition: normalizeMaintainVisibleContentPosition(true),
                },
            },
        );

        const requestAdjustSpy = spyOn(requestAdjustModule, "requestAdjust");
        try {
            const adjustFunction = prepareMVCP(mockCtx);
            mockCtx.state.positions[1] = 220;
            mockCtx.state.positions[3] = 490;

            adjustFunction?.();

            expect(requestAdjustSpy).toHaveBeenCalledWith(mockCtx, 40, undefined, {
                markNativeMVCPSettling: true,
                source: "mvcp:positionDiff",
            });
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
