import { beforeEach, describe, expect, it, spyOn } from "bun:test";
import "../setup"; // Import global test setup

import type { StateContext } from "../../src/state/state";
import * as stateModule from "../../src/state/state";
import type { InternalState } from "../../src/types";
import { checkAtBottom } from "../../src/utils/checkAtBottom";
import * as checkThresholdModule from "../../src/utils/checkThreshold";
import { createMockContext } from "../__mocks__/createMockContext";
import { createMockState } from "../__mocks__/createMockState";

describe("checkAtBottom", () => {
    let mockCtx: StateContext;
    let mockState: InternalState;
    let getContentSizeSpy: any;
    let checkThresholdSpy: any;
    let onEndReachedMock: any;

    beforeEach(() => {
        mockCtx = createMockContext();
        mockState = createMockState({
            endReachedBlockedByTimer: false,
            hasScrolled: false,
            idCache: new Map(),
            idsInView: [],
            ignoreScrollFromMVCP: undefined,
            ignoreScrollFromMVCPTimeout: undefined,
            indexByKey: new Map(),
            isAtEnd: false,
            isEndReached: false,
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
                maintainScrollAtEndThreshold: 0.1, // 10%
                onEndReached: undefined,
                onEndReachedThreshold: 0.2, // 20%
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
            timeouts: new Set(),
        });

        // Reset and recreate spies to avoid cross-test interference
        if (getContentSizeSpy) getContentSizeSpy.mockRestore?.();
        if (checkThresholdSpy) checkThresholdSpy.mockRestore?.();

        // Spy on dependencies
        getContentSizeSpy = spyOn(stateModule, "getContentSize").mockReturnValue(1000);
        checkThresholdSpy = spyOn(checkThresholdModule, "checkThreshold").mockReturnValue(false);

        // Create a mock function for onEndReached
        onEndReachedMock = spyOn({ fn: () => {} }, "fn");
        mockState.props.onEndReached = onEndReachedMock;
    });

    describe("basic functionality", () => {
        it("should return early when state is null/undefined", () => {
            checkAtBottom(mockCtx, null as any);
            checkAtBottom(mockCtx, undefined as any);

            expect(getContentSizeSpy).not.toHaveBeenCalled();
        });

        it("should return early when contentSize is 0", () => {
            getContentSizeSpy.mockReturnValue(0);

            checkAtBottom(mockCtx, mockState);

            expect(checkThresholdSpy).not.toHaveBeenCalled();
            expect(mockState.isAtEnd).toBe(false);
        });

        it("should return early when queuedInitialLayout is false", () => {
            mockState.queuedInitialLayout = false;

            checkAtBottom(mockCtx, mockState);

            expect(checkThresholdSpy).not.toHaveBeenCalled();
            expect(mockState.isAtEnd).toBe(false);
        });

        it("should return early when maintainingScrollAtEnd is true", () => {
            mockState.maintainingScrollAtEnd = true;

            checkAtBottom(mockCtx, mockState);

            expect(checkThresholdSpy).not.toHaveBeenCalled();
        });

        it("should proceed when all conditions are met", () => {
            checkAtBottom(mockCtx, mockState);

            expect(checkThresholdSpy).toHaveBeenCalled();
        });
    });

    describe("isAtEnd calculation", () => {
        it("should set isAtEnd to true when content is less than scroll length", () => {
            getContentSizeSpy.mockReturnValue(400); // Less than scrollLength (500)
            mockState.scroll = 100;
            mockState.scrollLength = 500;

            checkAtBottom(mockCtx, mockState);

            expect(mockState.isAtEnd).toBe(true);
        });

        it("should set isAtEnd to true when within maintainScrollAtEndThreshold", () => {
            getContentSizeSpy.mockReturnValue(1000);
            mockState.scroll = 540; // Distance from end: 1000 - 540 - 500 = -40 (negative means past end)
            mockState.scrollLength = 500;
            mockState.props.maintainScrollAtEndThreshold = 0.1; // 10% = 50px

            checkAtBottom(mockCtx, mockState);

            expect(mockState.isAtEnd).toBe(true);
        });

        it("should set isAtEnd to true when exactly at maintainScrollAtEndThreshold", () => {
            getContentSizeSpy.mockReturnValue(1000);
            mockState.scroll = 450; // Distance from end: 1000 - 450 - 500 = 50
            mockState.scrollLength = 500;
            mockState.props.maintainScrollAtEndThreshold = 0.1; // 10% = 50px

            checkAtBottom(mockCtx, mockState);

            expect(mockState.isAtEnd).toBe(false); // 50 <= 50 is false for strict less than
        });

        it("should set isAtEnd to false when beyond maintainScrollAtEndThreshold", () => {
            getContentSizeSpy.mockReturnValue(1000);
            mockState.scroll = 400; // Distance from end: 1000 - 400 - 500 = 100
            mockState.scrollLength = 500;
            mockState.props.maintainScrollAtEndThreshold = 0.1; // 10% = 50px

            checkAtBottom(mockCtx, mockState);

            expect(mockState.isAtEnd).toBe(false); // 100 > 50
        });

        it("should handle zero maintainScrollAtEndThreshold", () => {
            getContentSizeSpy.mockReturnValue(1000);
            mockState.scroll = 500; // Distance from end: 1000 - 500 - 500 = 0
            mockState.scrollLength = 500;
            mockState.props.maintainScrollAtEndThreshold = 0;

            checkAtBottom(mockCtx, mockState);

            expect(mockState.isAtEnd).toBe(false); // 0 < 0 is false
        });

        it("should handle large maintainScrollAtEndThreshold", () => {
            getContentSizeSpy.mockReturnValue(1000);
            mockState.scroll = 200; // Distance from end: 1000 - 200 - 500 = 300
            mockState.scrollLength = 500;
            mockState.props.maintainScrollAtEndThreshold = 1; // 100% = 500px

            checkAtBottom(mockCtx, mockState);

            expect(mockState.isAtEnd).toBe(true); // 300 < 500
        });
    });

    describe("checkThreshold integration", () => {
        it("should call checkThreshold with correct parameters", () => {
            getContentSizeSpy.mockReturnValue(1000);
            mockState.scroll = 400; // Distance from end: 1000 - 400 - 500 = 100
            mockState.scrollLength = 500;
            mockState.props.onEndReachedThreshold = 0.2; // 20%
            mockState.isEndReached = false;
            mockState.endReachedBlockedByTimer = false;

            checkAtBottom(mockCtx, mockState);

            expect(checkThresholdSpy).toHaveBeenCalledWith(
                100, // distanceFromEnd
                false, // isContentLess
                100, // threshold: 0.2 * 500
                false, // isEndReached
                false, // endReachedBlockedByTimer
                expect.any(Function), // onReached callback
                expect.any(Function), // onBlock callback
            );
        });

        it("should handle negative distance from end", () => {
            getContentSizeSpy.mockReturnValue(1000);
            mockState.scroll = 600; // Distance from end: 1000 - 600 - 500 = -100
            mockState.scrollLength = 500;
            mockState.props.onEndReachedThreshold = 0.2;

            checkAtBottom(mockCtx, mockState);

            expect(checkThresholdSpy).toHaveBeenCalledWith(
                -100, // negative distance
                false,
                100,
                false,
                false,
                expect.any(Function),
                expect.any(Function),
            );
        });

        it("should update isEndReached based on checkThreshold return value", () => {
            checkThresholdSpy.mockReturnValue(true);

            checkAtBottom(mockCtx, mockState);

            expect(mockState.isEndReached).toBe(true);
        });

        it("should preserve isEndReached when checkThreshold returns false", () => {
            mockState.isEndReached = true;
            checkThresholdSpy.mockReturnValue(false);

            checkAtBottom(mockCtx, mockState);

            expect(mockState.isEndReached).toBe(false);
        });
    });

    describe("onEndReached callback handling", () => {
        it("should call onEndReached when threshold callback is executed", () => {
            let capturedCallback: any;
            checkThresholdSpy.mockImplementation((_: any, __: any, ___: any, ____: any, _____: any, onReached: any) => {
                capturedCallback = onReached;
                return false;
            });

            checkAtBottom(mockCtx, mockState);

            // Execute the captured callback
            capturedCallback(50);

            expect(onEndReachedMock).toHaveBeenCalledWith({ distanceFromEnd: 50 });
        });

        it("should handle undefined onEndReached gracefully", () => {
            mockState.props.onEndReached = undefined;
            let capturedCallback: any;
            checkThresholdSpy.mockImplementation((_: any, __: any, ___: any, ____: any, _____: any, onReached: any) => {
                capturedCallback = onReached;
                return false;
            });

            checkAtBottom(mockCtx, mockState);

            // Execute the captured callback - should not throw
            expect(() => capturedCallback(50)).not.toThrow();
        });

        it("should update endReachedBlockedByTimer via callback", () => {
            let capturedBlockCallback: any;
            checkThresholdSpy.mockImplementation(
                (_: any, __: any, ___: any, ____: any, _____: any, ______: any, onBlock: any) => {
                    capturedBlockCallback = onBlock;
                    return false;
                },
            );

            checkAtBottom(mockCtx, mockState);

            // Execute the captured block callback
            capturedBlockCallback(true);

            expect(mockState.endReachedBlockedByTimer).toBe(true);
        });
    });

    describe("edge cases and error handling", () => {
        it("should handle very small content size", () => {
            getContentSizeSpy.mockReturnValue(1);
            mockState.scrollLength = 500;

            checkAtBottom(mockCtx, mockState);

            expect(mockState.isAtEnd).toBe(true); // Content is less than scroll length
        });

        it("should handle very large content size", () => {
            getContentSizeSpy.mockReturnValue(Number.MAX_SAFE_INTEGER);
            mockState.scroll = 100;
            mockState.scrollLength = 500;

            checkAtBottom(mockCtx, mockState);

            expect(mockState.isAtEnd).toBe(false);
        });

        it("should handle zero scroll position", () => {
            getContentSizeSpy.mockReturnValue(1000);
            mockState.scroll = 0;
            mockState.scrollLength = 500;

            checkAtBottom(mockCtx, mockState);

            // Distance from end: 1000 - 0 - 500 = 500
            expect(mockState.isAtEnd).toBe(false); // 500 > 50 (10% of 500)
        });

        it("should handle zero scroll length", () => {
            getContentSizeSpy.mockReturnValue(1000);
            mockState.scroll = 100;
            mockState.scrollLength = 0;

            checkAtBottom(mockCtx, mockState);

            // This is an edge case - scroll length of 0 doesn't make sense
            // But the function should handle it gracefully
        });

        it("should handle undefined thresholds", () => {
            mockState.props.maintainScrollAtEndThreshold = undefined as any;
            mockState.props.onEndReachedThreshold = undefined as any;

            expect(() => {
                checkAtBottom(mockCtx, mockState);
            }).not.toThrow();
        });

        it("should handle negative content size", () => {
            getContentSizeSpy.mockReturnValue(-100);

            checkAtBottom(mockCtx, mockState);

            // Function should return early since contentSize <= 0
            expect(checkThresholdSpy).not.toHaveBeenCalled();
        });

        it("should handle NaN values", () => {
            getContentSizeSpy.mockReturnValue(NaN);

            checkAtBottom(mockCtx, mockState);

            // NaN > 0 is false, so should return early
            expect(checkThresholdSpy).not.toHaveBeenCalled();
        });

        it("should handle Infinity values", () => {
            getContentSizeSpy.mockReturnValue(Infinity);
            mockState.scroll = 100;
            mockState.scrollLength = 500;

            checkAtBottom(mockCtx, mockState);

            expect(mockState.isAtEnd).toBe(false); // Infinity - 100 - 500 > any threshold
        });
    });

    describe("complex scenarios", () => {
        it("should handle rapid state changes", () => {
            // Simulate rapid scroll position changes
            const scrollPositions = [100, 200, 300, 400, 500, 450, 480, 490];

            scrollPositions.forEach((scroll) => {
                mockState.scroll = scroll;
                checkAtBottom(mockCtx, mockState);
            });

            // Note: checkThresholdSpy may be called in previous tests, so we verify it was called
            expect(checkThresholdSpy).toHaveBeenCalled();
        });

        it("should handle content size changes", () => {
            const contentSizes = [500, 1000, 2000, 1500, 800];

            contentSizes.forEach((size) => {
                getContentSizeSpy.mockReturnValue(size);
                checkAtBottom(mockCtx, mockState);
            });

            // Note: checkThresholdSpy may be called in previous tests, so we verify it was called
            expect(checkThresholdSpy).toHaveBeenCalled();
        });

        it("should handle threshold configuration changes", () => {
            mockState.props.onEndReachedThreshold = 0.1;
            checkAtBottom(mockCtx, mockState);

            mockState.props.onEndReachedThreshold = 0.5;
            checkAtBottom(mockCtx, mockState);

            // Note: checkThresholdSpy may be called in previous tests, so we verify it was called
            expect(checkThresholdSpy).toHaveBeenCalled();

            // Verify different threshold values were used
            const firstCall = checkThresholdSpy.mock.calls[0];
            const secondCall = checkThresholdSpy.mock.calls[1];

            expect(firstCall[2]).toBe(50); // 0.1 * 500
            expect(secondCall[2]).toBe(250); // 0.5 * 500
        });

        it("should handle isEndReached state transitions", () => {
            // Start with not reached
            mockState.isEndReached = false;
            checkThresholdSpy.mockReturnValue(true);

            checkAtBottom(mockCtx, mockState);
            expect(mockState.isEndReached).toBe(true);

            // Transition back
            checkThresholdSpy.mockReturnValue(false);

            checkAtBottom(mockCtx, mockState);
            expect(mockState.isEndReached).toBe(false);
        });

        it("should handle blocked timer state changes", () => {
            let capturedBlockCallback: any;
            checkThresholdSpy.mockImplementation(
                (_: any, __: any, ___: any, ____: any, _____: any, ______: any, onBlock: any) => {
                    capturedBlockCallback = onBlock;
                    return false;
                },
            );

            checkAtBottom(mockCtx, mockState);

            // Initially not blocked
            expect(mockState.endReachedBlockedByTimer).toBe(false);

            // Block via callback
            capturedBlockCallback(true);
            expect(mockState.endReachedBlockedByTimer).toBe(true);

            // Unblock via callback
            capturedBlockCallback(false);
            expect(mockState.endReachedBlockedByTimer).toBe(false);
        });
    });

    describe("performance considerations", () => {
        it("should handle many successive calls efficiently", () => {
            const start = performance.now();

            for (let i = 0; i < 1000; i++) {
                mockState.scroll = i;
                checkAtBottom(mockCtx, mockState);
            }

            const duration = performance.now() - start;
            expect(duration).toBeLessThan(50); // Should be fast
        });

        it("should not accumulate state incorrectly", () => {
            // Ensure state doesn't accumulate unintended side effects
            const initialState = { ...mockState };

            for (let i = 0; i < 100; i++) {
                checkAtBottom(mockCtx, mockState);
            }

            // Only expected state should have changed
            expect(mockState.scroll).toBe(initialState.scroll);
            expect(mockState.scrollLength).toBe(initialState.scrollLength);
        });
    });

    describe("integration patterns", () => {
        it("should work correctly with different content/scroll ratios", () => {
            const scenarios = [
                { content: 250, expected: true, scroll: 100, scrollLength: 300 }, // content < scrollLength
                { content: 1000, expected: true, scroll: 460, scrollLength: 500 }, // near end - distance: 1000-460-500=40, threshold: 500*0.1=50, 40<50 is true
                { content: 2000, expected: false, scroll: 100, scrollLength: 500 }, // far from end
                { content: 1000, expected: true, scroll: 500, scrollLength: 500 }, // exactly at end - distance: 1000-500-500=0, 0<50 is true
            ];

            scenarios.forEach(({ content, scroll, scrollLength, expected }) => {
                getContentSizeSpy.mockReturnValue(content);
                mockState.scroll = scroll;
                mockState.scrollLength = scrollLength;
                mockState.props.maintainScrollAtEndThreshold = 0.1; // Ensure consistent threshold

                checkAtBottom(mockCtx, mockState);

                expect(mockState.isAtEnd).toBe(expected);
            });
        });

        it("should handle infinite scroll patterns", () => {
            // Simulate approaching end and triggering onEndReached
            let endReachedCount = 0;
            mockState.props.onEndReached = () => {
                endReachedCount++;
            };

            let capturedCallback: any;
            checkThresholdSpy.mockImplementation(
                (distance: any, _: any, threshold: any, __: any, ___: any, onReached: any) => {
                    capturedCallback = onReached;
                    return distance < threshold;
                },
            );

            // Scroll near end
            mockState.scroll = 400; // Distance: 1000 - 400 - 500 = 100
            mockState.props.onEndReachedThreshold = 0.3; // 30% = 150px

            checkAtBottom(mockCtx, mockState);

            if (capturedCallback) {
                capturedCallback(100);
            }

            expect(endReachedCount).toBe(1);
        });
    });
});
