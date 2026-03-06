import { beforeEach, describe, expect, it, spyOn } from "bun:test";
import "../setup"; // Import global test setup

import { Platform } from "@/platform/Platform";
import { prepareMVCP } from "../../src/core/mvcp";
import type { StateContext } from "../../src/state/state";
import type { InternalState } from "../../src/types";
import { normalizeMaintainVisibleContentPosition } from "../../src/utils/normalizeMaintainVisibleContentPosition";
import * as requestAdjustModule from "../../src/utils/requestAdjust";
import { createMockContext } from "../__mocks__/createMockContext";
import { setLayoutValue } from "../helpers/layoutArrays";

describe("prepareMVCP", () => {
    let mockCtx: StateContext;
    let mockState: InternalState;
    let requestAdjustSpy: any;
    const setScrollingTo = (value: any) => {
        mockCtx.state.scrollingTo = value;
    };
    const expectAdjustFunction = (fn: ReturnType<typeof prepareMVCP>) => {
        expect(fn).toBeDefined();
        return fn!;
    };
    const enableMvcpAnchorLock = () => {
        mockState.props.maintainVisibleContentPosition = normalizeMaintainVisibleContentPosition(true);
    };
    const withWebPlatform = (fn: () => void) => {
        const prevPlatform = Platform.OS;
        Platform.OS = "web";
        try {
            fn();
        } finally {
            Platform.OS = prevPlatform;
        }
    };

    beforeEach(() => {
        const positions = [0, 100, 250, 450, 550];

        const indexByKey = new Map([
            ["item-0", 0],
            ["item-1", 1],
            ["item-2", 2],
            ["item-3", 3],
            ["item-4", 4],
        ]);

        mockCtx = createMockContext(
            {
                readyToRender: true,
            },
            {
                didContainersLayout: true,
                didFinishInitialScroll: true,
                hasScrolled: false,
                idCache: ["item-0", "item-1", "item-2", "item-3", "item-4"],
                idsInView: ["item-1", "item-2"], // Default items in view
                indexByKey,
                positions,
                props: {
                    data: [
                        { id: 0, text: "Item 0" },
                        { id: 1, text: "Item 1" },
                        { id: 2, text: "Item 2" },
                        { id: 3, text: "Item 3" },
                        { id: 4, text: "Item 4" },
                    ],
                    keyExtractor: (item: any) => `item-${item.id}`,
                    maintainVisibleContentPosition: normalizeMaintainVisibleContentPosition(undefined),
                },
                scrollLength: 500,
                sizes: new Map([
                    ["item-0", 100],
                    ["item-1", 150],
                    ["item-2", 200],
                    ["item-3", 100],
                    ["item-4", 180],
                ]),
            },
        );

        mockState = mockCtx.state;

        // Spy on requestAdjust function and reset it
        if (requestAdjustSpy) {
            requestAdjustSpy.mockRestore();
        }
        requestAdjustSpy = spyOn(requestAdjustModule, "requestAdjust");
    });

    describe("basic functionality", () => {
        it("should return a function when called", () => {
            const adjustFunction = expectAdjustFunction(prepareMVCP(mockCtx));
            expect(typeof adjustFunction).toBe("function");
        });

        it("should adjust during regular scroll by default", () => {
            mockState.props.maintainVisibleContentPosition = normalizeMaintainVisibleContentPosition(undefined);

            const adjustFunction = expectAdjustFunction(prepareMVCP(mockCtx));

            // Change the position of the first visible item
            setLayoutValue(mockState, "positions", "item-1", 150); // Changed from 100 to 150

            adjustFunction();

            expect(requestAdjustSpy).toHaveBeenCalledWith(mockCtx, 50, undefined);
        });

        it("should not adjust during regular scroll when maintainVisibleContentPosition is false", () => {
            mockState.props.maintainVisibleContentPosition = normalizeMaintainVisibleContentPosition(false);

            const adjustFunction = prepareMVCP(mockCtx);

            expect(adjustFunction).toBeUndefined();
            expect(requestAdjustSpy).not.toHaveBeenCalled();
        });

        it("should allow disabling scroll-time MVCP via config", () => {
            mockState.props.maintainVisibleContentPosition = normalizeMaintainVisibleContentPosition({
                size: false,
            });

            const adjustFunction = prepareMVCP(mockCtx);

            expect(adjustFunction).toBeUndefined();
            expect(requestAdjustSpy).not.toHaveBeenCalled();
        });

        it("should capture initial position of first visible item", () => {
            const adjustFunction = expectAdjustFunction(prepareMVCP(mockCtx));

            // Change the position of the first visible item
            setLayoutValue(mockState, "positions", "item-1", 150); // Changed from 100 to 150

            adjustFunction();

            expect(requestAdjustSpy).toHaveBeenCalledWith(mockCtx, 50, undefined);
        });

        it("should handle scrollingTo target prioritization", () => {
            setScrollingTo({ animated: true, index: 3, offset: 0 });

            const adjustFunction = expectAdjustFunction(prepareMVCP(mockCtx));

            // Change the position of the scroll target
            setLayoutValue(mockState, "positions", "item-3", 500); // Changed from 450 to 500

            adjustFunction();

            expect(requestAdjustSpy).toHaveBeenCalledWith(mockCtx, 50, undefined);
        });
    });

    describe("dataChanged handling", () => {
        it("should skip dataChanged adjustments when maintainVisibleContentPosition is disabled", () => {
            mockState.props.maintainVisibleContentPosition = normalizeMaintainVisibleContentPosition(false);

            const adjustFunction = prepareMVCP(mockCtx, true);

            setLayoutValue(mockState, "positions", "item-1", 200);

            expect(adjustFunction).toBeUndefined();
            expect(requestAdjustSpy).not.toHaveBeenCalled();
        });

        it("should adjust on dataChanged when maintainVisibleContentPosition is enabled", () => {
            withWebPlatform(() => {
                mockState.props.maintainVisibleContentPosition = normalizeMaintainVisibleContentPosition(true);

                const adjustFunction = expectAdjustFunction(prepareMVCP(mockCtx, true));

                setLayoutValue(mockState, "positions", "item-1", 150);

                adjustFunction();

                expect(requestAdjustSpy).toHaveBeenCalledWith(mockCtx, 50, true);
            });
        });

        it("should adjust on dataChanged when only dataChanged is enabled", () => {
            withWebPlatform(() => {
                mockState.props.maintainVisibleContentPosition = normalizeMaintainVisibleContentPosition({
                    data: true,
                    size: false,
                });

                const adjustFunction = expectAdjustFunction(prepareMVCP(mockCtx, true));

                setLayoutValue(mockState, "positions", "item-1", 150);

                adjustFunction();

                expect(requestAdjustSpy).toHaveBeenCalledWith(mockCtx, 50, true);
            });
        });

        it("queues native dataChanged anchoring when near the end and the delta would overshoot", () => {
            mockState.props.maintainVisibleContentPosition = normalizeMaintainVisibleContentPosition(true);
            mockState.dataChangeEpoch = 7;
            mockState.scroll = 420;
            mockState.scrollLength = 500;
            mockState.idsInView = ["item-1", "item-2"];
            mockState.positions = [0, 300, 450];
            mockState.sizes = new Map([
                ["item-0", 300],
                ["item-1", 150],
                ["item-2", 200],
            ]);
            mockState.dataChangeNeedsScrollUpdate = true;
            mockCtx.values.set("totalSize", 1000);

            const adjustFunction = expectAdjustFunction(prepareMVCP(mockCtx, true));

            mockState.props.data = [
                { id: 1, text: "Item 1" },
                { id: 2, text: "Item 2" },
            ];
            mockState.idCache = ["item-1", "item-2"];
            mockState.indexByKey.clear();
            mockState.indexByKey.set("item-1", 0);
            mockState.indexByKey.set("item-2", 1);
            mockState.positions.length = 0;
            mockState.positions.push(0, 150);
            mockCtx.values.set("totalSize", 700);

            adjustFunction();

            expect(requestAdjustSpy).not.toHaveBeenCalled();
            expect(mockState.pendingNativeMVCPAdjust).toBeDefined();
            expect(mockState.pendingNativeMVCPAdjust?.amount).toBe(-300);
            expect(mockState.pendingNativeMVCPAdjust?.dataChangeEpoch).toBe(7);
            expect(mockState.pendingNativeMVCPAdjust?.startScroll).toBe(420);
            clearTimeout(mockState.pendingNativeMVCPAdjust?.timeout);
            mockState.pendingNativeMVCPAdjust = undefined;
        });

        it("skips follow-up native mvcp passes while a queued remainder is pending", () => {
            mockState.props.maintainVisibleContentPosition = normalizeMaintainVisibleContentPosition(true);
            mockState.dataChangeEpoch = 3;
            mockState.dataChangeNeedsScrollUpdate = true;
            mockState.pendingNativeMVCPAdjust = {
                amount: -300,
                dataChangeEpoch: 3,
                startScroll: 420,
                timeout: undefined,
            };

            const adjustFunction = prepareMVCP(mockCtx);

            expect(adjustFunction).toBeUndefined();
            expect(requestAdjustSpy).not.toHaveBeenCalled();
        });

        it("keeps visible content stable when removing a tall item far above the viewport away from the end", () => {
            withWebPlatform(() => {
                mockState.props.maintainVisibleContentPosition = normalizeMaintainVisibleContentPosition({
                    data: true,
                    size: false,
                });
                mockState.scroll = 680;
                mockState.scrollLength = 250;
                mockState.idsInView = ["item-3", "item-4", "item-5"];
                mockState.positions = [0, 300, 450, 650, 750, 930];
                mockState.sizes = new Map([
                    ["item-0", 300],
                    ["item-1", 150],
                    ["item-2", 200],
                    ["item-3", 100],
                    ["item-4", 180],
                    ["item-5", 300],
                ]);

                const adjustFunction = expectAdjustFunction(prepareMVCP(mockCtx, true));

                mockState.props.data = [
                    { id: 1, text: "Item 1" },
                    { id: 2, text: "Item 2" },
                    { id: 3, text: "Item 3" },
                    { id: 4, text: "Item 4" },
                    { id: 5, text: "Item 5" },
                ];
                mockState.idCache = ["item-1", "item-2", "item-3", "item-4", "item-5"];
                mockState.indexByKey.clear();
                mockState.indexByKey.set("item-1", 0);
                mockState.indexByKey.set("item-2", 1);
                mockState.indexByKey.set("item-3", 2);
                mockState.indexByKey.set("item-4", 3);
                mockState.indexByKey.set("item-5", 4);
                mockState.positions.length = 0;
                mockState.positions.push(0, 150, 350, 450, 630);

                adjustFunction();

                expect(requestAdjustSpy).toHaveBeenCalledWith(mockCtx, -300, true);
            });
        });

        it("should skip anchors excluded by shouldRestorePosition on dataChanged", () => {
            mockState.props.maintainVisibleContentPosition = normalizeMaintainVisibleContentPosition({
                data: true,
                shouldRestorePosition: (item) => item.id !== 1,
                size: false,
            });

            const adjustFunction = expectAdjustFunction(prepareMVCP(mockCtx, true));

            setLayoutValue(mockState, "positions", "item-1", 150);
            setLayoutValue(mockState, "positions", "item-2", 260);

            adjustFunction();

            expect(requestAdjustSpy).toHaveBeenCalledWith(mockCtx, 10, true);
        });

        it("restores position when idsInView already contains an oversized visible row", () => {
            mockState.props.maintainVisibleContentPosition = normalizeMaintainVisibleContentPosition({
                data: true,
                size: false,
            });
            mockState.scroll = 250;
            mockState.scrollLength = 300;
            mockState.positions = [0, 100, 900, 1000, 1100];
            mockState.sizes = new Map([
                ["item-0", 100],
                ["item-1", 800],
                ["item-2", 100],
                ["item-3", 100],
                ["item-4", 100],
            ]);
            mockState.idsInView = ["item-1"];

            const adjustFunction = expectAdjustFunction(prepareMVCP(mockCtx, true));

            setLayoutValue(mockState, "positions", "item-1", 300);
            setLayoutValue(mockState, "positions", "item-2", 1100);

            adjustFunction();

            expect(requestAdjustSpy).toHaveBeenCalledWith(mockCtx, 200, true);
        });
    });

    describe("mvcp anchor lock platform behavior", () => {
        it("sets mvcp anchor lock on web when data changes", () => {
            withWebPlatform(() => {
                enableMvcpAnchorLock();

                const adjustFunction = expectAdjustFunction(prepareMVCP(mockCtx, true));
                setLayoutValue(mockState, "positions", "item-1", 150);

                adjustFunction();

                expect(mockState.mvcpAnchorLock).toBeDefined();
                expect(mockState.mvcpAnchorLock?.id).toBe("item-1");
                expect(mockState.mvcpAnchorLock?.position).toBe(150);
            });
        });

        it("does not set mvcp anchor lock on non-web platforms", () => {
            Platform.OS = "ios";
            enableMvcpAnchorLock();

            const adjustFunction = expectAdjustFunction(prepareMVCP(mockCtx, true));
            setLayoutValue(mockState, "positions", "item-1", 150);

            adjustFunction();

            expect(mockState.mvcpAnchorLock).toBeUndefined();
        });
    });

    describe("anchor selection logic", () => {
        it("should prefer scrollingTo target over visible items", () => {
            setScrollingTo({ animated: true, index: 2, offset: 0 });
            mockState.idsInView = ["item-0", "item-1"]; // Different visible items

            const adjustFunction = expectAdjustFunction(prepareMVCP(mockCtx));

            // Change positions of both potential anchors
            setLayoutValue(mockState, "positions", "item-0", 50); // First visible item
            setLayoutValue(mockState, "positions", "item-2", 300); // Scroll target (should win)

            adjustFunction();

            // Should track the scroll target (item-2), not the first visible item
            expect(requestAdjustSpy).toHaveBeenCalledWith(mockCtx, 50, undefined); // 300 - 250 = 50
        });

        it("should fallback to first visible item when no scrollingTo", () => {
            setScrollingTo(undefined);
            mockState.idsInView = ["item-2", "item-3"];

            const adjustFunction = expectAdjustFunction(prepareMVCP(mockCtx));

            // Change position of first visible item
            setLayoutValue(mockState, "positions", "item-2", 300); // Changed from 250 to 300

            adjustFunction();

            expect(requestAdjustSpy).toHaveBeenCalledWith(mockCtx, 50, undefined);
        });

        it("should handle visible items not in indexByKey", () => {
            mockState.idsInView = ["non-existent-item", "item-1"];

            const adjustFunction = expectAdjustFunction(prepareMVCP(mockCtx));

            // Change position of the valid visible item
            setLayoutValue(mockState, "positions", "item-1", 150);

            adjustFunction();

            expect(requestAdjustSpy).toHaveBeenCalledWith(mockCtx, 50, undefined);
        });

        it("should handle no valid anchor items", () => {
            mockState.idsInView = [];
            setScrollingTo(undefined);

            const adjustFunction = expectAdjustFunction(prepareMVCP(mockCtx));

            adjustFunction();

            expect(requestAdjustSpy).not.toHaveBeenCalled();
        });
    });

    describe("end clamping behavior", () => {
        it("should not clamp positive adjustment when scroll target is not end-anchored", () => {
            mockCtx.values.set("totalSize", 600);
            mockState.scroll = 200;
            mockState.scrollLength = 500;
            setScrollingTo({ animated: true, index: 2, offset: 0, viewPosition: 0 });

            const adjustFunction = expectAdjustFunction(prepareMVCP(mockCtx));

            setLayoutValue(mockState, "positions", "item-2", 300); // Changed from 250 to 300

            adjustFunction();

            expect(requestAdjustSpy).toHaveBeenCalledWith(mockCtx, 50, undefined);
        });

        it("should keep clamping when scrolling to the end", () => {
            mockCtx.values.set("totalSize", 600);
            mockState.scroll = 200;
            mockState.scrollLength = 500;
            setScrollingTo({ animated: true, index: 4, offset: 0, viewPosition: 1 });

            const adjustFunction = expectAdjustFunction(prepareMVCP(mockCtx));

            setLayoutValue(mockState, "positions", "item-4", 600); // Changed from 550 to 600

            adjustFunction();

            expect(requestAdjustSpy).not.toHaveBeenCalled();
        });
    });

    describe("position change detection", () => {
        it("should ignore small position changes (<=0.1)", () => {
            const adjustFunction = expectAdjustFunction(prepareMVCP(mockCtx));

            // Make a tiny change
            setLayoutValue(mockState, "positions", "item-1", 100.05); // Change of 0.05

            adjustFunction();

            expect(requestAdjustSpy).not.toHaveBeenCalled();
        });

        it("should handle exactly 0.1 position change", () => {
            const adjustFunction = expectAdjustFunction(prepareMVCP(mockCtx));

            setLayoutValue(mockState, "positions", "item-1", 100.1); // Change of exactly 0.1

            adjustFunction();

            expect(requestAdjustSpy).not.toHaveBeenCalled();
        });

        it("should trigger on position change just above threshold", () => {
            const adjustFunction = expectAdjustFunction(prepareMVCP(mockCtx));

            setLayoutValue(mockState, "positions", "item-1", 100.11); // Change of 0.11

            adjustFunction();

            expect(requestAdjustSpy).toHaveBeenCalledTimes(1);

            // Get the actual call parameters to see what was passed
            const calls = requestAdjustSpy.mock.calls;
            expect(calls[0][0]).toBe(mockCtx);
            expect(Math.abs(calls[0][1] - 0.11)).toBeLessThan(0.00001); // Use floating point comparison
        });

        it("should handle negative position changes", () => {
            const adjustFunction = expectAdjustFunction(prepareMVCP(mockCtx));

            setLayoutValue(mockState, "positions", "item-1", 50); // Change from 100 to 50 = -50

            adjustFunction();

            expect(requestAdjustSpy).toHaveBeenCalledWith(mockCtx, -50, undefined);
        });

        it("should handle zero position change", () => {
            const adjustFunction = expectAdjustFunction(prepareMVCP(mockCtx));

            // No position change
            adjustFunction();

            expect(requestAdjustSpy).not.toHaveBeenCalled();
        });

        it("should handle large position changes", () => {
            const adjustFunction = expectAdjustFunction(prepareMVCP(mockCtx));

            setLayoutValue(mockState, "positions", "item-1", 1000); // Large change

            adjustFunction();

            expect(requestAdjustSpy).toHaveBeenCalledWith(mockCtx, 900, undefined);
        });
    });

    describe("edge cases and error handling", () => {
        it("should handle missing position data after preparation", () => {
            const adjustFunction = expectAdjustFunction(prepareMVCP(mockCtx));

            // Remove the position after preparation
            mockState.positions[1] = undefined;

            adjustFunction();

            expect(requestAdjustSpy).not.toHaveBeenCalled();
        });

        it("should handle containers not yet laid out", () => {
            mockState.didContainersLayout = mockState.didFinishInitialScroll = false;
            mockCtx.values.set("readyToRender", mockState.didContainersLayout);

            const adjustFunction = expectAdjustFunction(prepareMVCP(mockCtx));

            setLayoutValue(mockState, "positions", "item-1", 150);

            adjustFunction();

            expect(requestAdjustSpy).not.toHaveBeenCalled();
        });

        it("should handle empty idsInView array", () => {
            mockState.idsInView = [];
            setScrollingTo(undefined);

            const adjustFunction = expectAdjustFunction(prepareMVCP(mockCtx));

            adjustFunction();

            expect(requestAdjustSpy).not.toHaveBeenCalled();
        });

        it("should handle corrupted indexByKey", () => {
            mockState.indexByKey = new Map(); // Empty map
            setScrollingTo(undefined);

            const adjustFunction = expectAdjustFunction(prepareMVCP(mockCtx));

            adjustFunction();

            expect(requestAdjustSpy).not.toHaveBeenCalled();
        });

        it("should handle corrupted positions map", () => {
            mockState.positions = [];

            const adjustFunction = expectAdjustFunction(prepareMVCP(mockCtx));

            adjustFunction();

            expect(requestAdjustSpy).not.toHaveBeenCalled();
        });

        it("should handle invalid scrollingTo index", () => {
            setScrollingTo({ animated: true, index: 999, offset: 0 }); // Out of bounds

            const adjustFunction = expectAdjustFunction(prepareMVCP(mockCtx));

            adjustFunction();

            expect(requestAdjustSpy).not.toHaveBeenCalled();
        });

        it("should handle NaN position values", () => {
            const adjustFunction = expectAdjustFunction(prepareMVCP(mockCtx));

            setLayoutValue(mockState, "positions", "item-1", NaN);

            adjustFunction();

            expect(requestAdjustSpy).not.toHaveBeenCalled();
        });

        it("should handle Infinity position values", () => {
            const adjustFunction = expectAdjustFunction(prepareMVCP(mockCtx));

            setLayoutValue(mockState, "positions", "item-1", Infinity);

            adjustFunction();

            expect(requestAdjustSpy).toHaveBeenCalledWith(mockCtx, Infinity, undefined);
        });
    });

    describe("integration scenarios", () => {
        it("should keep prepend anchor locked across follow-up size recalculations", () => {
            withWebPlatform(() => {
                enableMvcpAnchorLock();

                mockState.idsInView = ["item-1", "item-2"];
                const adjustAfterDataChange = expectAdjustFunction(prepareMVCP(mockCtx, true));

                setLayoutValue(mockState, "positions", "item-1", 160);
                setLayoutValue(mockState, "positions", "item-2", 310);
                adjustAfterDataChange();

                mockState.idsInView = ["item-2"];
                setLayoutValue(mockState, "positions", "item-1", 170);
                setLayoutValue(mockState, "positions", "item-2", 330);

                const adjustAfterLayout = expectAdjustFunction(prepareMVCP(mockCtx));
                adjustAfterLayout();

                expect(requestAdjustSpy).toHaveBeenCalledTimes(2);
                expect(requestAdjustSpy).toHaveBeenNthCalledWith(1, mockCtx, 60, true);
                expect(requestAdjustSpy).toHaveBeenNthCalledWith(2, mockCtx, 10, undefined);
            });
        });

        it("should release locked prepend anchor after quiet passes", () => {
            withWebPlatform(() => {
                enableMvcpAnchorLock();
                mockState.mvcpAnchorLock = {
                    expiresAt: Date.now() + 500,
                    id: "item-1",
                    position: 100,
                    quietPasses: 0,
                };

                const adjust1 = expectAdjustFunction(prepareMVCP(mockCtx));
                adjust1();
                expect(mockState.mvcpAnchorLock?.quietPasses).toBe(1);

                const adjust2 = expectAdjustFunction(prepareMVCP(mockCtx));
                adjust2();
                expect(mockState.mvcpAnchorLock).toBeUndefined();
                expect(requestAdjustSpy).not.toHaveBeenCalled();
            });
        });

        it("should fallback to a visible anchor when locked anchor is removed on dataChanged", () => {
            withWebPlatform(() => {
                enableMvcpAnchorLock();
                mockState.mvcpAnchorLock = {
                    expiresAt: Date.now() + 500,
                    id: "item-1",
                    position: 100,
                    quietPasses: 0,
                };
                mockState.idsInView = ["item-1", "item-2"];

                const adjust = expectAdjustFunction(prepareMVCP(mockCtx, true));

                mockState.indexByKey.delete("item-1");
                mockState.positions[1] = undefined;
                mockState.positions[2] = 260;

                adjust();

                expect(requestAdjustSpy).toHaveBeenCalledWith(mockCtx, 10, true);
                expect(mockState.mvcpAnchorLock?.id).toBe("item-2");
            });
        });

        it("should fallback to a visible anchor when locked anchor is excluded by shouldRestorePosition", () => {
            withWebPlatform(() => {
                enableMvcpAnchorLock();
                mockState.props.maintainVisibleContentPosition = normalizeMaintainVisibleContentPosition({
                    data: true,
                    shouldRestorePosition: (item) => item.id !== 1,
                    size: false,
                });
                mockState.mvcpAnchorLock = {
                    expiresAt: Date.now() + 500,
                    id: "item-1",
                    position: 100,
                    quietPasses: 0,
                };
                mockState.idsInView = ["item-1", "item-2"];

                const adjust = expectAdjustFunction(prepareMVCP(mockCtx, true));

                setLayoutValue(mockState, "positions", "item-1", 170);
                setLayoutValue(mockState, "positions", "item-2", 260);
                adjust();

                expect(requestAdjustSpy).toHaveBeenCalledTimes(1);
                expect(requestAdjustSpy).toHaveBeenCalledWith(mockCtx, 10, true);
                expect(mockState.mvcpAnchorLock?.id).toBe("item-2");
            });
        });

        it("should handle rapid successive MVCP preparations", () => {
            // Prepare multiple MVCP functions
            const adjust1 = expectAdjustFunction(prepareMVCP(mockCtx));
            const adjust2 = expectAdjustFunction(prepareMVCP(mockCtx));
            const adjust3 = expectAdjustFunction(prepareMVCP(mockCtx));

            // Change position
            setLayoutValue(mockState, "positions", "item-1", 150);

            // Execute all adjustment functions
            adjust1();
            adjust2();
            adjust3();

            // All should detect the same change
            expect(requestAdjustSpy).toHaveBeenCalledTimes(3);
            expect(requestAdjustSpy).toHaveBeenCalledWith(mockCtx, 50, undefined);
        });

        it("should handle switching between scroll targets", () => {
            // First preparation with scroll target
            setScrollingTo({ animated: true, index: 2, offset: 0 });
            const adjust1 = expectAdjustFunction(prepareMVCP(mockCtx));

            // Change scroll target and prepare again
            setScrollingTo({ animated: true, index: 3, offset: 0 });
            const adjust2 = expectAdjustFunction(prepareMVCP(mockCtx));

            // Change positions
            setLayoutValue(mockState, "positions", "item-2", 300); // Original target
            setLayoutValue(mockState, "positions", "item-3", 500); // New target

            adjust1(); // Should track item-2
            adjust2(); // Should track item-3

            expect(requestAdjustSpy).toHaveBeenCalledTimes(2);
            expect(requestAdjustSpy).toHaveBeenNthCalledWith(1, mockCtx, 50, undefined); // item-2: 300-250
            expect(requestAdjustSpy).toHaveBeenNthCalledWith(2, mockCtx, 50, undefined); // item-3: 500-450
        });

        it("should handle changing from scrollingTo to visible items", () => {
            // First with scrollingTo
            setScrollingTo({ animated: true, index: 2, offset: 0 });
            const adjust1 = expectAdjustFunction(prepareMVCP(mockCtx));

            // Then without scrollingTo (falls back to visible items)
            setScrollingTo(undefined);
            const adjust2 = expectAdjustFunction(prepareMVCP(mockCtx));

            // Change positions
            setLayoutValue(mockState, "positions", "item-2", 300); // scroll target
            setLayoutValue(mockState, "positions", "item-1", 150); // first visible item

            adjust1(); // Should track item-2
            adjust2(); // Should track item-1

            expect(requestAdjustSpy).toHaveBeenCalledTimes(2);
            expect(requestAdjustSpy).toHaveBeenNthCalledWith(1, mockCtx, 50, undefined); // item-2
            expect(requestAdjustSpy).toHaveBeenNthCalledWith(2, mockCtx, 50, undefined); // item-1
        });
    });

    describe("performance considerations", () => {
        it("should handle large datasets efficiently", () => {
            // Create large dataset
            const largeIndexByKey = new Map();
            const largePositions: Array<number | undefined> = [];
            const largeIdsInView = [];

            for (let i = 0; i < 1000; i++) {
                const id = `item-${i}`;
                largeIndexByKey.set(id, i);
                largePositions[i] = i * 100;
                if (i < 10) largeIdsInView.push(id);
            }

            mockState.indexByKey = largeIndexByKey;
            mockState.positions = largePositions;
            mockState.idsInView = largeIdsInView;

            const start = performance.now();
            const adjustFunction = expectAdjustFunction(prepareMVCP(mockCtx));

            // Change first visible item position
            setLayoutValue(mockState, "positions", "item-0", 50);
            adjustFunction();

            const duration = performance.now() - start;

            expect(duration).toBeLessThan(500); // Allow headroom in slower CI while still enforcing reasonable perf
            expect(requestAdjustSpy).toHaveBeenCalledWith(mockCtx, 50, undefined);
        });

        it("should handle rapid MVCP execution", () => {
            // NOTE: Each call to prepareMVCP captures the current position, so we need
            // to prepare it fresh each time to test rapid execution properly
            const start = performance.now();

            // Execute many MVCP preparations and adjustments
            for (let i = 1; i <= 100; i++) {
                // Start from 1 to ensure meaningful position changes
                const adjustFunction = expectAdjustFunction(prepareMVCP(mockCtx));
                setLayoutValue(mockState, "positions", "item-1", 100 + i * 0.2); // Use 0.2 increments to ensure > 0.1 threshold
                adjustFunction();
            }

            const duration = performance.now() - start;

            expect(duration).toBeLessThan(300); // Still enforces performance without flaking in slower environments
            expect(requestAdjustSpy).toHaveBeenCalledTimes(100);
        });
    });

    describe("floating point precision", () => {
        it("should handle floating point precision correctly", () => {
            const adjustFunction = expectAdjustFunction(prepareMVCP(mockCtx));

            // Test borderline floating point case
            setLayoutValue(mockState, "positions", "item-1", 100.10000000001); // Just above 0.1 threshold

            adjustFunction();

            expect(requestAdjustSpy).toHaveBeenCalledTimes(1);
            const calls = requestAdjustSpy.mock.calls;
            expect(calls[0][0]).toBe(mockCtx);
            expect(Math.abs(calls[0][1] - 0.10000000001)).toBeLessThan(1e-10); // Very precise floating point comparison
        });

        it("should handle very small floating point differences", () => {
            const adjustFunction = expectAdjustFunction(prepareMVCP(mockCtx));

            setLayoutValue(mockState, "positions", "item-1", 100.0000001); // Very small change

            adjustFunction();

            expect(requestAdjustSpy).not.toHaveBeenCalled();
        });
    });
});
