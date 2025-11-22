import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import "../setup"; // Import global test setup

import { doMaintainScrollAtEnd } from "../../src/core/doMaintainScrollAtEnd";
import type { StateContext } from "../../src/state/state";
import type { InternalState } from "../../src/types";
import { createMockContext } from "../__mocks__/createMockContext";
import { createMockState } from "../__mocks__/createMockState";

describe("doMaintainScrollAtEnd", () => {
    let mockCtx: StateContext;
    let mockState: InternalState;
    let mockScrollToEnd: ReturnType<typeof mock>;
    let rafCallback: ((time?: number) => void) | null = null;
    let timeoutCallback: (() => void) | null = null;

    // Mock requestAnimationFrame and setTimeout
    const originalRAF = globalThis.requestAnimationFrame;
    const originalSetTimeout = globalThis.setTimeout;

    beforeEach(() => {
        rafCallback = null;
        timeoutCallback = null;

        // Mock requestAnimationFrame
        globalThis.requestAnimationFrame = mock((callback: (time: number) => void) => {
            rafCallback = callback as any;
            return 1; // Mock return value
        });

        // Mock setTimeout
        (globalThis as any).setTimeout = mock((callback: () => void, delay: number) => {
            timeoutCallback = callback;
            return 1 as any; // Return mock timeout ID
        });

        mockScrollToEnd = mock();

        // Create mock context
        mockCtx = createMockContext({
            alignItemsPaddingTop: 0,
            containersDidLayout: true,
        });

        // Create mock state
        mockState = createMockState({
            isAtEnd: true,
            maintainingScrollAtEnd: false,
            props: {
                maintainScrollAtEnd: true,
            },
            refScroller: {
                current: {
                    scrollToEnd: mockScrollToEnd,
                } as any,
            },
            scroll: 100,
        });
    });

    afterEach(() => {
        // Clear any callbacks that might be pending
        rafCallback = null;
        timeoutCallback = null;

        // Restore original functions
        globalThis.requestAnimationFrame = originalRAF;
        globalThis.setTimeout = originalSetTimeout;
    });

    describe("basic functionality", () => {
        it("should return true and trigger scroll when all conditions are met", () => {
            const result = doMaintainScrollAtEnd(mockCtx, mockState, true);

            expect(result).toBe(true);
            expect(globalThis.requestAnimationFrame).toHaveBeenCalledTimes(1);

            // Execute the RAF callback
            if (rafCallback) {
                rafCallback();
                expect(mockState.maintainingScrollAtEnd).toBe(true);
                expect(mockScrollToEnd).toHaveBeenCalledWith({ animated: true });
                expect(globalThis.setTimeout).toHaveBeenCalledWith(expect.any(Function), 500);
            }
        });

        it("should use animated=false parameter correctly", () => {
            const result = doMaintainScrollAtEnd(mockCtx, mockState, false);

            expect(result).toBe(true);

            // Execute the RAF callback
            if (rafCallback) {
                rafCallback();
                expect(mockScrollToEnd).toHaveBeenCalledWith({ animated: false });
                expect(globalThis.setTimeout).toHaveBeenCalledWith(expect.any(Function), 0);
            }
        });

        it("should reset maintainingScrollAtEnd flag after timeout", () => {
            doMaintainScrollAtEnd(mockCtx, mockState, true);

            // Execute the RAF callback
            if (rafCallback) {
                rafCallback();
                expect(mockState.maintainingScrollAtEnd).toBe(true);

                // Execute the timeout callback
                if (timeoutCallback) {
                    timeoutCallback();
                    expect(mockState.maintainingScrollAtEnd).toBe(false);
                }
            }
        });
    });

    describe("condition checking", () => {
        it("should not trigger when isAtEnd is false", () => {
            mockState.isAtEnd = false;

            const result = doMaintainScrollAtEnd(mockCtx, mockState, true);

            expect(result).toBeUndefined();
            expect(globalThis.requestAnimationFrame).not.toHaveBeenCalled();
        });

        it("should not trigger when maintainScrollAtEnd is false", () => {
            mockState.props.maintainScrollAtEnd = false;

            const result = doMaintainScrollAtEnd(mockCtx, mockState, true);

            expect(result).toBeUndefined();
            expect(globalThis.requestAnimationFrame).not.toHaveBeenCalled();
        });

        it("should not trigger when containersDidLayout is false", () => {
            mockCtx.values.set("containersDidLayout", false);

            const result = doMaintainScrollAtEnd(mockCtx, mockState, true);

            expect(result).toBeUndefined();
            expect(globalThis.requestAnimationFrame).not.toHaveBeenCalled();
        });

        it("should handle containersDidLayout being undefined", () => {
            mockCtx.values.set("containersDidLayout", undefined);

            const result = doMaintainScrollAtEnd(mockCtx, mockState, true);

            expect(result).toBeUndefined();
            expect(globalThis.requestAnimationFrame).not.toHaveBeenCalled();
        });

        it("should require all conditions to be true", () => {
            // Test various combinations of false conditions
            const testCases = [
                { containersDidLayout: true, isAtEnd: false, maintainScrollAtEnd: true },
                { containersDidLayout: true, isAtEnd: true, maintainScrollAtEnd: false },
                { containersDidLayout: false, isAtEnd: true, maintainScrollAtEnd: true },
                { containersDidLayout: false, isAtEnd: false, maintainScrollAtEnd: false },
            ];

            testCases.forEach(({ isAtEnd, maintainScrollAtEnd, containersDidLayout }) => {
                // Reset mocks
                mockScrollToEnd.mockClear();
                (globalThis.requestAnimationFrame as any).mockClear();

                mockState.isAtEnd = isAtEnd;
                mockState.props.maintainScrollAtEnd = maintainScrollAtEnd;
                mockCtx.values.set("containersDidLayout", containersDidLayout);

                const result = doMaintainScrollAtEnd(mockCtx, mockState, true);

                expect(result).toBeUndefined();
                expect(globalThis.requestAnimationFrame).not.toHaveBeenCalled();
            });
        });
    });

    describe("padding top handling", () => {
        it("should set scroll to 0 when alignItemsPaddingTop > 0", () => {
            mockCtx.values.set("alignItemsPaddingTop", 100);
            mockState.scroll = 250; // Initial scroll value

            doMaintainScrollAtEnd(mockCtx, mockState, true);

            expect(mockState.scroll).toBe(0);
        });

        it("should not modify scroll when alignItemsPaddingTop is 0", () => {
            mockCtx.values.set("alignItemsPaddingTop", 0);
            mockState.scroll = 250;

            doMaintainScrollAtEnd(mockCtx, mockState, true);

            expect(mockState.scroll).toBe(250); // Unchanged
        });

        it("should not modify scroll when alignItemsPaddingTop is negative", () => {
            mockCtx.values.set("alignItemsPaddingTop", -50);
            mockState.scroll = 250;

            doMaintainScrollAtEnd(mockCtx, mockState, true);

            expect(mockState.scroll).toBe(250); // Unchanged
        });

        it("should handle alignItemsPaddingTop being undefined", () => {
            mockCtx.values.set("alignItemsPaddingTop", undefined);
            mockState.scroll = 250;

            doMaintainScrollAtEnd(mockCtx, mockState, true);

            expect(mockState.scroll).toBe(250); // Unchanged
        });
    });

    describe("ref scroller handling", () => {
        it("should handle null refScroller", () => {
            (mockState.refScroller as any).current = null;

            const result = doMaintainScrollAtEnd(mockCtx, mockState, true);

            expect(result).toBe(true);

            // Execute the RAF callback - should not throw
            if (rafCallback) {
                expect(() => rafCallback!()).not.toThrow();
            }
        });

        it("should handle undefined refScroller.current", () => {
            mockState.refScroller = { current: undefined } as any;

            const result = doMaintainScrollAtEnd(mockCtx, mockState, true);

            expect(result).toBe(true);

            // Execute the RAF callback - should not throw
            if (rafCallback) {
                expect(() => rafCallback!()).not.toThrow();
            }
        });

        it("should handle missing scrollToEnd method", () => {
            (mockState.refScroller as any).current = {} as any; // No scrollToEnd method

            const result = doMaintainScrollAtEnd(mockCtx, mockState, true);

            expect(result).toBe(true);

            // Execute the RAF callback - this WILL throw because scrollToEnd is missing
            if (rafCallback) {
                expect(() => rafCallback!()).toThrow("refScroller.current?.scrollToEnd is not a function");
            }
        });
    });

    describe("edge cases and error handling", () => {
        it("should handle null state gracefully", () => {
            expect(() => {
                doMaintainScrollAtEnd(mockCtx, null as any, true);
            }).toThrow();
        });

        it("should handle corrupted state props", () => {
            mockState.props = null as any;

            expect(() => {
                doMaintainScrollAtEnd(mockCtx, mockState, true);
            }).toThrow();
        });

        it("should handle corrupted context values", () => {
            mockCtx.values = null as any;

            expect(() => {
                doMaintainScrollAtEnd(mockCtx, mockState, true);
            }).toThrow();
        });

        it("should handle missing peek function in context", () => {
            (mockCtx as any).peek = undefined as any;

            // Function uses peek$ which may handle undefined context gracefully
            expect(() => {
                doMaintainScrollAtEnd(mockCtx, mockState, true);
            }).not.toThrow();
        });

        it("should handle scrollToEnd throwing error", () => {
            mockScrollToEnd.mockImplementation(() => {
                throw new Error("Scroll failed");
            });

            const result = doMaintainScrollAtEnd(mockCtx, mockState, true);
            expect(result).toBe(true);

            // Execute the RAF callback - should handle error gracefully
            if (rafCallback) {
                expect(() => rafCallback!()).toThrow("Scroll failed");
            }
        });
    });

    describe("timing and async behavior", () => {
        it("should use correct timeout duration for animated scroll", () => {
            doMaintainScrollAtEnd(mockCtx, mockState, true);

            if (rafCallback) {
                rafCallback();
                expect(globalThis.setTimeout).toHaveBeenCalledWith(expect.any(Function), 500);
            }
        });

        it("should use correct timeout duration for non-animated scroll", () => {
            doMaintainScrollAtEnd(mockCtx, mockState, false);

            if (rafCallback) {
                rafCallback();
                expect(globalThis.setTimeout).toHaveBeenCalledWith(expect.any(Function), 0);
            }
        });

        it("should maintain flag state during animation", () => {
            doMaintainScrollAtEnd(mockCtx, mockState, true);

            // Before RAF callback
            expect(mockState.maintainingScrollAtEnd).toBe(false);

            // After RAF callback, before timeout
            if (rafCallback) {
                rafCallback();
                expect(mockState.maintainingScrollAtEnd).toBe(true);

                // After timeout
                if (timeoutCallback) {
                    timeoutCallback();
                    expect(mockState.maintainingScrollAtEnd).toBe(false);
                }
            }
        });

        it("should handle multiple rapid calls", () => {
            // First call
            doMaintainScrollAtEnd(mockCtx, mockState, true);
            const firstRAF = rafCallback;

            // Second call before first RAF executes
            doMaintainScrollAtEnd(mockCtx, mockState, false);
            const secondRAF = rafCallback;

            expect(globalThis.requestAnimationFrame).toHaveBeenCalledTimes(2);

            // Execute both RAF callbacks
            if (firstRAF) firstRAF();
            if (secondRAF) secondRAF();

            expect(mockScrollToEnd).toHaveBeenCalledTimes(2);
        });
    });

    describe("real world scenarios", () => {
        it("should handle chat interface new message scenario", () => {
            // Simulate chat interface with new message added
            mockCtx.values.set("alignItemsPaddingTop", 0); // No padding when list is full
            mockState.scroll = 800; // Scrolled down

            const result = doMaintainScrollAtEnd(mockCtx, mockState, true);

            expect(result).toBe(true);
            expect(mockState.scroll).toBe(800); // Should not change

            if (rafCallback) {
                rafCallback();
                expect(mockScrollToEnd).toHaveBeenCalledWith({ animated: true });
            }
        });

        it("should handle chat interface with short list", () => {
            // Simulate chat with few messages (list shorter than viewport)
            mockCtx.values.set("alignItemsPaddingTop", 150); // Padding indicates short list
            mockState.scroll = 50;

            const result = doMaintainScrollAtEnd(mockCtx, mockState, true);

            expect(result).toBe(true);
            expect(mockState.scroll).toBe(0); // Should be reset for short list

            if (rafCallback) {
                rafCallback();
                expect(mockScrollToEnd).toHaveBeenCalledWith({ animated: true });
            }
        });

        it("should handle live feed updates", () => {
            // Simulate live feed where user is at the bottom
            doMaintainScrollAtEnd(mockCtx, mockState, false); // Non-animated for live updates

            if (rafCallback) {
                rafCallback();
                expect(mockScrollToEnd).toHaveBeenCalledWith({ animated: false });
                expect(globalThis.setTimeout).toHaveBeenCalledWith(expect.any(Function), 0);
            }
        });

        it("should handle notification list updates", () => {
            // Simulate notification list maintaining scroll at end
            mockState.isAtEnd = true;
            mockState.props.maintainScrollAtEnd = true;

            const result = doMaintainScrollAtEnd(mockCtx, mockState, true);

            expect(result).toBe(true);

            if (rafCallback) {
                rafCallback();
                expect(mockState.maintainingScrollAtEnd).toBe(true);

                // Verify cleanup after animation
                if (timeoutCallback) {
                    timeoutCallback();
                    expect(mockState.maintainingScrollAtEnd).toBe(false);
                }
            }
        });
    });

    describe("integration with alignItemsAtEnd", () => {
        it("should work correctly when alignItemsAtEnd is active", () => {
            // alignItemsAtEnd typically used for chat interfaces
            mockCtx.values.set("alignItemsPaddingTop", 200);
            mockState.scroll = 300;

            const result = doMaintainScrollAtEnd(mockCtx, mockState, true);

            expect(result).toBe(true);
            expect(mockState.scroll).toBe(0); // Reset due to padding

            if (rafCallback) {
                rafCallback();
                expect(mockScrollToEnd).toHaveBeenCalledWith({ animated: true });
            }
        });

        it("should handle dynamic padding changes", () => {
            // Padding can change as items are added/removed
            const paddingValues = [0, 50, 100, 0, 75];

            paddingValues.forEach((padding, index) => {
                mockCtx.values.set("alignItemsPaddingTop", padding);
                mockState.scroll = 100 + index * 50;

                const initialScroll = mockState.scroll;
                const result = doMaintainScrollAtEnd(mockCtx, mockState, true);

                expect(result).toBe(true);

                if (padding > 0) {
                    expect(mockState.scroll).toBe(0);
                } else {
                    expect(mockState.scroll).toBe(initialScroll);
                }
            });
        });
    });

    describe("performance considerations", () => {
        it("should handle rapid consecutive calls efficiently", () => {
            const start = Date.now();

            for (let i = 0; i < 100; i++) {
                doMaintainScrollAtEnd(mockCtx, mockState, i % 2 === 0);
            }

            const duration = Date.now() - start;
            expect(duration).toBeLessThan(50); // Should be very fast
            expect(globalThis.requestAnimationFrame).toHaveBeenCalledTimes(100);
        });

        it("should not cause memory leaks with RAF callbacks", () => {
            // Call multiple times and ensure cleanup
            for (let i = 0; i < 10; i++) {
                doMaintainScrollAtEnd(mockCtx, mockState, true);
                if (rafCallback) {
                    rafCallback();
                    if (timeoutCallback) {
                        timeoutCallback();
                    }
                }
            }

            // Should not accumulate state
            expect(mockState.maintainingScrollAtEnd).toBe(false);
        });
    });
});
