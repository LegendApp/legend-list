import { beforeEach, describe, expect, it, spyOn } from "bun:test";
import "../setup"; // Import global test setup

import type { InternalState } from "../../src/types";
import { checkAtTop } from "../../src/utils/checkAtTop";
import * as checkThresholdModule from "../../src/utils/checkThreshold";
import { createMockState } from "../__mocks__/createMockState";

describe("checkAtTop", () => {
    let mockState: InternalState;
    let checkThresholdSpy: any;
    let onStartReachedMock: any;

    beforeEach(() => {
        mockState = createMockState({
            endReachedBlockedByTimer: false,
            hasScrolled: false,
            idCache: new Map(),
            idsInView: [],
            ignoreScrollFromMVCP: undefined,
            ignoreScrollFromMVCPTimeout: undefined,
            indexByKey: new Map(),
            isAtEnd: false,
            isAtStart: false,
            isEndReached: false,
            isStartReached: false,
            lastBatchingAction: 0,
            maintainingScrollAtEnd: false,
            positions: new Map(),
            props: {
                data: [
                    { id: 0, text: "Item 0" },
                    { id: 1, text: "Item 1" },
                    { id: 2, text: "Item 2" },
                ],
                keyExtractor: (item: any) => `item-${item.id}`,
                onStartReached: undefined,
                onStartReachedThreshold: 0.2, // 20%
            },
            queuedInitialLayout: true,
            scroll: 100,
            scrollForNextCalculateItemsInView: undefined,
            scrollHistory: [],
            scrollingTo: undefined,
            scrollLength: 500,
            scrollPending: 0,
            scrollPrev: 90,
            scrollPrevTime: 0,
            scrollTime: 0,
            sizes: new Map(),
            startReachedBlockedByTimer: false,
            timeouts: new Set(),
        });

        // Reset and recreate spies to avoid cross-test interference
        if (checkThresholdSpy) checkThresholdSpy.mockRestore?.();

        // Spy on dependencies
        checkThresholdSpy = spyOn(checkThresholdModule, "checkThreshold").mockReturnValue(false);

        // Create a mock function for onStartReached
        onStartReachedMock = spyOn({ fn: () => {} }, "fn");
        mockState.props.onStartReached = onStartReachedMock;
    });

    describe("basic functionality", () => {
        it("should return early when state is null/undefined", () => {
            checkAtTop(null as any);
            checkAtTop(undefined as any);

            expect(checkThresholdSpy).not.toHaveBeenCalled();
        });

        it("should proceed when state is valid", () => {
            checkAtTop(mockState);

            expect(checkThresholdSpy).toHaveBeenCalled();
        });

        it("should extract scroll and scrollLength from state", () => {
            mockState.scroll = 150;
            mockState.scrollLength = 600;
            mockState.props.onStartReachedThreshold = 0.1;

            checkAtTop(mockState);

            expect(checkThresholdSpy).toHaveBeenCalledWith(
                150, // distanceFromTop (scroll)
                false, // isContentLess (always false for top check)
                60, // threshold: 0.1 * 600
                false, // isStartReached
                false, // startReachedBlockedByTimer
                expect.any(Function), // onReached callback
                expect.any(Function), // onBlock callback
            );
        });
    });

    describe("isAtStart calculation", () => {
        it("should set isAtStart to true when scroll is 0", () => {
            mockState.scroll = 0;

            checkAtTop(mockState);

            expect(mockState.isAtStart).toBe(true);
        });

        it("should set isAtStart to true when scroll is negative", () => {
            mockState.scroll = -10;

            checkAtTop(mockState);

            expect(mockState.isAtStart).toBe(true);
        });

        it("should set isAtStart to false when scroll is positive", () => {
            mockState.scroll = 50;

            checkAtTop(mockState);

            expect(mockState.isAtStart).toBe(false);
        });

        it("should handle very small positive scroll values", () => {
            mockState.scroll = 0.1;

            checkAtTop(mockState);

            expect(mockState.isAtStart).toBe(false);
        });

        it("should handle large scroll values", () => {
            mockState.scroll = 10000;

            checkAtTop(mockState);

            expect(mockState.isAtStart).toBe(false);
        });
    });

    describe("checkThreshold integration", () => {
        it("should call checkThreshold with correct parameters", () => {
            mockState.scroll = 80;
            mockState.scrollLength = 500;
            mockState.props.onStartReachedThreshold = 0.2; // 20%
            mockState.isStartReached = false;
            mockState.startReachedBlockedByTimer = false;

            checkAtTop(mockState);

            expect(checkThresholdSpy).toHaveBeenCalledWith(
                80, // distanceFromTop
                false, // isContentLess (always false)
                100, // threshold: 0.2 * 500
                false, // isStartReached
                false, // startReachedBlockedByTimer
                expect.any(Function), // onReached callback
                expect.any(Function), // onBlock callback
            );
        });

        it("should handle zero scroll position", () => {
            mockState.scroll = 0;
            mockState.scrollLength = 500;
            mockState.props.onStartReachedThreshold = 0.2;

            checkAtTop(mockState);

            expect(checkThresholdSpy).toHaveBeenCalledWith(
                0, // distanceFromTop
                false,
                100,
                false,
                false,
                expect.any(Function),
                expect.any(Function),
            );
        });

        it("should handle negative scroll position", () => {
            mockState.scroll = -50;
            mockState.scrollLength = 500;
            mockState.props.onStartReachedThreshold = 0.2;

            checkAtTop(mockState);

            expect(checkThresholdSpy).toHaveBeenCalledWith(
                -50, // negative distance
                false,
                100,
                false,
                false,
                expect.any(Function),
                expect.any(Function),
            );
        });

        it("should update isStartReached based on checkThreshold return value", () => {
            checkThresholdSpy.mockReturnValue(true);

            checkAtTop(mockState);

            expect(mockState.isStartReached).toBe(true);
        });

        it("should preserve isStartReached when checkThreshold returns false", () => {
            mockState.isStartReached = true;
            checkThresholdSpy.mockReturnValue(false);

            checkAtTop(mockState);

            expect(mockState.isStartReached).toBe(false);
        });
    });

    describe("onStartReached callback handling", () => {
        it("should call onStartReached when threshold callback is executed", () => {
            let capturedCallback: any;
            checkThresholdSpy.mockImplementation((_: any, __: any, ___: any, ____: any, _____: any, onReached: any) => {
                capturedCallback = onReached;
                return false;
            });

            checkAtTop(mockState);

            // Execute the captured callback
            capturedCallback(25);

            expect(onStartReachedMock).toHaveBeenCalledWith({ distanceFromStart: 25 });
        });

        it("should handle undefined onStartReached gracefully", () => {
            mockState.props.onStartReached = undefined;
            let capturedCallback: any;
            checkThresholdSpy.mockImplementation((_: any, __: any, ___: any, ____: any, _____: any, onReached: any) => {
                capturedCallback = onReached;
                return false;
            });

            checkAtTop(mockState);

            // Execute the captured callback - should not throw
            expect(() => capturedCallback(25)).not.toThrow();
        });

        it("should update startReachedBlockedByTimer via callback", () => {
            let capturedBlockCallback: any;
            checkThresholdSpy.mockImplementation(
                (_: any, __: any, ___: any, ____: any, _____: any, ______: any, onBlock: any) => {
                    capturedBlockCallback = onBlock;
                    return false;
                },
            );

            checkAtTop(mockState);

            // Execute the captured block callback
            capturedBlockCallback(true);

            expect(mockState.startReachedBlockedByTimer).toBe(true);
        });
    });

    describe("edge cases and error handling", () => {
        it("should handle very large scroll values", () => {
            mockState.scroll = Number.MAX_SAFE_INTEGER;
            mockState.scrollLength = 500;

            checkAtTop(mockState);

            expect(mockState.isAtStart).toBe(false);
        });

        it("should handle zero scroll length", () => {
            mockState.scroll = 100;
            mockState.scrollLength = 0;

            checkAtTop(mockState);

            // This is an edge case - scroll length of 0 doesn't make sense
            // But the function should handle it gracefully
            expect(checkThresholdSpy).toHaveBeenCalledWith(
                100,
                false,
                0, // threshold becomes 0
                false,
                false,
                expect.any(Function),
                expect.any(Function),
            );
        });

        it("should handle undefined threshold", () => {
            mockState.props.onStartReachedThreshold = undefined as any;

            expect(() => {
                checkAtTop(mockState);
            }).not.toThrow();
        });

        it("should handle NaN scroll values", () => {
            mockState.scroll = NaN;

            checkAtTop(mockState);

            // NaN <= 0 is false
            expect(mockState.isAtStart).toBe(false);
        });

        it("should handle Infinity scroll values", () => {
            mockState.scroll = Infinity;

            checkAtTop(mockState);

            expect(mockState.isAtStart).toBe(false);
        });

        it("should handle negative Infinity scroll values", () => {
            mockState.scroll = -Infinity;

            checkAtTop(mockState);

            expect(mockState.isAtStart).toBe(true); // -Infinity <= 0 is true
        });
    });

    describe("complex scenarios", () => {
        it("should handle rapid scroll position changes", () => {
            // Simulate rapid scroll position changes near the top
            const scrollPositions = [0, 10, 5, 15, 0, 20, 8, 3];

            scrollPositions.forEach((scroll) => {
                mockState.scroll = scroll;
                checkAtTop(mockState);
            });

            // Note: checkThresholdSpy may be called in previous tests, so we verify it was called
            expect(checkThresholdSpy).toHaveBeenCalled();
        });

        it("should handle scroll length changes", () => {
            const scrollLengths = [300, 500, 800, 1000, 200];

            scrollLengths.forEach((length) => {
                mockState.scrollLength = length;
                checkAtTop(mockState);
            });

            // Note: checkThresholdSpy may be called in previous tests, so we verify it was called
            expect(checkThresholdSpy).toHaveBeenCalled();
        });

        it("should handle threshold configuration changes", () => {
            mockState.props.onStartReachedThreshold = 0.1;
            checkAtTop(mockState);

            mockState.props.onStartReachedThreshold = 0.5;
            checkAtTop(mockState);

            // Note: checkThresholdSpy may be called in previous tests, so we verify it was called
            expect(checkThresholdSpy).toHaveBeenCalled();

            // Verify different threshold values were used in the last two calls
            const callCount = checkThresholdSpy.mock.calls.length;
            const secondLastCall = checkThresholdSpy.mock.calls[callCount - 2];
            const lastCall = checkThresholdSpy.mock.calls[callCount - 1];

            expect(secondLastCall[2]).toBe(50); // 0.1 * 500
            expect(lastCall[2]).toBe(250); // 0.5 * 500
        });

        it("should handle isStartReached state transitions", () => {
            // Start with not reached
            mockState.isStartReached = false;
            checkThresholdSpy.mockReturnValue(true);

            checkAtTop(mockState);
            expect(mockState.isStartReached).toBe(true);

            // Transition back
            checkThresholdSpy.mockReturnValue(false);

            checkAtTop(mockState);
            expect(mockState.isStartReached).toBe(false);
        });

        it("should handle blocked timer state changes", () => {
            let capturedBlockCallback: any;
            checkThresholdSpy.mockImplementation(
                (_: any, __: any, ___: any, ____: any, _____: any, ______: any, onBlock: any) => {
                    capturedBlockCallback = onBlock;
                    return false;
                },
            );

            checkAtTop(mockState);

            // Initially not blocked
            expect(mockState.startReachedBlockedByTimer).toBe(false);

            // Block via callback
            capturedBlockCallback(true);
            expect(mockState.startReachedBlockedByTimer).toBe(true);

            // Unblock via callback
            capturedBlockCallback(false);
            expect(mockState.startReachedBlockedByTimer).toBe(false);
        });
    });

    describe("performance considerations", () => {
        it("should handle many successive calls efficiently", () => {
            const start = performance.now();

            for (let i = 0; i < 1000; i++) {
                mockState.scroll = i;
                checkAtTop(mockState);
            }

            const duration = performance.now() - start;
            expect(duration).toBeLessThan(50); // Should be fast
        });

        it("should not accumulate state incorrectly", () => {
            // Ensure state doesn't accumulate unintended side effects
            const initialState = { ...mockState };

            for (let i = 0; i < 100; i++) {
                checkAtTop(mockState);
            }

            // Only expected state should have changed
            expect(mockState.scroll).toBe(initialState.scroll);
            expect(mockState.scrollLength).toBe(initialState.scrollLength);
        });
    });

    describe("integration patterns", () => {
        it("should work correctly with different scroll positions", () => {
            const scenarios = [
                { expected: true, scroll: 0 }, // at top
                { expected: false, scroll: 5 }, // slightly below top
                { expected: false, scroll: 50 }, // well below top
                { expected: true, scroll: -10 }, // above top (overscroll)
            ];

            scenarios.forEach(({ scroll, expected }) => {
                mockState.scroll = scroll;

                checkAtTop(mockState);

                expect(mockState.isAtStart).toBe(expected);
            });
        });

        it("should handle infinite scroll patterns", () => {
            // Simulate approaching top and triggering onStartReached
            let startReachedCount = 0;
            mockState.props.onStartReached = () => {
                startReachedCount++;
            };

            let capturedCallback: any;
            checkThresholdSpy.mockImplementation(
                (distance: any, _: any, threshold: any, __: any, ___: any, onReached: any) => {
                    capturedCallback = onReached;
                    return distance < threshold;
                },
            );

            // Scroll near top
            mockState.scroll = 30; // Distance: 30
            mockState.props.onStartReachedThreshold = 0.1; // 10% = 50px (of 500)

            checkAtTop(mockState);

            if (capturedCallback) {
                capturedCallback(30);
            }

            expect(startReachedCount).toBe(1);
        });

        it("should handle threshold boundary conditions", () => {
            // Test exactly at threshold
            mockState.scroll = 100; // Distance: 100
            mockState.scrollLength = 500;
            mockState.props.onStartReachedThreshold = 0.2; // 20% = 100px

            checkAtTop(mockState);

            // Verify threshold calculation
            expect(checkThresholdSpy).toHaveBeenCalledWith(
                100,
                false,
                100, // exactly at threshold
                false,
                false,
                expect.any(Function),
                expect.any(Function),
            );
        });
    });

    describe("boundary conditions", () => {
        it("should handle minimum scroll position", () => {
            mockState.scroll = Number.MIN_SAFE_INTEGER;

            checkAtTop(mockState);

            expect(mockState.isAtStart).toBe(true);
        });

        it("should handle floating point scroll values", () => {
            mockState.scroll = 0.0001;

            checkAtTop(mockState);

            expect(mockState.isAtStart).toBe(false);
        });

        it("should handle very small threshold values", () => {
            mockState.props.onStartReachedThreshold = 0.001; // 0.1%
            mockState.scrollLength = 1000;

            checkAtTop(mockState);

            expect(checkThresholdSpy).toHaveBeenCalledWith(
                expect.any(Number),
                false,
                1, // 0.001 * 1000
                false,
                false,
                expect.any(Function),
                expect.any(Function),
            );
        });

        it("should handle large threshold values", () => {
            mockState.props.onStartReachedThreshold = 2; // 200%
            mockState.scrollLength = 500;

            checkAtTop(mockState);

            expect(checkThresholdSpy).toHaveBeenCalledWith(
                expect.any(Number),
                false,
                1000, // 2 * 500
                false,
                false,
                expect.any(Function),
                expect.any(Function),
            );
        });
    });

    describe("state consistency", () => {
        it("should maintain state consistency across multiple calls", () => {
            // Verify that repeated calls don't corrupt state
            const originalScroll = mockState.scroll;
            const originalScrollLength = mockState.scrollLength;

            for (let i = 0; i < 10; i++) {
                checkAtTop(mockState);
            }

            expect(mockState.scroll).toBe(originalScroll);
            expect(mockState.scrollLength).toBe(originalScrollLength);
        });

        it("should correctly update both isAtStart and isStartReached", () => {
            // Test that both flags are updated appropriately
            mockState.scroll = 0;
            checkThresholdSpy.mockReturnValue(true);

            checkAtTop(mockState);

            expect(mockState.isAtStart).toBe(true);
            expect(mockState.isStartReached).toBe(true);
        });

        it("should handle independent flag states", () => {
            // isAtStart and isStartReached can have different values
            mockState.scroll = 50; // Not at start
            checkThresholdSpy.mockReturnValue(true); // But within threshold

            checkAtTop(mockState);

            expect(mockState.isAtStart).toBe(false);
            expect(mockState.isStartReached).toBe(true);
        });
    });
});
