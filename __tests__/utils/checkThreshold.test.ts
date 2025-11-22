import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import "../setup"; // Import global test setup

import { checkThreshold } from "../../src/utils/checkThreshold";
import * as checkThresholdModule from "../../src/utils/checkThreshold";

// CRITICAL: Ensure we're testing the real function, not a mock from other tests
function ensureRealFunction() {
    // Check if the function has been mocked by other tests
    const fn = checkThresholdModule.checkThreshold;
    if (fn && typeof fn === 'function' && 'mockRestore' in fn) {
        // Function is mocked, restore it
        (fn as any).mockRestore();
    }
}

describe("checkThreshold", () => {
    let activeTimers: NodeJS.Timeout[] = [];
    let originalSetTimeout: typeof setTimeout;

    beforeEach(() => {
        // CRITICAL: Ensure we're testing the real function
        ensureRealFunction();
        // Store original setTimeout in case other tests mocked it
        originalSetTimeout = globalThis.setTimeout;
        
        // Clear any active timers
        activeTimers.forEach((timer) => clearTimeout(timer));
        activeTimers = [];
    });

    afterEach(() => {
        // Clean up any timers that might still be running
        activeTimers.forEach((timer) => clearTimeout(timer));
        activeTimers = [];
        
        // Restore setTimeout if it was changed by other tests
        if (globalThis.setTimeout !== originalSetTimeout) {
            globalThis.setTimeout = originalSetTimeout;
        }
    });

    // Helper function to create mock callbacks
    function createMockCallbacks() {
        const onReachedCalls: number[] = [];
        const blockTimerCalls: boolean[] = [];

        const onReached = (distance: number) => onReachedCalls.push(distance);
        const blockTimer = (blocked: boolean) => blockTimerCalls.push(blocked);

        return { blockTimer, blockTimerCalls, onReached, onReachedCalls };
    }

    describe("threshold detection", () => {
        it("should trigger onReached when distance is within threshold", () => {
            const { onReached, blockTimer, onReachedCalls, blockTimerCalls } = createMockCallbacks();

            const result = checkThreshold(
                50, // distance
                false, // atThreshold
                100, // threshold
                false, // isReached
                false, // isBlockedByTimer
                onReached,
                blockTimer,
            );

            expect(result).toBe(true);
            expect(onReachedCalls).toEqual([50]);
            expect(blockTimerCalls).toEqual([true]);
        });

        it("should trigger onReached when explicitly at threshold", () => {
            const { onReached, blockTimer, onReachedCalls, blockTimerCalls } = createMockCallbacks();

            const result = checkThreshold(
                200, // distance (above threshold)
                true, // atThreshold (explicit override)
                100, // threshold
                false, // isReached
                false, // isBlockedByTimer
                onReached,
                blockTimer,
            );

            expect(result).toBe(true);
            expect(onReachedCalls).toEqual([200]);
            expect(blockTimerCalls).toEqual([true]);
        });

        it("should not trigger when distance exceeds threshold", () => {
            const { onReached, blockTimer, onReachedCalls, blockTimerCalls } = createMockCallbacks();

            const result = checkThreshold(
                150, // distance (above threshold)
                false, // atThreshold
                100, // threshold
                false, // isReached
                false, // isBlockedByTimer
                onReached,
                blockTimer,
            );

            expect(result).toBe(false);
            expect(onReachedCalls).toEqual([]);
            expect(blockTimerCalls).toEqual([]);
        });

        it("should handle negative distances using absolute value", () => {
            const { onReached, blockTimer, onReachedCalls, blockTimerCalls } = createMockCallbacks();

            const result = checkThreshold(
                -50, // negative distance
                false, // atThreshold
                100, // threshold
                false, // isReached
                false, // isBlockedByTimer
                onReached,
                blockTimer,
            );

            expect(result).toBe(true);
            expect(onReachedCalls).toEqual([-50]); // Original distance preserved
            expect(blockTimerCalls).toEqual([true]);
        });

        it("should handle zero distance", () => {
            const { onReached, blockTimer, onReachedCalls, blockTimerCalls } = createMockCallbacks();

            const result = checkThreshold(
                0, // zero distance
                false, // atThreshold
                100, // threshold
                false, // isReached
                false, // isBlockedByTimer
                onReached,
                blockTimer,
            );

            expect(result).toBe(true);
            expect(onReachedCalls).toEqual([0]);
            expect(blockTimerCalls).toEqual([true]);
        });
    });

    describe("state management", () => {
        it("should not trigger when already reached", () => {
            const { onReached, blockTimer, onReachedCalls, blockTimerCalls } = createMockCallbacks();

            const result = checkThreshold(
                50, // distance (within threshold)
                false, // atThreshold
                100, // threshold
                true, // isReached (already triggered)
                false, // isBlockedByTimer
                onReached,
                blockTimer,
            );

            expect(result).toBe(true); // Should maintain reached state
            expect(onReachedCalls).toEqual([]);
            expect(blockTimerCalls).toEqual([]);
        });

        it("should not trigger when blocked by timer", () => {
            const { onReached, blockTimer, onReachedCalls, blockTimerCalls } = createMockCallbacks();

            const result = checkThreshold(
                50, // distance (within threshold)
                false, // atThreshold
                100, // threshold
                false, // isReached
                true, // isBlockedByTimer (blocked)
                onReached,
                blockTimer,
            );

            expect(result).toBe(false); // Should maintain blocked state
            expect(onReachedCalls).toEqual([]);
            expect(blockTimerCalls).toEqual([]);
        });

        it("should not trigger when both reached and blocked", () => {
            const { onReached, blockTimer, onReachedCalls, blockTimerCalls } = createMockCallbacks();

            const result = checkThreshold(
                50, // distance (within threshold)
                false, // atThreshold
                100, // threshold
                true, // isReached
                true, // isBlockedByTimer
                onReached,
                blockTimer,
            );

            expect(result).toBe(true); // Should maintain reached state
            expect(onReachedCalls).toEqual([]);
            expect(blockTimerCalls).toEqual([]);
        });
    });

    describe("hysteresis and reset behavior", () => {
        it("should reset reached state when distance exceeds hysteresis threshold", () => {
            const { onReached, blockTimer, onReachedCalls, blockTimerCalls } = createMockCallbacks();

            const result = checkThreshold(
                150, // distance (1.5 * 100 = 150, exceeds 1.3 * 100 = 130)
                false, // atThreshold
                100, // threshold
                true, // isReached (was previously reached)
                false, // isBlockedByTimer
                onReached,
                blockTimer,
            );

            expect(result).toBe(false); // Should reset to false
            expect(onReachedCalls).toEqual([]);
            expect(blockTimerCalls).toEqual([]);
        });

        it("should maintain reached state when within hysteresis range", () => {
            const { onReached, blockTimer, onReachedCalls, blockTimerCalls } = createMockCallbacks();

            const result = checkThreshold(
                120, // distance (1.2 * 100 = 120, below 1.3 * 100 = 130)
                false, // atThreshold
                100, // threshold
                true, // isReached (was previously reached)
                false, // isBlockedByTimer
                onReached,
                blockTimer,
            );

            expect(result).toBe(true); // Should maintain reached state
            expect(onReachedCalls).toEqual([]);
            expect(blockTimerCalls).toEqual([]);
        });

        it("should handle exact hysteresis boundary", () => {
            const { onReached, blockTimer, onReachedCalls, blockTimerCalls } = createMockCallbacks();

            const result = checkThreshold(
                130, // distance (exactly 1.3 * 100 = 130)
                false, // atThreshold
                100, // threshold
                true, // isReached
                false, // isBlockedByTimer
                onReached,
                blockTimer,
            );

            expect(result).toBe(false); // Should reset (>= 1.3 * threshold)
        });
    });

    describe("timer functionality", () => {
        it("should set block timer and clear it after 700ms", async () => {
            const { onReached, blockTimer, onReachedCalls, blockTimerCalls } = createMockCallbacks();

            checkThreshold(
                50, // distance
                false, // atThreshold
                100, // threshold
                false, // isReached
                false, // isBlockedByTimer
                onReached,
                blockTimer,
            );

            expect(blockTimerCalls).toEqual([true]);

            // Wait for timer to complete
            await new Promise((resolve) => setTimeout(resolve, 750));

            expect(blockTimerCalls).toEqual([true, false]);
        });

        it("should handle multiple rapid triggers correctly", async () => {
            const { onReached, blockTimer, onReachedCalls, blockTimerCalls } = createMockCallbacks();

            // First trigger
            const result1 = checkThreshold(50, false, 100, false, false, onReached, blockTimer);
            expect(result1).toBe(true);
            expect(blockTimerCalls).toEqual([true]);

            // Wait a bit but not full timer duration
            await new Promise((resolve) => setTimeout(resolve, 300));

            // Second trigger (should not call because state management handles it)
            const result2 = checkThreshold(50, false, 100, true, true, onReached, blockTimer);
            expect(result2).toBe(true);
            expect(blockTimerCalls).toEqual([true]); // No additional calls

            // Wait for timer to complete
            await new Promise((resolve) => setTimeout(resolve, 500));
            expect(blockTimerCalls).toEqual([true, false]);
        });
    });

    describe("optional parameters", () => {
        it("should work without onReached callback", () => {
            const result = checkThreshold(
                50, // distance
                false, // atThreshold
                100, // threshold
                false, // isReached
                false, // isBlockedByTimer
                undefined, // onReached (undefined)
                undefined, // blockTimer (undefined)
            );

            expect(result).toBe(true);
            // Should not crash without callbacks
        });

        it("should work with only onReached callback", () => {
            const { onReached, onReachedCalls } = createMockCallbacks();

            const result = checkThreshold(
                50, // distance
                false, // atThreshold
                100, // threshold
                false, // isReached
                false, // isBlockedByTimer
                onReached,
                undefined, // blockTimer (undefined)
            );

            expect(result).toBe(true);
            expect(onReachedCalls).toEqual([50]);
        });

        it("should work with only blockTimer callback", () => {
            const { blockTimer, blockTimerCalls } = createMockCallbacks();

            const result = checkThreshold(
                50, // distance
                false, // atThreshold
                100, // threshold
                false, // isReached
                false, // isBlockedByTimer
                undefined, // onReached (undefined)
                blockTimer,
            );

            expect(result).toBe(true);
            expect(blockTimerCalls).toEqual([true]);
        });
    });

    describe("edge cases and error handling", () => {
        it("should handle zero threshold", () => {
            const { onReached, blockTimer, onReachedCalls, blockTimerCalls } = createMockCallbacks();

            const result = checkThreshold(
                0, // distance
                false, // atThreshold
                0, // threshold (zero)
                false, // isReached
                false, // isBlockedByTimer
                onReached,
                blockTimer,
            );

            // With zero threshold, abs(0) < 0 is false, so should not trigger
            expect(result).toBe(false);
            expect(onReachedCalls).toEqual([]);
        });

        it("should handle negative threshold", () => {
            const { onReached, blockTimer, onReachedCalls, blockTimerCalls } = createMockCallbacks();

            const result = checkThreshold(
                50, // distance
                false, // atThreshold
                -100, // threshold (negative)
                false, // isReached
                false, // isBlockedByTimer
                onReached,
                blockTimer,
            );

            // With negative threshold, abs(50) < -100 is false (50 < -100 is false)
            expect(result).toBe(false);
            expect(onReachedCalls).toEqual([]);
        });

        it("should handle very large distances", () => {
            const { onReached, blockTimer, onReachedCalls, blockTimerCalls } = createMockCallbacks();

            const result = checkThreshold(
                Number.MAX_SAFE_INTEGER, // very large distance
                false, // atThreshold
                100, // threshold
                false, // isReached
                false, // isBlockedByTimer
                onReached,
                blockTimer,
            );

            expect(result).toBe(false);
            expect(onReachedCalls).toEqual([]);
        });

        it("should handle very large thresholds", () => {
            const { onReached, blockTimer, onReachedCalls, blockTimerCalls } = createMockCallbacks();

            const result = checkThreshold(
                50, // distance
                false, // atThreshold
                Number.MAX_SAFE_INTEGER, // very large threshold
                false, // isReached
                false, // isBlockedByTimer
                onReached,
                blockTimer,
            );

            expect(result).toBe(true);
            expect(onReachedCalls).toEqual([50]);
        });

        it("should handle Infinity values", () => {
            const { onReached, blockTimer, onReachedCalls, blockTimerCalls } = createMockCallbacks();

            const result = checkThreshold(
                Number.POSITIVE_INFINITY, // infinite distance
                false, // atThreshold
                100, // threshold
                false, // isReached
                false, // isBlockedByTimer
                onReached,
                blockTimer,
            );

            expect(result).toBe(false);
            expect(onReachedCalls).toEqual([]);
        });

        it("should handle NaN values", () => {
            const { onReached, blockTimer, onReachedCalls, blockTimerCalls } = createMockCallbacks();

            const result = checkThreshold(
                NaN, // NaN distance
                false, // atThreshold
                100, // threshold
                false, // isReached
                false, // isBlockedByTimer
                onReached,
                blockTimer,
            );

            // NaN comparisons are always false, so should not trigger
            expect(result).toBe(false);
            expect(onReachedCalls).toEqual([]);
        });

        it("should handle callback throwing errors", () => {
            const blockTimerCalls: boolean[] = [];
            const blockTimer = (blocked: boolean) => blockTimerCalls.push(blocked);

            const onReached = () => {
                throw new Error("Callback error");
            };

            expect(() => {
                checkThreshold(
                    50, // distance
                    false, // atThreshold
                    100, // threshold
                    false, // isReached
                    false, // isBlockedByTimer
                    onReached,
                    blockTimer,
                );
            }).toThrow("Callback error");

            // If onReached throws, blockTimer might not be called, depending on order
            // Let's just test that the function handles the error correctly
        });
    });

    describe("performance and usage patterns", () => {
        it("should handle rapid consecutive calls efficiently", () => {
            const { onReached, blockTimer, onReachedCalls, blockTimerCalls } = createMockCallbacks();

            const start = Date.now();

            for (let i = 0; i < 1000; i++) {
                checkThreshold(
                    i % 200, // varying distances
                    false,
                    100,
                    false,
                    false,
                    onReached,
                    blockTimer,
                );
            }

            const duration = Date.now() - start;
            expect(duration).toBeLessThan(10); // Should be very fast

            // Should only trigger for distances < 100
            const expectedCalls = Array.from({ length: 1000 }, (_, i) => i % 200).filter((d) => d < 100).length;
            expect(onReachedCalls.length).toBe(expectedCalls);
        });

        it("should handle typical infinite scroll pattern", () => {
            const { onReached, blockTimer, onReachedCalls, blockTimerCalls } = createMockCallbacks();
            let isReached = false;
            let isBlocked = false;

            const updateBlock = (blocked: boolean) => {
                isBlocked = blocked;
            };

            // Simulate scroll getting close to end
            let result = checkThreshold(150, false, 100, isReached, isBlocked, onReached, updateBlock);
            expect(result).toBe(false); // Not reached yet
            isReached = result;

            // Scroll closer to end
            result = checkThreshold(80, false, 100, isReached, isBlocked, onReached, updateBlock);
            expect(result).toBe(true); // Should trigger
            isReached = result;
            expect(onReachedCalls.length).toBe(1);

            // More scrolling while blocked - need to actually set isBlocked = true
            result = checkThreshold(50, false, 100, isReached, true, onReached, updateBlock);
            expect(result).toBe(true); // Should maintain state
            expect(onReachedCalls.length).toBe(1); // No additional calls

            // User scrolls back up
            result = checkThreshold(150, false, 100, isReached, isBlocked, onReached, updateBlock);
            expect(result).toBe(false); // Should reset
            isReached = result;

            // Scroll back down - now isReached is false and isBlocked should be false
            result = checkThreshold(80, false, 100, false, false, onReached, updateBlock);
            expect(result).toBe(true); // Should trigger again
            expect(onReachedCalls.length).toBe(2);
        });

        it("should handle floating point distances correctly", () => {
            const { onReached, blockTimer, onReachedCalls, blockTimerCalls } = createMockCallbacks();

            const result = checkThreshold(
                99.9, // very close to threshold
                false,
                100.0, // threshold
                false,
                false,
                onReached,
                blockTimer,
            );

            expect(result).toBe(true);
            expect(onReachedCalls).toEqual([99.9]);
        });

        it("should handle hysteresis with floating point precision", () => {
            const { onReached, blockTimer, onReachedCalls, blockTimerCalls } = createMockCallbacks();

            // Test exactly at hysteresis boundary with floating point
            const threshold = 100.0;
            const hysteresis = 1.3 * threshold; // 130.0
            const distance = 130.00000001; // Just over hysteresis

            const result = checkThreshold(
                distance,
                false,
                threshold,
                true, // was previously reached
                false,
                onReached,
                blockTimer,
            );

            expect(result).toBe(false); // Should reset
        });
    });
});
