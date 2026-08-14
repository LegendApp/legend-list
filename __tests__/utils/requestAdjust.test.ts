import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import "../setup"; // Import global test setup

import { Platform } from "../../src/platform/Platform";
import type { StateContext } from "../../src/state/state";
import type { InternalState } from "../../src/types.internal";
import { requestAdjust } from "../../src/utils/requestAdjust";
import { createMockContext } from "../__mocks__/createMockContext";

describe("requestAdjust", () => {
    let mockCtx: StateContext;
    let mockState: InternalState;
    let originalRAF: any;
    let originalSetTimeout: any;
    let originalClearTimeout: any;
    let rafCallbacks: (() => void)[];
    let timeoutCallbacks: Map<number, () => void>;
    let timeoutHandles: number;
    let scrollAdjustHandlerCalls: number[];

    beforeEach(() => {
        Platform.OS = "ios";

        scrollAdjustHandlerCalls = [];

        mockCtx = createMockContext(
            {
                readyToRender: true,
            },
            {
                didContainersLayout: true,
                didFinishInitialScroll: true,
                hasScrolled: false,
                props: {
                    keyExtractor: (item: any) => `item-${item.id}`,
                },
                scroll: 100,
                scrollAdjustHandler: {
                    getAdjust: () => 0,
                    requestAdjust: (value: number) => {
                        scrollAdjustHandlerCalls.push(value);
                    },
                } as any,
                scrollLength: 500,
                scrollPrev: 90,
            },
        );
        mockState = mockCtx.state;

        // Mock requestAnimationFrame
        originalRAF = globalThis.requestAnimationFrame;
        rafCallbacks = [];
        globalThis.requestAnimationFrame = (callback: (time: number) => void) => {
            rafCallbacks.push(callback as any);
            return rafCallbacks.length;
        };

        // Mock setTimeout and clearTimeout
        originalSetTimeout = globalThis.setTimeout;
        originalClearTimeout = globalThis.clearTimeout;
        timeoutCallbacks = new Map();
        timeoutHandles = 0;

        globalThis.setTimeout = ((callback: () => void, _delay: number) => {
            const handle = ++timeoutHandles;
            timeoutCallbacks.set(handle, callback);
            return handle;
        }) as any;

        globalThis.clearTimeout = ((handle: number) => {
            timeoutCallbacks.delete(handle);
        }) as any;
    });

    afterEach(() => {
        // Restore original functions
        globalThis.requestAnimationFrame = originalRAF;
        globalThis.setTimeout = originalSetTimeout;
        globalThis.clearTimeout = originalClearTimeout;
    });

    describe("threshold behavior", () => {
        it("should ignore small position differences (<=0.1)", () => {
            requestAdjust(mockCtx, 0.05);
            expect(scrollAdjustHandlerCalls).toHaveLength(0);
            expect(mockState.scroll).toBe(100); // Unchanged

            requestAdjust(mockCtx, -0.1);
            expect(scrollAdjustHandlerCalls).toHaveLength(0);
            expect(mockState.scroll).toBe(100); // Unchanged
        });

        it("should handle exactly 0.1 threshold", () => {
            requestAdjust(mockCtx, 0.1);
            expect(scrollAdjustHandlerCalls).toHaveLength(0);
            expect(mockState.scroll).toBe(100); // Unchanged
        });

        it("should trigger on position differences > 0.1", () => {
            requestAdjust(mockCtx, 0.11);
            expect(scrollAdjustHandlerCalls).toHaveLength(1);
            expect(scrollAdjustHandlerCalls[0]).toBe(0.11);
            expect(mockState.scroll).toBe(100.11);
        });

        it("should handle negative position differences > 0.1", () => {
            requestAdjust(mockCtx, -0.15);
            expect(scrollAdjustHandlerCalls).toHaveLength(1);
            expect(scrollAdjustHandlerCalls[0]).toBe(-0.15);
            expect(mockState.scroll).toBe(99.85);
        });

        it("should handle large position differences", () => {
            requestAdjust(mockCtx, 50);
            expect(scrollAdjustHandlerCalls).toHaveLength(1);
            expect(scrollAdjustHandlerCalls[0]).toBe(50);
            expect(mockState.scroll).toBe(150);
        });
    });

    describe("state updates", () => {
        it("should update scroll position", () => {
            const initialScroll = mockState.scroll;
            requestAdjust(mockCtx, 25);

            expect(mockState.scroll).toBe(initialScroll + 25);
        });

        it("should clear scrollForNextCalculateItemsInView", () => {
            mockState.scrollForNextCalculateItemsInView = { bottom: 200, top: 200 };

            requestAdjust(mockCtx, 25);

            expect(mockState.scrollForNextCalculateItemsInView).toBeUndefined();
        });

        it("should preserve other state properties", () => {
            const originalScrollPrev = mockState.scrollPrev;
            const originalScrollTime = mockState.scrollTime;

            requestAdjust(mockCtx, 25);

            expect(mockState.scrollPrev).toBe(originalScrollPrev);
            expect(mockState.scrollTime).toBe(originalScrollTime);
        });
    });

    describe("containers layout behavior", () => {
        it("should call scrollAdjustHandler immediately when containers laid out", () => {
            mockState.didContainersLayout = mockState.didFinishInitialScroll = true;
            mockCtx.values.set("readyToRender", mockState.didContainersLayout);

            requestAdjust(mockCtx, 25);

            expect(scrollAdjustHandlerCalls).toHaveLength(1);
            expect(scrollAdjustHandlerCalls[0]).toBe(25);
            expect(rafCallbacks).toHaveLength(0); // Should not use RAF
        });

        it("should use requestAnimationFrame when containers not laid out", () => {
            mockState.didContainersLayout = mockState.didFinishInitialScroll = true;
            mockCtx.values.set("readyToRender", false);

            requestAdjust(mockCtx, 25);

            expect(scrollAdjustHandlerCalls).toHaveLength(0); // Not called yet
            expect(rafCallbacks).toHaveLength(1);

            // Execute RAF callback
            rafCallbacks[0]();
            expect(scrollAdjustHandlerCalls).toHaveLength(1);
            expect(scrollAdjustHandlerCalls[0]).toBe(25);
        });

        it("should handle undefined readyToRender as falsy", () => {
            mockState.didContainersLayout = mockState.didFinishInitialScroll = true;
            mockCtx.values.delete("readyToRender");

            requestAdjust(mockCtx, 25);

            expect(rafCallbacks).toHaveLength(1);
            expect(scrollAdjustHandlerCalls).toHaveLength(0);
        });
    });

    describe("MVCP ignore logic", () => {
        const requestDataAdjust = (positionDiff: number) => requestAdjust(mockCtx, positionDiff, "data");

        it("should not ignore native scroll events for size-only adjustments", () => {
            requestAdjust(mockCtx, 20, "item-size");

            expect(mockState.scroll).toBe(120);
            expect(mockState.ignoreScrollFromMVCP).toBeUndefined();
            expect(mockState.scheduledWork.has("ignoreScrollFromMVCP")).toBe(false);
            expect(timeoutCallbacks).toHaveLength(0);
        });

        it("should preserve scroll-event suppression for adjustments without a source", () => {
            requestAdjust(mockCtx, 20);

            expect(mockState.ignoreScrollFromMVCP).toEqual({ lt: 110 });
            expect(mockState.scheduledWork.has("ignoreScrollFromMVCP")).toBe(true);
            expect(timeoutCallbacks).toHaveLength(1);
        });

        it("should not replace or extend an active data guard for an item-size adjustment", () => {
            requestDataAdjust(20);
            const guard = mockState.ignoreScrollFromMVCP;
            const timeoutHandle = Array.from(timeoutCallbacks.keys())[0];

            requestAdjust(mockCtx, 15, "item-size");

            expect(mockState.scroll).toBe(135);
            expect(mockState.ignoreScrollFromMVCP).toBe(guard);
            expect(mockState.ignoreScrollFromMVCP).toEqual({ lt: 110 });
            expect(Array.from(timeoutCallbacks.keys())).toEqual([timeoutHandle]);
        });

        it("should set up ignore threshold for positive adjustments", () => {
            requestDataAdjust(20);

            expect(mockState.ignoreScrollFromMVCP).toBeDefined();
            expect(mockState.ignoreScrollFromMVCP!.lt).toBe(110); // 120 - 20/2 = 110
            expect(mockState.ignoreScrollFromMVCP!.gt).toBeUndefined();
        });

        it("should set up ignore threshold for negative adjustments", () => {
            requestDataAdjust(-20);

            expect(mockState.ignoreScrollFromMVCP).toBeDefined();
            expect(mockState.ignoreScrollFromMVCP!.gt).toBe(90); // 80 - (-20)/2 = 90
            expect(mockState.ignoreScrollFromMVCP!.lt).toBeUndefined();
        });

        it("should create ignoreScrollFromMVCP object if it doesn't exist", () => {
            mockState.ignoreScrollFromMVCP = undefined;

            requestDataAdjust(15);

            expect(mockState.ignoreScrollFromMVCP).toBeDefined();
            expect(mockState.ignoreScrollFromMVCP!.lt).toBe(107.5); // 115 - 15/2
        });

        it("should update existing ignoreScrollFromMVCP object", () => {
            mockState.ignoreScrollFromMVCP = { gt: 50 };

            requestDataAdjust(10);

            expect(mockState.ignoreScrollFromMVCP!.gt).toBe(50); // Preserved
            expect(mockState.ignoreScrollFromMVCP!.lt).toBe(105); // 110 - 10/2
        });

        it("should set up timeout to clear ignore flags", () => {
            requestDataAdjust(20);

            expect(timeoutCallbacks.size).toBe(1);
            expect(mockState.scheduledWork.has("ignoreScrollFromMVCP")).toBe(true);

            // Execute timeout
            const callbacks = Array.from(timeoutCallbacks.values());
            callbacks[0]();

            expect(mockState.ignoreScrollFromMVCP).toBeUndefined();
            expect(mockState.ignoreScrollFromMVCPIgnored).toBe(false);
        });

        it("should rerun updateScroll when timeout clears ignore without processed scroll", () => {
            const reprocessCurrentScroll = spyOn(mockState, "reprocessCurrentScroll");

            try {
                requestDataAdjust(20);
                mockState.ignoreScrollFromMVCPIgnored = true;

                const callbacks = Array.from(timeoutCallbacks.values());
                expect(callbacks).toHaveLength(1);

                callbacks[0]();

                expect(reprocessCurrentScroll).toHaveBeenCalledTimes(1);
                expect(mockState.scrollPending).toBe(mockState.scroll);
                expect(mockState.ignoreScrollFromMVCPIgnored).toBe(false);
            } finally {
                reprocessCurrentScroll.mockRestore();
            }
        });

        it("should not rerun updateScroll if a follow-up scroll was processed", () => {
            const reprocessCurrentScroll = spyOn(mockState, "reprocessCurrentScroll");

            try {
                requestDataAdjust(20);

                mockState.ignoreScrollFromMVCPIgnored = false;

                const callbacks = Array.from(timeoutCallbacks.values());
                expect(callbacks).toHaveLength(1);

                callbacks[0]();

                expect(reprocessCurrentScroll).not.toHaveBeenCalled();
            } finally {
                reprocessCurrentScroll.mockRestore();
            }
        });

        it("should skip rerunning updateScroll when scroll processing is disabled", () => {
            const reprocessCurrentScroll = spyOn(mockState, "reprocessCurrentScroll");

            try {
                mockState.scrollProcessingEnabled = false as any;
                requestDataAdjust(20);

                const callbacks = Array.from(timeoutCallbacks.values());
                expect(callbacks).toHaveLength(1);

                callbacks[0]();

                expect(reprocessCurrentScroll).not.toHaveBeenCalled();
            } finally {
                reprocessCurrentScroll.mockRestore();
            }
        });

        it("should clear existing timeout before setting new one", () => {
            // First adjustment
            requestDataAdjust(20);
            const firstTimeout = Array.from(timeoutCallbacks.keys())[0];
            expect(timeoutCallbacks.size).toBe(1);

            // Second adjustment should clear first timeout
            requestDataAdjust(15);
            expect(mockState.scheduledWork.has("ignoreScrollFromMVCP")).toBe(true);
            expect(Array.from(timeoutCallbacks.keys())[0]).not.toBe(firstTimeout);
            expect(timeoutCallbacks.size).toBe(1); // Old one cleared, new one added
        });
    });

    describe("edge cases", () => {
        it("should handle zero position difference", () => {
            requestAdjust(mockCtx, 0);

            expect(scrollAdjustHandlerCalls).toHaveLength(0);
            expect(mockState.scroll).toBe(100);
            expect(mockState.ignoreScrollFromMVCP).toBeUndefined();
        });

        it("should handle very large adjustments", () => {
            const largeAdjustment = Number.MAX_SAFE_INTEGER;
            requestAdjust(mockCtx, largeAdjustment);

            expect(scrollAdjustHandlerCalls).toHaveLength(1);
            expect(scrollAdjustHandlerCalls[0]).toBe(largeAdjustment);
            expect(mockState.scroll).toBe(100 + largeAdjustment);
        });

        it("should handle NaN adjustments", () => {
            requestAdjust(mockCtx, NaN);

            // Math.abs(NaN) > 0.1 is false, so should not trigger
            expect(scrollAdjustHandlerCalls).toHaveLength(0);
            expect(mockState.scroll).toBe(100); // scroll should be unchanged since condition fails
        });

        it("should handle Infinity adjustments", () => {
            requestAdjust(mockCtx, Infinity);

            expect(scrollAdjustHandlerCalls).toHaveLength(1);
            expect(scrollAdjustHandlerCalls[0]).toBe(Infinity);
            expect(mockState.scroll).toBe(Infinity);
        });

        it("should handle missing scrollAdjustHandler", () => {
            mockState.scrollAdjustHandler = undefined as any;

            expect(() => {
                requestAdjust(mockCtx, 25);
            }).toThrow();
        });

        it("should handle floating point precision", () => {
            const preciseValue = 0.10000000001;
            requestAdjust(mockCtx, preciseValue);

            expect(scrollAdjustHandlerCalls).toHaveLength(1);
            expect(scrollAdjustHandlerCalls[0]).toBe(preciseValue);
            expect(mockState.scroll).toBeCloseTo(100 + preciseValue, 10);
        });
    });

    describe("complex scenarios", () => {
        it("should handle rapid successive adjustments", () => {
            const adjustments = [5, -2, 10, -1, 3];

            for (const adjustment of adjustments) {
                requestAdjust(mockCtx, adjustment);
            }

            expect(scrollAdjustHandlerCalls).toHaveLength(adjustments.length);

            // Verify final scroll position
            const expectedScroll = 100 + adjustments.reduce((sum, adj) => sum + adj, 0);
            expect(mockState.scroll).toBe(expectedScroll);
        });

        it("should handle mixed layout states", () => {
            // First call when not laid out
            mockState.didContainersLayout = mockState.didFinishInitialScroll = true;
            mockCtx.values.set("readyToRender", false);
            requestAdjust(mockCtx, 10);
            expect(rafCallbacks).toHaveLength(1);
            expect(scrollAdjustHandlerCalls).toHaveLength(0);

            // Second call when laid out
            mockState.didContainersLayout = mockState.didFinishInitialScroll = true;
            mockCtx.values.set("readyToRender", mockState.didContainersLayout);
            requestAdjust(mockCtx, 15);
            expect(scrollAdjustHandlerCalls).toHaveLength(1);
            expect(scrollAdjustHandlerCalls[0]).toBe(15);

            // Execute pending RAF
            rafCallbacks[0]();
            expect(scrollAdjustHandlerCalls).toHaveLength(2);
            expect(scrollAdjustHandlerCalls[1]).toBe(10);
        });

        it("should handle MVCP timeout interactions", () => {
            // First adjustment: scroll = 100 + 20 = 120, threshold = 120 - 20/2 = 110
            requestAdjust(mockCtx, 20, "data");
            expect(timeoutCallbacks.size).toBe(1);
            expect(mockState.scroll).toBe(120);
            expect(mockState.ignoreScrollFromMVCP!.lt).toBe(110);

            // Second adjustment: scroll = 120 + (-15) = 105, threshold = 105 - (-15)/2 = 112.5
            requestAdjust(mockCtx, -15, "data");
            expect(timeoutCallbacks.size).toBe(1); // Old cleared, new added
            expect(mockState.scroll).toBe(105);

            // Verify thresholds - negative adjustment sets gt, preserves lt
            expect(mockState.ignoreScrollFromMVCP!.gt).toBe(112.5); // 105 - (-15)/2
            expect(mockState.ignoreScrollFromMVCP!.lt).toBe(110); // Still present from first adjustment
        });

        it("should handle alternating positive and negative adjustments", () => {
            requestAdjust(mockCtx, 10, "data");
            expect(mockState.ignoreScrollFromMVCP!.lt).toBe(105); // 110 - 10/2

            requestAdjust(mockCtx, -8, "data");
            expect(mockState.ignoreScrollFromMVCP!.gt).toBe(106); // 102 - (-8)/2
            expect(mockState.ignoreScrollFromMVCP!.lt).toBe(105); // Still present

            requestAdjust(mockCtx, 12, "data");
            expect(mockState.ignoreScrollFromMVCP!.lt).toBe(108); // 114 - 12/2
            expect(mockState.ignoreScrollFromMVCP!.gt).toBe(106); // Still present
        });
    });

    describe("performance considerations", () => {
        it("should handle many adjustments efficiently", () => {
            const start = performance.now();

            for (let i = 0; i < 1000; i++) {
                requestAdjust(mockCtx, 1);
            }

            const duration = performance.now() - start;
            expect(duration).toBeLessThan(50); // Should be fast
            expect(scrollAdjustHandlerCalls).toHaveLength(1000);
        });

        it("should not accumulate memory with timeout creation", () => {
            // Create many adjustments to trigger many timeouts
            for (let i = 0; i < 100; i++) {
                requestAdjust(mockCtx, 1, "data");
            }

            // Should only have one timeout (previous ones cleared)
            expect(timeoutCallbacks.size).toBe(1);
        });

        it("should handle RAF efficiently when not laid out", () => {
            mockState.didContainersLayout = mockState.didFinishInitialScroll = true;
            mockCtx.values.set("readyToRender", false);

            const start = performance.now();

            for (let i = 0; i < 100; i++) {
                requestAdjust(mockCtx, 1);
            }

            const duration = performance.now() - start;
            expect(duration).toBeLessThan(10);
            expect(rafCallbacks).toHaveLength(100);
            expect(scrollAdjustHandlerCalls).toHaveLength(0); // None executed yet
        });
    });

    describe("boundary conditions", () => {
        it("should handle adjustment exactly at floating point precision limits", () => {
            const minPrecise = Number.EPSILON;
            requestAdjust(mockCtx, minPrecise);

            // Should not trigger since Number.EPSILON is much smaller than 0.1
            expect(scrollAdjustHandlerCalls).toHaveLength(0);
        });

        it("should handle adjustments near the threshold boundary", () => {
            requestAdjust(mockCtx, 0.100000001);
            expect(scrollAdjustHandlerCalls).toHaveLength(1);

            requestAdjust(mockCtx, 0.099999999);
            expect(scrollAdjustHandlerCalls).toHaveLength(1); // No additional call
        });

        it("should handle state corruption gracefully", () => {
            // Corrupt the state object
            delete (mockState as any).scroll;

            expect(() => {
                requestAdjust(mockCtx, 25);
            }).not.toThrow(); // Should handle gracefully
        });
    });

    describe("integration with timeout system", () => {
        it("should properly manage timeout lifecycle", () => {
            // Create timeout
            requestAdjust(mockCtx, 10, "data");
            const timeoutHandle = Array.from(timeoutCallbacks.keys())[0];
            expect(timeoutHandle).toBeDefined();
            expect(timeoutCallbacks.has(timeoutHandle)).toBe(true);

            // Clear and create new timeout
            requestAdjust(mockCtx, 15, "data");
            expect(mockState.scheduledWork.has("ignoreScrollFromMVCP")).toBe(true);
            expect(Array.from(timeoutCallbacks.keys())[0]).not.toBe(timeoutHandle);
            expect(timeoutCallbacks.has(timeoutHandle)).toBe(false); // Old one cleared

            // Execute the current timeout
            const currentCallback = Array.from(timeoutCallbacks.values())[0];
            currentCallback!();
            expect(mockState.ignoreScrollFromMVCP).toBeUndefined();
        });

        it("should handle timeout execution after state changes", () => {
            requestAdjust(mockCtx, 10, "data");
            const _originalIgnore = mockState.ignoreScrollFromMVCP;

            // Modify ignore flags manually
            mockState.ignoreScrollFromMVCP = { gt: 888, lt: 999 };

            // Execute timeout - should clear current state, not original
            const timeoutCallback = Array.from(timeoutCallbacks.values())[0];
            timeoutCallback();

            expect(mockState.ignoreScrollFromMVCP).toBeUndefined();
        });
    });
});
