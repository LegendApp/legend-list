import { describe, expect, it } from "bun:test";
import "../setup";

import { checkAtBottom } from "../../src/utils/checkAtBottom";
import { createMockContext } from "../__mocks__/createMockContext";
import { createMockState } from "../__mocks__/createMockState";

describe("checkAtBottom", () => {
    it("returns early when state is null or undefined", () => {
        const ctx = createMockContext();
        expect(() => checkAtBottom(ctx, null as any)).not.toThrow();
        expect(() => checkAtBottom(ctx, undefined as any)).not.toThrow();
    });

    it("does not fire on initial mount when content is shorter than the viewport", () => {
        const ctx = createMockContext({ totalSize: 200, stylePaddingTop: 0, headerSize: 0, footerSize: 0 });
        const calls: Array<{ distanceFromEnd: number }> = [];
        const state = createMockState({
            isEndReached: null,
            props: {
                onEndReached: (payload) => calls.push(payload),
                onEndReachedThreshold: 0.2,
            },
            queuedInitialLayout: true,
            scroll: 0,
            scrollLength: 300,
        });

        checkAtBottom(ctx, state);

        expect(state.isEndReached).toBeNull();
        expect(state.endReachedSnapshot).toBeUndefined();
        expect(calls).toEqual([]);
    });

    it("returns early when queuedInitialLayout is false", () => {
        const ctx = createMockContext({ totalSize: 1000 });
        const state = createMockState({
            queuedInitialLayout: false,
            isEndReached: null,
        });

        checkAtBottom(ctx, state);

        expect(state.isEndReached).toBeNull();
        expect(state.endReachedSnapshot).toBeUndefined();
    });

    it("returns early when maintainingScrollAtEnd is true", () => {
        const ctx = createMockContext({ totalSize: 1000 });
        const state = createMockState({
            maintainingScrollAtEnd: true,
            isEndReached: null,
            queuedInitialLayout: true,
        });

        checkAtBottom(ctx, state);

        expect(state.isEndReached).toBeNull();
        expect(state.endReachedSnapshot).toBeUndefined();
    });

    it("fires after leaving and re-entering the threshold window", () => {
        const ctx = createMockContext({ totalSize: 1000, stylePaddingTop: 0, headerSize: 0, footerSize: 0 });
        const calls: Array<{ distanceFromEnd: number }> = [];
        const state = createMockState({
            isEndReached: null,
            props: {
                onEndReached: (payload) => calls.push(payload),
                onEndReachedThreshold: 0.2, // threshold = 60
            },
            queuedInitialLayout: true,
            scroll: 0,
            scrollLength: 300,
        });

        // Outside threshold; establishes eligibility
        checkAtBottom(ctx, state);
        expect(state.isEndReached).toBe(false);

        // Re-enter threshold
        state.scroll = 650; // distanceFromEnd = 50
        checkAtBottom(ctx, state);

        expect(state.isEndReached).toBe(true);
        expect(calls).toEqual([{ distanceFromEnd: 50 }]);
        expect(state.endReachedSnapshot).toMatchObject({
            atThreshold: false,
            dataLength: state.props.data.length,
            scrollPosition: 650,
        });
    });

    it("resets after leaving hysteresis band", () => {
        const ctx = createMockContext({ totalSize: 1000, stylePaddingTop: 0, headerSize: 0, footerSize: 0 });
        const state = createMockState({
            isEndReached: null,
            props: {
                onEndReachedThreshold: 0.2, // threshold = 60
            },
            queuedInitialLayout: true,
            scroll: 500, // distanceFromEnd = 200
            scrollLength: 300,
        });

        checkAtBottom(ctx, state); // outside -> false
        expect(state.isEndReached).toBe(false);

        state.scroll = 700; // distanceFromEnd = 0 -> inside -> true
        checkAtBottom(ctx, state);
        expect(state.isEndReached).toBe(true);
        expect(state.endReachedSnapshot).toBeDefined();

        state.scroll = 300; // distanceFromEnd = 400 -> beyond hysteresis
        checkAtBottom(ctx, state);
        expect(state.isEndReached).toBe(false);
        expect(state.endReachedSnapshot).toBeUndefined();
    });

    it("re-fires inside threshold when content/data changes", () => {
        const ctx = createMockContext({ totalSize: 1000, stylePaddingTop: 0, headerSize: 0, footerSize: 0 });
        const calls: Array<{ distanceFromEnd: number }> = [];
        const state = createMockState({
            isEndReached: null,
            props: {
                data: [{ id: 1 }],
                onEndReached: (payload) => calls.push(payload),
                onEndReachedThreshold: 0.2, // threshold = 60
            },
            queuedInitialLayout: true,
            scroll: 400, // distanceFromEnd = 300 (outside)
            scrollLength: 300,
        });

        // Outside threshold; mark eligible
        checkAtBottom(ctx, state);
        expect(state.isEndReached).toBe(false);

        // Stay within threshold, no changes -> no fire
        state.scroll = 650; // distanceFromEnd = 50
        checkAtBottom(ctx, state);
        expect(calls).toEqual([{ distanceFromEnd: 50 }]);
        calls.length = 0;

        // Change content size and data length inside window -> re-fire
        ctx.values.set("totalSize", 1400);
        state.props.data = [{ id: 1 }, { id: 2 }];
        state.scroll = 1100; // distanceFromEnd = 0 (inside)
        checkAtBottom(ctx, state);

        expect(calls).toEqual([{ distanceFromEnd: 0 }]);
        expect(state.endReachedSnapshot).toMatchObject({
            contentSize: 1400,
            dataLength: 2,
        });
    });
});
