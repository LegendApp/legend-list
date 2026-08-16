import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import "../setup"; // Import global test setup

import { doMaintainScrollAtEnd } from "../../src/core/doMaintainScrollAtEnd";
import { getScrollRequestTracker } from "../../src/core/scrollRequestTracker";
import * as scrollToEndModule from "../../src/core/scrollToEnd";
import { updateContentMetricsState } from "../../src/core/updateContentMetricsState";
import type { StateContext } from "../../src/state/state";
import type { InternalState } from "../../src/types.internal";
import { checkAtBottom } from "../../src/utils/checkAtBottom";
import { createMockContext } from "../__mocks__/createMockContext";

describe("doMaintainScrollAtEnd", () => {
    let mockCtx: StateContext;
    let mockState: InternalState;
    let mockRunTrackedScrollToEnd: ReturnType<typeof mock>;
    let scrollToEndSpy: ReturnType<typeof spyOn>;
    let pendingScrollResolves: Array<() => void> = [];
    let rafCallback: ((time?: number) => void) | null = null;

    const originalRAF = globalThis.requestAnimationFrame;

    beforeEach(() => {
        rafCallback = null;
        pendingScrollResolves = [];

        globalThis.requestAnimationFrame = mock((callback: (time: number) => void) => {
            rafCallback = callback as any;
            return 1;
        });

        scrollToEndSpy = spyOn(scrollToEndModule, "scrollToEnd").mockReturnValue(true);
        mockRunTrackedScrollToEnd = mock((run: () => boolean) => {
            run();
            return new Promise<void>((resolve) => {
                pendingScrollResolves.push(resolve);
            });
        });

        // Create mock context
        mockCtx = createMockContext(
            {
                readyToRender: true,
                totalSize: 1000,
            },
            {
                didContainersLayout: true,
                didFinishInitialScroll: true,
                isWithinMaintainScrollAtEndThreshold: true,
                props: {
                    maintainScrollAtEnd: true,
                },
                scroll: 100,
            },
        );
        mockCtx.scrollToEnd = (options) => scrollToEndModule.scrollToEnd(mockCtx, options);
        getScrollRequestTracker(mockCtx).runNowIfIdle = mockRunTrackedScrollToEnd;

        mockState = mockCtx.state;
    });

    afterEach(() => {
        rafCallback = null;
        pendingScrollResolves = [];

        globalThis.requestAnimationFrame = originalRAF;
        scrollToEndSpy.mockRestore();
    });

    const runMaintainScrollAtEnd = (animated = false) => {
        mockState.props.maintainScrollAtEnd = animated ? { animated: true } : true;
        return doMaintainScrollAtEnd(mockCtx);
    };

    const finishNextImperativeScroll = async () => {
        const resolve = pendingScrollResolves.shift();
        expect(resolve).toBeDefined();
        resolve?.();
        await Promise.resolve();
    };

    describe("basic functionality", () => {
        it("should return true and trigger a non-animated scroll by default", () => {
            const result = doMaintainScrollAtEnd(mockCtx);

            expect(result).toBe(true);
            expect(globalThis.requestAnimationFrame).toHaveBeenCalledTimes(1);

            // Execute the RAF callback
            if (rafCallback) {
                rafCallback();
                expect(mockState.maintainingScrollAtEnd).toBe("instant");
                expect(scrollToEndSpy).toHaveBeenCalledWith(mockCtx, { animated: false });
            }
        });

        it("should use animated=true from maintainScrollAtEnd options", () => {
            mockState.props.maintainScrollAtEnd = { animated: true };

            const result = doMaintainScrollAtEnd(mockCtx);

            expect(result).toBe(true);

            // Execute the RAF callback
            if (rafCallback) {
                rafCallback();
                expect(scrollToEndSpy).toHaveBeenCalledWith(mockCtx, { animated: true });
            }
        });

        it("should use animated=false from maintainScrollAtEnd options", () => {
            mockState.props.maintainScrollAtEnd = { animated: false };

            const result = doMaintainScrollAtEnd(mockCtx);

            expect(result).toBe(true);

            if (rafCallback) {
                rafCallback();
                expect(scrollToEndSpy).toHaveBeenCalledWith(mockCtx, { animated: false });
            }
        });

        it("should reset maintainingScrollAtEnd after the imperative scroll resolves", async () => {
            runMaintainScrollAtEnd(true);

            // Execute the RAF callback
            if (rafCallback) {
                rafCallback();
                expect(mockState.maintainingScrollAtEnd).toBe("animated");

                await finishNextImperativeScroll();
                expect(mockState.maintainingScrollAtEnd).toBeUndefined();
            }
        });
    });

    describe("condition checking", () => {
        it("should not trigger when isWithinMaintainScrollAtEndThreshold is false", () => {
            mockState.isWithinMaintainScrollAtEndThreshold = false;

            const result = doMaintainScrollAtEnd(mockCtx);

            expect(result).toBe(false);
            expect(globalThis.requestAnimationFrame).not.toHaveBeenCalled();
        });

        it("should not trigger when maintainScrollAtEnd is false", () => {
            mockState.props.maintainScrollAtEnd = false;

            const result = doMaintainScrollAtEnd(mockCtx);

            expect(result).toBe(false);
            expect(globalThis.requestAnimationFrame).not.toHaveBeenCalled();
        });

        it("should not trigger when didContainersLayout is false", () => {
            mockState.didContainersLayout = false;
            mockCtx.values.set("readyToRender", false);

            const result = doMaintainScrollAtEnd(mockCtx);

            expect(result).toBe(false);
            expect(globalThis.requestAnimationFrame).not.toHaveBeenCalled();
            expect(mockState.pendingMaintainScrollAtEnd).toBe(true);
        });

        it("should not supersede an unfinished initial scroll", () => {
            mockState.didFinishInitialScroll = false;

            const result = doMaintainScrollAtEnd(mockCtx);

            expect(result).toBe(false);
            expect(globalThis.requestAnimationFrame).not.toHaveBeenCalled();
            expect(mockRunTrackedScrollToEnd).not.toHaveBeenCalled();
        });

        it("should handle didContainersLayout being undefined", () => {
            mockState.didContainersLayout = mockState.didFinishInitialScroll = undefined;
            mockCtx.values.set("readyToRender", undefined);

            const result = doMaintainScrollAtEnd(mockCtx);

            expect(result).toBe(false);
            expect(globalThis.requestAnimationFrame).not.toHaveBeenCalled();
        });

        it("should not trigger while a native mvcp remainder is still pending", () => {
            mockState.pendingNativeMVCPAdjust = {
                amount: -40,
                furthestProgressTowardAmount: 0,
                manualApplied: 0,
                startScroll: 100,
            };

            const result = doMaintainScrollAtEnd(mockCtx);

            expect(result).toBe(false);
            expect(mockState.pendingMaintainScrollAtEnd).toBe(true);
            expect(globalThis.requestAnimationFrame).not.toHaveBeenCalled();
        });

        it("does not queue a replay when maintainScrollAtEnd conditions are not met", () => {
            mockState.isWithinMaintainScrollAtEndThreshold = false;
            mockState.pendingNativeMVCPAdjust = {
                amount: -40,
                furthestProgressTowardAmount: 0,
                manualApplied: 0,
                startScroll: 100,
            };

            const result = doMaintainScrollAtEnd(mockCtx);

            expect(result).toBe(false);
            expect(mockState.pendingMaintainScrollAtEnd).toBe(false);
        });

        it("should require all conditions to be true", () => {
            // Test various combinations of false conditions
            const testCases = [
                { didContainersLayout: true, isWithinMaintainScrollAtEndThreshold: false, maintainScrollAtEnd: true },
                { didContainersLayout: true, isWithinMaintainScrollAtEndThreshold: true, maintainScrollAtEnd: false },
                { didContainersLayout: false, isWithinMaintainScrollAtEndThreshold: true, maintainScrollAtEnd: true },
                { didContainersLayout: false, isWithinMaintainScrollAtEndThreshold: false, maintainScrollAtEnd: false },
            ];

            testCases.forEach(({ isWithinMaintainScrollAtEndThreshold, maintainScrollAtEnd, didContainersLayout }) => {
                // Reset mocks
                mockRunTrackedScrollToEnd.mockClear();
                (globalThis.requestAnimationFrame as any).mockClear();

                mockState.isWithinMaintainScrollAtEndThreshold = isWithinMaintainScrollAtEndThreshold;
                mockState.props.maintainScrollAtEnd = maintainScrollAtEnd;
                mockState.didContainersLayout = mockState.didFinishInitialScroll = didContainersLayout;
                mockCtx.values.set("readyToRender", didContainersLayout);

                const result = doMaintainScrollAtEnd(mockCtx);

                expect(result).toBe(false);
                expect(globalThis.requestAnimationFrame).not.toHaveBeenCalled();
            });
        });
    });

    describe("content size handling", () => {
        it("should set scroll to 0 when content fits within the viewport", () => {
            mockCtx.values.set("totalSize", 100);
            mockState.scrollLength = 300;
            mockState.scroll = 250; // Initial scroll value

            runMaintainScrollAtEnd(true);

            expect(mockState.scroll).toBe(0);
        });

        it("should not modify scroll when content exceeds the viewport", () => {
            mockCtx.values.set("totalSize", 500);
            mockState.scrollLength = 300;
            mockState.scroll = 250;

            runMaintainScrollAtEnd(true);

            expect(mockState.scroll).toBe(250); // Unchanged
        });

        it("should not modify scroll when content equals the viewport", () => {
            mockCtx.values.set("totalSize", 300);
            mockState.scrollLength = 300;
            mockState.scroll = 250;

            runMaintainScrollAtEnd(true);

            expect(mockState.scroll).toBe(250); // Unchanged
        });
    });

    describe("rtl horizontal behavior", () => {
        it("uses the shared imperative scroll-to-end path", () => {
            mockState.props.horizontal = true;
            mockState.props.rtl = true;
            mockState.props.maintainScrollAtEnd = { animated: false };
            mockState.horizontalRTLScrollType = "inverted";
            mockState.scrollLength = 300;
            mockCtx.values.set("totalSize", 1000);

            const result = doMaintainScrollAtEnd(mockCtx);

            expect(result).toBe(true);

            if (rafCallback) {
                rafCallback();
            }

            expect(scrollToEndSpy).toHaveBeenCalledWith(mockCtx, { animated: false });
        });
    });

    describe("edge cases and error handling", () => {
        it("should handle null state gracefully", () => {
            const prevState = mockCtx.state;
            mockCtx.state = null as any;

            expect(() => {
                doMaintainScrollAtEnd(mockCtx);
            }).toThrow();

            mockCtx.state = prevState;
        });

        it("should handle corrupted state props", () => {
            mockState.props = null as any;

            expect(() => {
                doMaintainScrollAtEnd(mockCtx);
            }).toThrow();
        });

        it("should handle corrupted context values", () => {
            mockCtx.values = null as any;

            expect(() => {
                doMaintainScrollAtEnd(mockCtx);
            }).toThrow();
        });

        it("should handle missing peek function in context", () => {
            (mockCtx as any).peek = undefined as any;

            // Function should not depend on a peek-like helper being present on the context.
            expect(() => {
                doMaintainScrollAtEnd(mockCtx);
            }).not.toThrow();
        });

        it("should handle the tracked scroll runner throwing an error", () => {
            mockRunTrackedScrollToEnd.mockImplementation(() => {
                throw new Error("Scroll failed");
            });

            const result = runMaintainScrollAtEnd(true);
            expect(result).toBe(true);

            // Execute the RAF callback - should handle error gracefully
            if (rafCallback) {
                expect(() => rafCallback!()).toThrow("Scroll failed");
            }
        });
    });

    describe("timing and async behavior", () => {
        it("waits for an animated imperative scroll to resolve", async () => {
            runMaintainScrollAtEnd(true);
            rafCallback?.();

            expect(mockState.maintainingScrollAtEnd).toBe("animated");
            await finishNextImperativeScroll();
            expect(mockState.maintainingScrollAtEnd).toBeUndefined();
        });

        it("waits for a non-animated imperative scroll to resolve", async () => {
            runMaintainScrollAtEnd(false);
            rafCallback?.();

            expect(mockState.maintainingScrollAtEnd).toBe("instant");
            await finishNextImperativeScroll();
            expect(mockState.maintainingScrollAtEnd).toBeUndefined();
        });

        it("should maintain flag state during animation", async () => {
            runMaintainScrollAtEnd(true);

            // Before RAF callback
            expect(mockState.maintainingScrollAtEnd).toBe("pending-animated");

            // After RAF callback, before imperative completion
            if (rafCallback) {
                rafCallback();
                expect(mockState.maintainingScrollAtEnd).toBe("animated");

                await finishNextImperativeScroll();
                expect(mockState.maintainingScrollAtEnd).toBeUndefined();
            }
        });

        it("should coalesce multiple rapid calls", () => {
            const firstResult = runMaintainScrollAtEnd(true);

            // Second call before first RAF executes
            const secondResult = runMaintainScrollAtEnd(false);

            expect(firstResult).toBe(true);
            expect(secondResult).toBe(true);
            expect(globalThis.requestAnimationFrame).toHaveBeenCalledTimes(1);

            if (rafCallback) rafCallback();

            expect(mockRunTrackedScrollToEnd).toHaveBeenCalledTimes(1);
            expect(scrollToEndSpy).toHaveBeenCalledWith(mockCtx, { animated: true });
        });

        it("cancels coalesced maintain requests when the scroll position changes away from the end", () => {
            const result = runMaintainScrollAtEnd(false);

            expect(result).toBe(true);

            runMaintainScrollAtEnd(false);
            expect(mockState.pendingMaintainScrollAtEnd).toBe(true);

            mockState.scroll = 50;
            mockState.isWithinMaintainScrollAtEndThreshold = false;
            rafCallback?.();

            expect(mockRunTrackedScrollToEnd).not.toHaveBeenCalled();
            expect(mockState.maintainingScrollAtEnd).toBeUndefined();
            expect(mockState.pendingMaintainScrollAtEnd).toBe(false);
        });

        it("replays a maintain request that arrives while an instant maintain is active", async () => {
            const firstResult = runMaintainScrollAtEnd(false);

            expect(firstResult).toBe(true);
            expect(globalThis.requestAnimationFrame).toHaveBeenCalledTimes(1);

            if (rafCallback) {
                rafCallback();
            }

            expect(mockState.maintainingScrollAtEnd).toBe("instant");
            expect(mockRunTrackedScrollToEnd).toHaveBeenCalledTimes(1);

            const secondResult = runMaintainScrollAtEnd(false);

            expect(secondResult).toBe(true);
            expect(mockState.pendingMaintainScrollAtEnd).toBe(true);
            expect(globalThis.requestAnimationFrame).toHaveBeenCalledTimes(1);

            await finishNextImperativeScroll();

            expect(mockState.pendingMaintainScrollAtEnd).toBe(false);
            expect(mockState.maintainingScrollAtEnd).toBe("pending-instant");
            expect(globalThis.requestAnimationFrame).toHaveBeenCalledTimes(2);

            if (rafCallback) {
                rafCallback();
            }

            expect(mockRunTrackedScrollToEnd).toHaveBeenCalledTimes(2);
        });

        it("replays active maintenance after rapid content growth", async () => {
            mockState.queuedInitialLayout = true;
            runMaintainScrollAtEnd(true);
            rafCallback?.();

            mockCtx.values.set("totalSize", 1200);
            checkAtBottom(mockCtx);
            runMaintainScrollAtEnd(true);

            expect(mockState.isWithinMaintainScrollAtEndThreshold).toBe(true);
            expect(mockState.pendingMaintainScrollAtEnd).toBe(true);

            await finishNextImperativeScroll();

            expect(mockState.isWithinMaintainScrollAtEndThreshold).toBe(true);
            expect(mockState.maintainingScrollAtEnd).toBe("pending-animated");
            expect(mockState.pendingMaintainScrollAtEnd).toBe(false);
            expect(mockRunTrackedScrollToEnd).toHaveBeenCalledTimes(1);
            expect(globalThis.requestAnimationFrame).toHaveBeenCalledTimes(2);
        });

        it("does not cancel a replay because the prior animation emits a final scroll event", async () => {
            runMaintainScrollAtEnd(true);
            rafCallback?.();

            runMaintainScrollAtEnd(true);
            await finishNextImperativeScroll();

            expect(mockState.maintainingScrollAtEnd).toBe("pending-animated");

            mockState.scroll += 0.67;
            mockState.isWithinMaintainScrollAtEndThreshold = false;
            rafCallback?.();

            expect(mockState.maintainingScrollAtEnd).toBe("animated");
            expect(mockRunTrackedScrollToEnd).toHaveBeenCalledTimes(2);
        });
    });

    describe("real world scenarios", () => {
        it("should handle chat interface new message scenario", () => {
            // Simulate chat interface with new message added
            mockCtx.values.set("totalSize", 1200); // Content larger than viewport
            mockState.scrollLength = 300;
            mockState.scroll = 800; // Scrolled down

            const result = runMaintainScrollAtEnd(true);

            expect(result).toBe(true);
            expect(mockState.scroll).toBe(800); // Should not change

            if (rafCallback) {
                rafCallback();
                expect(scrollToEndSpy).toHaveBeenCalledWith(mockCtx, { animated: true });
            }
        });

        it("should handle chat interface with short list", () => {
            // Simulate chat with few messages (list shorter than viewport)
            mockCtx.values.set("totalSize", 120);
            mockState.scrollLength = 600;
            mockState.scroll = 50;

            const result = runMaintainScrollAtEnd(true);

            expect(result).toBe(true);
            expect(mockState.scroll).toBe(0); // Should be reset for short list

            if (rafCallback) {
                rafCallback();
                expect(scrollToEndSpy).toHaveBeenCalledWith(mockCtx, { animated: true });
            }
        });

        it("should handle live feed updates", () => {
            // Simulate live feed where user is at the bottom
            runMaintainScrollAtEnd(false); // Non-animated for live updates

            if (rafCallback) {
                rafCallback();
                expect(scrollToEndSpy).toHaveBeenCalledWith(mockCtx, { animated: false });
            }
        });

        it("should handle notification list updates", async () => {
            // Simulate notification list maintaining scroll at end
            mockState.isWithinMaintainScrollAtEndThreshold = true;

            const result = runMaintainScrollAtEnd(true);

            expect(result).toBe(true);

            if (rafCallback) {
                rafCallback();
                expect(mockState.maintainingScrollAtEnd).toBe("animated");

                await finishNextImperativeScroll();
                expect(mockState.maintainingScrollAtEnd).toBeUndefined();
            }
        });
    });

    describe("integration with alignItemsAtEnd", () => {
        it("should work correctly when alignItemsAtEnd is active", () => {
            // alignItemsAtEnd typically used for chat interfaces
            mockCtx.values.set("totalSize", 150);
            mockState.scrollLength = 400;
            mockState.scroll = 300;

            const result = runMaintainScrollAtEnd(true);

            expect(result).toBe(true);
            expect(mockState.scroll).toBe(0); // Reset for short content

            if (rafCallback) {
                rafCallback();
                expect(scrollToEndSpy).toHaveBeenCalledWith(mockCtx, { animated: true });
            }
        });

        it("should handle dynamic content size changes", async () => {
            // Content size can change as items are added/removed
            const contentSizes = [600, 250, 100, 600, 300];
            mockState.scrollLength = 400;

            for (const [index, size] of contentSizes.entries()) {
                mockCtx.values.set("totalSize", size);
                mockState.scroll = 100 + index * 50;

                const initialScroll = mockState.scroll;
                const result = runMaintainScrollAtEnd(true);

                expect(result).toBe(true);

                if (size < mockState.scrollLength) {
                    expect(mockState.scroll).toBe(0);
                } else {
                    expect(mockState.scroll).toBe(initialScroll);
                }

                if (rafCallback) {
                    rafCallback();
                }
                await finishNextImperativeScroll();
            }
        });

        it("keeps shrinking end-alignment padding as scroll range until the animation finishes", async () => {
            const requestAdjust = mock();
            const triggerCalculateItemsInView = mock();
            mockState.props.alignItemsAtEnd = true;
            mockState.props.alignItemsAtEndPaddingEnabled = true;
            mockState.props.data = [{}];
            mockState.props.maintainScrollAtEnd = { animated: true };
            mockState.scrollAdjustHandler.requestAdjust = requestAdjust;
            mockState.triggerCalculateItemsInView = triggerCalculateItemsInView;
            mockState.scrollLength = 400;
            mockCtx.values.set("totalSize", 150);
            updateContentMetricsState(mockCtx);
            expect(mockCtx.values.get("alignItemsAtEndPadding")).toBe(250);

            mockCtx.values.set("totalSize", 200);
            updateContentMetricsState(mockCtx);
            doMaintainScrollAtEnd(mockCtx);

            expect(mockCtx.values.get("alignItemsAtEndPadding")).toBe(250);
            rafCallback?.();
            expect(scrollToEndSpy).toHaveBeenCalledWith(mockCtx, { animated: true });

            mockState.scroll = 50;
            await finishNextImperativeScroll();

            expect(mockCtx.values.get("alignItemsAtEndPadding")).toBe(200);
            expect(mockState.scroll).toBe(0);
            expect(triggerCalculateItemsInView).toHaveBeenCalledWith({ forceFullItemPositions: true });
            expect(requestAdjust).toHaveBeenCalledWith(-50);
        });

        it("normalizes to the natural end offset when content grows beyond the viewport", async () => {
            const requestAdjust = mock();
            mockState.props.alignItemsAtEnd = true;
            mockState.props.alignItemsAtEndPaddingEnabled = true;
            mockState.props.data = [{}];
            mockState.props.maintainScrollAtEnd = { animated: true };
            mockState.scrollAdjustHandler.requestAdjust = requestAdjust;
            mockState.scrollLength = 400;
            mockCtx.values.set("totalSize", 150);
            updateContentMetricsState(mockCtx);

            mockCtx.values.set("totalSize", 450);
            updateContentMetricsState(mockCtx);
            doMaintainScrollAtEnd(mockCtx);
            rafCallback?.();
            mockState.scroll = 300;
            await finishNextImperativeScroll();

            expect(mockCtx.values.get("alignItemsAtEndPadding")).toBe(0);
            expect(mockState.scroll).toBe(50);
            expect(requestAdjust).toHaveBeenCalledWith(-250);
        });

        it("retains the runway across coalesced content growth", async () => {
            mockState.props.alignItemsAtEnd = true;
            mockState.props.alignItemsAtEndPaddingEnabled = true;
            mockState.props.data = [{}];
            mockState.props.maintainScrollAtEnd = { animated: true };
            mockState.scrollLength = 400;
            mockCtx.values.set("totalSize", 150);
            updateContentMetricsState(mockCtx);

            mockCtx.values.set("totalSize", 200);
            updateContentMetricsState(mockCtx);
            doMaintainScrollAtEnd(mockCtx);
            rafCallback?.();

            mockCtx.values.set("totalSize", 240);
            updateContentMetricsState(mockCtx);
            doMaintainScrollAtEnd(mockCtx);
            expect(mockCtx.values.get("alignItemsAtEndPadding")).toBe(250);

            await finishNextImperativeScroll();
            expect(mockCtx.values.get("alignItemsAtEndPadding")).toBe(250);
            rafCallback?.();
            mockState.scroll = 90;
            await finishNextImperativeScroll();

            expect(mockCtx.values.get("alignItemsAtEndPadding")).toBe(160);
            expect(mockState.scroll).toBe(0);
        });
    });

    describe("performance considerations", () => {
        it("should handle rapid consecutive calls efficiently", () => {
            const start = Date.now();

            for (let i = 0; i < 100; i++) {
                runMaintainScrollAtEnd(i % 2 === 0);
            }

            const duration = Date.now() - start;
            expect(duration).toBeLessThan(50); // Should be very fast
            expect(globalThis.requestAnimationFrame).toHaveBeenCalledTimes(1);
        });

        it("should not cause memory leaks with RAF callbacks", async () => {
            // Call multiple times and ensure cleanup
            for (let i = 0; i < 10; i++) {
                runMaintainScrollAtEnd(true);
                if (rafCallback) {
                    rafCallback();
                    await finishNextImperativeScroll();
                }
            }

            // Should not accumulate state
            expect(mockState.maintainingScrollAtEnd).toBeUndefined();
        });
    });
});
