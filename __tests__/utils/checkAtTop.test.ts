import { describe, expect, it } from "bun:test";
import "../setup";

import { checkAtTop } from "../../src/utils/checkAtTop";
import { createMockContext } from "../__mocks__/createMockContext";

describe("checkAtTop", () => {
    it("returns early when state is null or undefined", () => {
        expect(() => checkAtTop(null as any)).not.toThrow();
        expect(() => checkAtTop(undefined as any)).not.toThrow();
    });

    it("does not fire on initial mount when already within threshold", () => {
        const calls: Array<{ distanceFromStart: number }> = [];
        const ctx = createMockContext(
            {},
            {
                isStartReached: null,
                props: {
                    onStartReached: (payload) => calls.push(payload),
                    onStartReachedThreshold: 0.2,
                },
                scroll: 0,
                scrollLength: 300,
                totalSize: 600,
            },
        );

        checkAtTop(ctx);

        const state = ctx.state;
        expect(state.isStartReached).toBeNull();
        expect(state.startReachedSnapshot).toBeUndefined();
        expect(calls).toEqual([]);
    });

    it("does not fire when threshold is zero and inside window", () => {
        const calls: Array<{ distanceFromStart: number }> = [];
        const ctx = createMockContext(
            {},
            {
                isStartReached: null,
                props: {
                    onStartReached: (payload) => calls.push(payload),
                    onStartReachedThreshold: 0,
                },
                scroll: 0,
                scrollLength: 300,
            },
        );

        checkAtTop(ctx);

        const state = ctx.state;
        expect(state.isStartReached).toBe(false);
        expect(state.startReachedSnapshot).toBeUndefined();
        expect(calls).toEqual([]);
    });

    it("resets after leaving hysteresis band", () => {
        const ctx = createMockContext(
            {},
            {
                isStartReached: null,
                props: {
                    onStartReachedThreshold: 0.2, // threshold = 60
                },
                scroll: 200,
                scrollLength: 300,
            },
        );
        const state = ctx.state;

        // Outside threshold: establish eligibility
        checkAtTop(ctx);
        expect(state.isStartReached).toBe(false);
        expect(state.startReachedSnapshot).toBeUndefined();

        // Enter threshold: trigger
        state.scroll = 20;
        checkAtTop(ctx);
        expect(state.isStartReached).toBe(true);
        expect(state.startReachedSnapshot).toBeDefined();

        state.scroll = 200; // beyond hysteresis
        checkAtTop(ctx);
        expect(state.isStartReached).toBe(false);
        expect(state.startReachedSnapshot).toBeUndefined();
    });

    it("does not re-fire inside threshold when data/content changes", () => {
        const calls: Array<{ distanceFromStart: number }> = [];
        const ctx = createMockContext(
            {},
            {
                isStartReached: null,
                props: {
                    data: [{ id: 1 }],
                    onStartReached: (payload) => calls.push(payload),
                    onStartReachedThreshold: 0.2, // threshold = 60
                },
                scroll: 200,
                scrollLength: 300,
                totalSize: 600,
            },
        );
        const state = ctx.state;

        // First move outside threshold
        checkAtTop(ctx);
        expect(state.isStartReached).toBe(false);

        // Stay within threshold with no change -> no fire
        state.scroll = 20;
        checkAtTop(ctx);
        expect(calls).toEqual([{ distanceFromStart: 20 }]);
        calls.length = 0;

        // Content size change inside window -> no re-fire
        state.totalSize = 800;
        state.props.data = [{ id: 1 }, { id: 2 }];
        state.scroll = 30;
        checkAtTop(ctx);

        expect(calls).toEqual([]);
        expect(state.startReachedSnapshot).toMatchObject({
            contentSize: 800,
            dataLength: 2,
        });
    });

    it("re-fires only after leaving the threshold, even if data changes inside it", () => {
        const calls: Array<{ distanceFromStart: number }> = [];
        const ctx = createMockContext(
            {},
            {
                isStartReached: null,
                props: {
                    data: [{ id: 1 }],
                    onStartReached: (payload) => calls.push(payload),
                    onStartReachedThreshold: 0.2, // threshold = 60
                },
                scroll: 200,
                scrollLength: 300,
                totalSize: 600,
            },
        );
        const state = ctx.state;

        // Outside threshold: establish eligibility
        checkAtTop(ctx);
        expect(state.isStartReached).toBe(false);

        // Enter threshold: trigger
        state.scroll = 20;
        checkAtTop(ctx);
        expect(calls).toEqual([{ distanceFromStart: 20 }]);

        // Content change inside window -> no re-fire
        state.totalSize = 800;
        state.props.data = [{ id: 1 }, { id: 2 }];
        state.scroll = 30;
        checkAtTop(ctx);
        expect(calls).toEqual([{ distanceFromStart: 20 }]);

        // Leave beyond hysteresis -> reset
        state.scroll = 200;
        checkAtTop(ctx);
        expect(state.isStartReached).toBe(false);

        // Re-enter threshold -> trigger again
        state.scroll = 25;
        checkAtTop(ctx);
        expect(calls).toEqual([{ distanceFromStart: 20 }, { distanceFromStart: 25 }]);
    });

    it("fires after leaving and re-entering the threshold window", () => {
        const calls: Array<{ distanceFromStart: number }> = [];
        const ctx = createMockContext(
            {},
            {
                isStartReached: null,
                props: {
                    onStartReached: (payload) => calls.push(payload),
                    onStartReachedThreshold: 0.2, // threshold = 60
                },
                scroll: 0,
                scrollLength: 300,
                totalSize: 600,
            },
        );
        const state = ctx.state;

        // First call inside threshold should not trigger
        checkAtTop(ctx);
        expect(state.isStartReached).toBeNull();

        // Move outside the threshold to make it eligible
        state.scroll = 200;
        checkAtTop(ctx);
        expect(state.isStartReached).toBe(false);

        // Re-enter threshold should trigger
        state.scroll = 20;
        checkAtTop(ctx);

        expect(state.isStartReached).toBe(true);
        expect(calls).toEqual([{ distanceFromStart: 20 }]);
        expect(state.startReachedSnapshot).toMatchObject({
            atThreshold: false,
            dataLength: state.props.data.length,
            scrollPosition: 20,
        });
    });
});
