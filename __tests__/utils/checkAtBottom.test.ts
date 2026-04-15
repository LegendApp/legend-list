import { describe, expect, it } from "bun:test";
import "../setup";

import { checkAtBottom } from "../../src/utils/checkAtBottom";
import { createMockContext } from "../__mocks__/createMockContext";
import { createMockState } from "../__mocks__/createMockState";

describe("checkAtBottom", () => {
    it("returns early when state is null or undefined", () => {
        const ctx = createMockContext();
        ctx.state = null as any;
        expect(() => checkAtBottom(ctx)).not.toThrow();
        ctx.state = undefined as any;
        expect(() => checkAtBottom(ctx)).not.toThrow();
    });

    it("does not fire on initial mount when content is shorter than the viewport", () => {
        const ctx = createMockContext({ footerSize: 0, headerSize: 0, stylePaddingTop: 0, totalSize: 200 });
        const calls: Array<{ distanceFromEnd: number }> = [];
        const state = createMockState({
            initialScroll: { index: 0, viewOffset: 0 },
            isEndReached: null,
            props: {
                onEndReached: (payload) => calls.push(payload),
                onEndReachedThreshold: 0.2,
            },
            queuedInitialLayout: true,
            scroll: 0,
            scrollLength: 300,
        });

        ctx.state = state;

        checkAtBottom(ctx);

        expect(state.isEndReached).toBeNull();
        expect(state.endReachedSnapshot).toBeUndefined();
        expect(calls).toEqual([]);
    });

    it("allows end checks after initial scroll finished even if the target is preserved", () => {
        const ctx = createMockContext({ footerSize: 0, headerSize: 0, stylePaddingTop: 0, totalSize: 1000 });
        const calls: Array<{ distanceFromEnd: number }> = [];
        const state = createMockState({
            didFinishInitialScroll: true,
            initialScroll: { index: 5, viewPosition: 1 },
            isEndReached: null,
            props: {
                onEndReached: (payload) => calls.push(payload),
                onEndReachedThreshold: 0.2,
            },
            queuedInitialLayout: true,
            scroll: 650,
            scrollLength: 300,
        });

        ctx.state = state;

        checkAtBottom(ctx);

        expect(state.isEndReached).toBe(true);
        expect(ctx.values.get("isAtEnd")).toBe(false);
        expect(ctx.values.get("isNearEnd")).toBe(true);
        expect(ctx.values.get("isWithinMaintainScrollAtEndThreshold")).toBe(false);
        expect(calls).toEqual([{ distanceFromEnd: 50 }]);
    });

    it("returns early when queuedInitialLayout is false", () => {
        const ctx = createMockContext({ totalSize: 1000 });
        const state = createMockState({
            isEndReached: null,
            queuedInitialLayout: false,
        });

        ctx.state = state;

        checkAtBottom(ctx);

        expect(state.isEndReached).toBeNull();
        expect(state.endReachedSnapshot).toBeUndefined();
    });

    it("returns early when maintainingScrollAtEnd is true", () => {
        const ctx = createMockContext({ totalSize: 1000 });
        const state = createMockState({
            isEndReached: null,
            maintainingScrollAtEnd: true,
            queuedInitialLayout: true,
        });

        ctx.state = state;

        checkAtBottom(ctx);

        expect(state.isEndReached).toBeNull();
        expect(state.endReachedSnapshot).toBeUndefined();
    });

    it("fires after leaving and re-entering the threshold window", () => {
        const ctx = createMockContext({ footerSize: 0, headerSize: 0, stylePaddingTop: 0, totalSize: 1000 });
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

        ctx.state = state;

        // Outside threshold; establishes eligibility
        checkAtBottom(ctx);
        expect(state.isEndReached).toBe(false);
        expect(ctx.values.get("isAtEnd")).toBe(false);
        expect(ctx.values.get("isNearEnd")).toBe(false);
        expect(ctx.values.get("isWithinMaintainScrollAtEndThreshold")).toBe(false);

        // Re-enter threshold
        state.scroll = 650; // distanceFromEnd = 50
        checkAtBottom(ctx);

        expect(state.isEndReached).toBe(true);
        expect(calls).toEqual([{ distanceFromEnd: 50 }]);
        expect(ctx.values.get("isAtEnd")).toBe(false);
        expect(ctx.values.get("isNearEnd")).toBe(true);
        expect(ctx.values.get("isWithinMaintainScrollAtEndThreshold")).toBe(false);
        expect(state.endReachedSnapshot).toMatchObject({
            atThreshold: false,
            dataLength: state.props.data.length,
            scrollPosition: 650,
        });
    });

    it("accounts for contentInset when calculating distance from end", () => {
        const ctx = createMockContext({ footerSize: 0, headerSize: 0, stylePaddingTop: 0, totalSize: 1000 });
        const calls: Array<{ distanceFromEnd: number }> = [];
        const state = createMockState({
            isEndReached: null,
            props: {
                contentInset: { bottom: 100, left: 0, right: 0, top: 0 },
                onEndReached: (payload) => calls.push(payload),
                onEndReachedThreshold: 0.2, // threshold = 60
            },
            queuedInitialLayout: true,
            scroll: 0,
            scrollLength: 300,
        });

        ctx.state = state;

        checkAtBottom(ctx);
        expect(state.isEndReached).toBe(false);
        expect(ctx.values.get("isAtEnd")).toBe(false);
        expect(ctx.values.get("isNearEnd")).toBe(false);
        expect(ctx.values.get("isWithinMaintainScrollAtEndThreshold")).toBe(false);

        state.scroll = 700;
        checkAtBottom(ctx);

        expect(calls).toEqual([{ distanceFromEnd: 0 }]);
        expect(state.isEndReached).toBe(true);
        expect(ctx.values.get("isAtEnd")).toBe(true);
        expect(ctx.values.get("isNearEnd")).toBe(true);
        expect(ctx.values.get("isWithinMaintainScrollAtEndThreshold")).toBe(true);
    });

    it("resets after leaving hysteresis band", () => {
        const ctx = createMockContext({ footerSize: 0, headerSize: 0, stylePaddingTop: 0, totalSize: 1000 });
        const state = createMockState({
            isEndReached: null,
            props: {
                onEndReachedThreshold: 0.2, // threshold = 60
            },
            queuedInitialLayout: true,
            scroll: 500, // distanceFromEnd = 200
            scrollLength: 300,
        });

        ctx.state = state;

        checkAtBottom(ctx); // outside -> false
        expect(state.isEndReached).toBe(false);
        expect(ctx.values.get("isAtEnd")).toBe(false);
        expect(ctx.values.get("isNearEnd")).toBe(false);
        expect(ctx.values.get("isWithinMaintainScrollAtEndThreshold")).toBe(false);

        state.scroll = 700; // distanceFromEnd = 0 -> inside -> true
        checkAtBottom(ctx);
        expect(state.isEndReached).toBe(true);
        expect(state.endReachedSnapshot).toBeDefined();
        expect(ctx.values.get("isAtEnd")).toBe(true);
        expect(ctx.values.get("isNearEnd")).toBe(true);
        expect(ctx.values.get("isWithinMaintainScrollAtEndThreshold")).toBe(true);

        state.scroll = 300; // distanceFromEnd = 400 -> beyond hysteresis
        checkAtBottom(ctx);
        expect(state.isEndReached).toBe(false);
        expect(state.endReachedSnapshot).toBeUndefined();
        expect(ctx.values.get("isAtEnd")).toBe(false);
        expect(ctx.values.get("isNearEnd")).toBe(false);
        expect(ctx.values.get("isWithinMaintainScrollAtEndThreshold")).toBe(false);
    });

    it("re-fires inside threshold when content/data changes", () => {
        const ctx = createMockContext({ footerSize: 0, headerSize: 0, stylePaddingTop: 0, totalSize: 1000 });
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

        ctx.state = state;

        // Outside threshold; mark eligible
        checkAtBottom(ctx);
        expect(state.isEndReached).toBe(false);

        // Stay within threshold, no changes -> no fire
        state.scroll = 650; // distanceFromEnd = 50
        checkAtBottom(ctx);
        expect(calls).toEqual([{ distanceFromEnd: 50 }]);
        calls.length = 0;

        // Change content size and data length inside window -> re-fire
        ctx.values.set("totalSize", 1400);
        state.props.data = [{ id: 1 }, { id: 2 }];
        state.scroll = 1100; // distanceFromEnd = 0 (inside)
        checkAtBottom(ctx);

        expect(calls).toEqual([{ distanceFromEnd: 0 }]);
        expect(state.endReachedSnapshot).toMatchObject({
            contentSize: 1400,
            dataLength: 2,
        });
    });

    it("re-fires inside threshold when a conditional footer is removed", () => {
        const ctx = createMockContext({ footerSize: 40, headerSize: 0, stylePaddingTop: 0, totalSize: 1000 });
        const calls: Array<{ distanceFromEnd: number }> = [];
        const state = createMockState({
            isEndReached: null,
            props: {
                data: [{ id: 1 }],
                onEndReached: (payload) => calls.push(payload),
                onEndReachedThreshold: 0.2, // threshold = 60
            },
            queuedInitialLayout: true,
            scroll: 400, // outside threshold
            scrollLength: 300,
        });

        ctx.state = state;

        checkAtBottom(ctx);
        expect(state.isEndReached).toBe(false);

        state.scroll = 690; // contentSize = 1040, distanceFromEnd = 50
        checkAtBottom(ctx);
        expect(calls).toEqual([{ distanceFromEnd: 50 }]);
        calls.length = 0;

        ctx.values.set("footerSize", 0);
        state.scroll = 650; // contentSize = 1000, distanceFromEnd = 50
        checkAtBottom(ctx);

        expect(calls).toEqual([{ distanceFromEnd: 50 }]);
        expect(state.endReachedSnapshot).toMatchObject({
            contentSize: 1000,
            dataLength: 1,
        });
    });
});
