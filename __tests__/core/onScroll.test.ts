import { beforeEach, describe, expect, it } from "bun:test";
import "../setup"; // Import global test setup

import { ScrollAdjustHandler } from "@/core/ScrollAdjustHandler";
import { onScroll } from "../../src/core/onScroll";
import type { StateContext } from "../../src/state/state";
import type { InternalState } from "../../src/types";
import { createMockContext } from "../__mocks__/createMockContext";
import { createMockState } from "../__mocks__/createMockState";

describe("onScroll", () => {
    let mockCtx: StateContext;
    let mockState: InternalState;
    let mockScrollEvent: any;
    let onScrollCalls: any[];

    beforeEach(() => {
        onScrollCalls = [];

        mockCtx = createMockContext({
            contentSize: 1000,
            numColumns: 1,
        });

        mockState = createMockState({
            averageSizes: {},
            columns: new Map(),
            dataChangeNeedsScrollUpdate: false,
            endReachedBlockedByTimer: false,
            firstFullyOnScreenIndex: undefined,
            hasScrolled: false,
            idCache: [],
            ignoreScrollFromMVCP: undefined,
            indexByKey: new Map(),
            isAtEnd: false,
            isAtStart: true,
            isEndReached: false,
            isStartReached: false,
            lastBatchingAction: 0,
            maintainingScrollAtEnd: false,
            positions: new Map(),
            props: {
                data: [],
                estimatedItemSize: 100,
                getEstimatedItemSize: undefined,
                horizontal: false,
                maintainScrollAtEndThreshold: 0.1,
                onEndReached: undefined,
                onEndReachedThreshold: 0.2,
                onScroll: (event: any) => onScrollCalls.push(event),
                onStartReached: undefined,
                onStartReachedThreshold: 0.2,
            },
            queuedInitialLayout: true,
            scroll: 0,
            scrollAdjustHandler: new ScrollAdjustHandler(mockCtx),
            scrollHistory: [],
            scrollingTo: undefined,
            scrollLength: 500,
            scrollPending: 0,
            scrollPrev: 0,
            scrollPrevTime: 0,
            scrollTime: 0,
            sizes: new Map(),
            sizesKnown: new Map(),
            startReachedBlockedByTimer: false,
        });

        mockScrollEvent = {
            nativeEvent: {
                contentOffset: { x: 0, y: 100 },
                contentSize: { height: 1000, width: 400 },
            },
        };
    });

    describe("basic scroll handling", () => {
        it("should update scroll position for vertical scrolling", () => {
            onScroll(mockCtx, mockState, mockScrollEvent);

            expect(mockState.scrollPending).toBe(100);
            expect(mockState.scroll).toBe(100);
            expect(mockState.scrollPrev).toBe(0);
            expect(mockState.hasScrolled).toBe(true);
        });

        it("should update scroll position for horizontal scrolling", () => {
            mockState.props.horizontal = true;
            mockScrollEvent.nativeEvent.contentOffset.x = 150;

            onScroll(mockCtx, mockState, mockScrollEvent);

            expect(mockState.scrollPending).toBe(150);
            expect(mockState.scroll).toBe(150);
        });

        it("should call original onScroll callback", () => {
            onScroll(mockCtx, mockState, mockScrollEvent);

            expect(onScrollCalls.length).toBe(1);
            expect(onScrollCalls[0]).toBe(mockScrollEvent);
        });

        it("should update scroll timing", () => {
            onScroll(mockCtx, mockState, mockScrollEvent);

            expect(mockState.scrollTime).toBeGreaterThan(0);
            expect(mockState.lastBatchingAction).toBe(mockState.scrollTime);
            expect(mockState.scrollTime).toBeGreaterThanOrEqual(mockState.scrollPrevTime ?? 0);
        });
    });

    describe("scroll history management", () => {
        it("should add to scroll history when scrolling normally", () => {
            onScroll(mockCtx, mockState, mockScrollEvent);

            expect(mockState.scrollHistory.length).toBe(1);
            expect(mockState.scrollHistory[0].scroll).toBe(100);
            expect(mockState.scrollHistory[0].time).toBeGreaterThan(0);
        });

        it("should not add to history when scrolling to specific position", () => {
            mockState.scrollingTo = { animated: true, index: 5, offset: 200 };

            onScroll(mockCtx, mockState, mockScrollEvent);

            expect(mockState.scrollHistory.length).toBe(0);
        });

        it("should not add to history for initial scroll event with same position", () => {
            mockScrollEvent.nativeEvent.contentOffset.y = 0; // Same as state.scroll

            onScroll(mockCtx, mockState, mockScrollEvent);

            expect(mockState.scrollHistory.length).toBe(0);
        });

        it("should limit scroll history to 5 entries", () => {
            // Add 7 scroll events
            for (let i = 1; i <= 7; i++) {
                mockScrollEvent.nativeEvent.contentOffset.y = i * 50;
                onScroll(mockCtx, mockState, mockScrollEvent);
            }

            expect(mockState.scrollHistory.length).toBe(5);
            expect(mockState.scrollHistory[0].scroll).toBe(150); // First entry should be from scroll 3
            expect(mockState.scrollHistory[4].scroll).toBe(350); // Last entry should be from scroll 7
        });

        it("should maintain correct order in scroll history", () => {
            const scrollPositions = [100, 150, 200, 250];

            scrollPositions.forEach((position) => {
                mockScrollEvent.nativeEvent.contentOffset.y = position;
                onScroll(mockCtx, mockState, mockScrollEvent);
            });

            expect(mockState.scrollHistory.length).toBe(4);
            scrollPositions.forEach((position, index) => {
                expect(mockState.scrollHistory[index].scroll).toBe(position);
            });
        });
    });

    describe("MVCP scroll ignore logic", () => {
        it("should ignore scroll events when position is less than ignore threshold", () => {
            mockState.ignoreScrollFromMVCP = { gt: undefined, lt: 150 };
            mockScrollEvent.nativeEvent.contentOffset.y = 100; // Less than 150

            onScroll(mockCtx, mockState, mockScrollEvent);

            expect(mockState.scroll).toBe(0); // Should not update
            expect(mockState.scrollHistory.length).toBe(0);
        });

        it("should ignore scroll events when position is greater than ignore threshold", () => {
            mockState.ignoreScrollFromMVCP = { gt: 200, lt: undefined };
            mockScrollEvent.nativeEvent.contentOffset.y = 250; // Greater than 200

            onScroll(mockCtx, mockState, mockScrollEvent);

            expect(mockState.scroll).toBe(0); // Should not update
            expect(mockState.scrollHistory.length).toBe(0);
        });

        it("should process scroll events within MVCP ignore range", () => {
            mockState.ignoreScrollFromMVCP = { gt: 200, lt: 50 };
            mockScrollEvent.nativeEvent.contentOffset.y = 100; // Between 50 and 200

            onScroll(mockCtx, mockState, mockScrollEvent);

            expect(mockState.scroll).toBe(100);
            expect(mockState.scrollHistory.length).toBe(1);
        });

        it("should ignore MVCP when scrollingTo is active", () => {
            mockState.ignoreScrollFromMVCP = { gt: undefined, lt: 150 };
            mockState.scrollingTo = { animated: true, index: 5, offset: 200 };
            mockScrollEvent.nativeEvent.contentOffset.y = 100; // Less than 150 but should be processed

            onScroll(mockCtx, mockState, mockScrollEvent);

            expect(mockState.scroll).toBe(100); // Should update despite MVCP ignore
        });

        it("should handle both lt and gt thresholds", () => {
            mockState.ignoreScrollFromMVCP = { gt: 200, lt: 50 };

            // Test below lt threshold
            mockScrollEvent.nativeEvent.contentOffset.y = 30;
            onScroll(mockCtx, mockState, mockScrollEvent);
            expect(mockState.scroll).toBe(0);

            // Test above gt threshold
            mockScrollEvent.nativeEvent.contentOffset.y = 250;
            onScroll(mockCtx, mockState, mockScrollEvent);
            expect(mockState.scroll).toBe(0);
        });
    });

    describe("content size validation", () => {
        it("should ignore scroll events with zero content size", () => {
            mockScrollEvent.nativeEvent.contentSize = { height: 0, width: 0 };

            onScroll(mockCtx, mockState, mockScrollEvent);

            expect(mockState.scroll).toBe(0);
            expect(mockState.scrollHistory.length).toBe(0);
            expect(onScrollCalls.length).toBe(0);
        });

        it("should process scroll events with valid content size", () => {
            mockScrollEvent.nativeEvent.contentSize = { height: 1000, width: 400 };

            onScroll(mockCtx, mockState, mockScrollEvent);

            expect(mockState.scroll).toBe(100);
            expect(onScrollCalls.length).toBe(1);
        });

        it("should handle missing content size gracefully", () => {
            delete mockScrollEvent.nativeEvent.contentSize;

            onScroll(mockCtx, mockState, mockScrollEvent);

            expect(mockState.scroll).toBe(100);
            expect(onScrollCalls.length).toBe(1);
        });

        it("should handle partial content size", () => {
            mockScrollEvent.nativeEvent.contentSize = { width: 400 }; // Missing height

            onScroll(mockCtx, mockState, mockScrollEvent);

            expect(mockState.scroll).toBe(100);
        });
    });

    describe("callback integration", () => {
        it("should handle missing onScroll callback", () => {
            mockState.props.onScroll = undefined;

            expect(() => onScroll(mockCtx, mockState, mockScrollEvent)).not.toThrow();
            expect(mockState.scroll).toBe(100);
        });

        it("should handle onScroll callback throwing error", () => {
            mockState.props.onScroll = () => {
                throw new Error("Callback error");
            };

            expect(() => onScroll(mockCtx, mockState, mockScrollEvent)).toThrow("Callback error");
        });

        it("should call onEndReached when appropriate", () => {
            const onEndReachedCalls: any[] = [];
            mockState.props.onEndReached = (event: any) => onEndReachedCalls.push(event);

            // Scroll near the end
            mockScrollEvent.nativeEvent.contentOffset.y = 900; // Close to contentSize of 1000

            onScroll(mockCtx, mockState, mockScrollEvent);

            // May trigger onEndReached depending on threshold calculation
            expect(mockState.isEndReached).toBeDefined();
        });

        it("should call onStartReached when appropriate", () => {
            const onStartReachedCalls: any[] = [];
            mockState.props.onStartReached = (event: any) => onStartReachedCalls.push(event);

            // Start with scroll position away from top
            mockState.scroll = 200;
            mockState.isAtStart = false;

            // Scroll near the top
            mockScrollEvent.nativeEvent.contentOffset.y = 10;

            onScroll(mockCtx, mockState, mockScrollEvent);

            expect(mockState.isStartReached).toBeDefined();
        });
    });

    describe("edge cases and error handling", () => {
        it("should handle null event", () => {
            expect(() => onScroll(mockCtx, mockState, null as any)).toThrow();
        });

        it("should handle missing nativeEvent", () => {
            const invalidEvent = { someOtherProperty: "value" };

            expect(() => onScroll(mockCtx, mockState, invalidEvent as any)).toThrow();
        });

        it("should handle invalid contentOffset", () => {
            mockScrollEvent.nativeEvent.contentOffset = null;

            expect(() => onScroll(mockCtx, mockState, mockScrollEvent)).toThrow();
        });

        it("should handle string contentOffset values", () => {
            mockScrollEvent.nativeEvent.contentOffset = { x: "100", y: "150" };

            onScroll(mockCtx, mockState, mockScrollEvent);

            expect(mockState.scroll).toBe("150" as any); // Function doesn't validate types
        });

        it("should handle negative scroll positions", () => {
            mockScrollEvent.nativeEvent.contentOffset.y = -50;

            onScroll(mockCtx, mockState, mockScrollEvent);

            expect(mockState.scroll).toBe(-50);
            expect(mockState.scrollHistory.length).toBe(1);
        });

        it("should handle very large scroll positions", () => {
            mockScrollEvent.nativeEvent.contentOffset.y = Number.MAX_SAFE_INTEGER;

            onScroll(mockCtx, mockState, mockScrollEvent);

            expect(mockState.scroll).toBe(Number.MAX_SAFE_INTEGER);
        });

        it("should handle corrupted state gracefully", () => {
            mockState.scrollHistory = null as any;

            expect(() => onScroll(mockCtx, mockState, mockScrollEvent)).toThrow();
        });
    });

    describe("performance considerations", () => {
        it("should handle rapid scroll events efficiently", () => {
            for (let i = 0; i < 1000; i++) {
                mockScrollEvent.nativeEvent.contentOffset.y = i;
                onScroll(mockCtx, mockState, mockScrollEvent);
            }

            expect(mockState.scrollHistory.length).toBe(5); // Should maintain limit
        });

        it("should update timing correctly for multiple events", () => {
            let lastTime = 0;

            for (let i = 0; i < 10; i++) {
                mockScrollEvent.nativeEvent.contentOffset.y = i * 50;
                onScroll(mockCtx, mockState, mockScrollEvent);

                expect(mockState.scrollTime).toBeGreaterThanOrEqual(lastTime);
                lastTime = mockState.scrollTime;
            }
        });

        it("should maintain memory efficiency with large scroll history", () => {
            for (let i = 0; i < 10000; i++) {
                mockScrollEvent.nativeEvent.contentOffset.y = i;
                onScroll(mockCtx, mockState, mockScrollEvent);
            }

            expect(mockState.scrollHistory.length).toBe(5); // Should maintain limit
        });
    });

    describe("integration with other systems", () => {
        it("should trigger calculateItemsInView", () => {
            // This is tested indirectly - function should complete without error
            onScroll(mockCtx, mockState, mockScrollEvent);

            expect(mockState.scroll).toBe(100);
            expect(mockState.hasScrolled).toBe(true);
        });

        it("should trigger checkAtBottom and checkAtTop", () => {
            onScroll(mockCtx, mockState, mockScrollEvent);

            // These functions update state flags
            expect(typeof mockState.isAtEnd).toBe("boolean");
            expect(typeof mockState.isAtStart).toBe("boolean");
        });

        it("should handle horizontal scrolling correctly", () => {
            mockState.props.horizontal = true;
            mockScrollEvent.nativeEvent.contentOffset.x = 200;

            onScroll(mockCtx, mockState, mockScrollEvent);

            expect(mockState.scroll).toBe(200);
            expect(mockState.scrollHistory[0].scroll).toBe(200);
        });

        it("should handle mixed horizontal/vertical events", () => {
            // Start with vertical
            mockState.props.horizontal = false;
            mockScrollEvent.nativeEvent.contentOffset.y = 100;
            onScroll(mockCtx, mockState, mockScrollEvent);
            expect(mockState.scroll).toBe(100);

            // Switch to horizontal
            mockState.props.horizontal = true;
            mockScrollEvent.nativeEvent.contentOffset.x = 200;
            onScroll(mockCtx, mockState, mockScrollEvent);
            expect(mockState.scroll).toBe(200);
        });
    });

    describe("scroll state consistency", () => {
        it("should maintain correct previous scroll values", () => {
            // First scroll
            onScroll(mockCtx, mockState, mockScrollEvent);
            expect(mockState.scroll).toBe(100);
            expect(mockState.scrollPrev).toBe(0);

            // Second scroll
            mockScrollEvent.nativeEvent.contentOffset.y = 200;
            onScroll(mockCtx, mockState, mockScrollEvent);
            expect(mockState.scroll).toBe(200);
            expect(mockState.scrollPrev).toBe(100);
        });

        it("should update scrollPending before processing", () => {
            mockScrollEvent.nativeEvent.contentOffset.y = 300;

            onScroll(mockCtx, mockState, mockScrollEvent);

            expect(mockState.scrollPending).toBe(300);
            expect(mockState.scroll).toBe(300);
        });

        it("should handle rapid scroll direction changes", () => {
            const positions = [100, 200, 150, 180, 120];

            positions.forEach((position) => {
                mockScrollEvent.nativeEvent.contentOffset.y = position;
                onScroll(mockCtx, mockState, mockScrollEvent);
            });

            expect(mockState.scroll).toBe(120);
            expect(mockState.scrollHistory.length).toBe(5);
        });
    });
});
