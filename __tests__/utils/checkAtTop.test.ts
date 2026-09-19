import { describe, expect, it } from "bun:test";
import "../setup";

import { checkAtTop } from "../../src/utils/checkAtTop";
import { beginReachedEdgeUserScroll, prepareReachedEdgeForNextUserScroll } from "../../src/utils/edgeReachedGate";
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
                initialScroll: { index: 0, viewOffset: 0 },
                isStartReached: null,
                props: {
                    onStartReached: (payload) => calls.push(payload),
                    onStartReachedThreshold: 0.2,
                },
                queuedInitialLayout: true,
                scroll: 0,
                scrollLength: 300,
                totalSize: 600,
            },
        );

        checkAtTop(ctx);

        const state = ctx.state;
        expect(state.isStartReached).toBeNull();
        expect(state.startReachedSnapshot).toBeUndefined();
        expect(ctx.values.get("isAtStart")).toBe(true);
        expect(ctx.values.get("isNearStart")).toBe(true);
        expect(calls).toEqual([]);
    });

    it("allows start checks after initial scroll finished even if the target is preserved", () => {
        const calls: Array<{ distanceFromStart: number }> = [];
        const ctx = createMockContext(
            {},
            {
                didFinishInitialScroll: true,
                initialScroll: { index: 5, viewPosition: 1 },
                isStartReached: null,
                props: {
                    onStartReached: (payload) => calls.push(payload),
                    onStartReachedThreshold: 0.2,
                },
                queuedInitialLayout: true,
                scroll: 20,
                scrollLength: 300,
                totalSize: 600,
            },
        );

        checkAtTop(ctx);

        expect(ctx.state.isStartReached).toBe(true);
        expect(ctx.values.get("isAtStart")).toBe(false);
        expect(ctx.values.get("isNearStart")).toBe(true);
        expect(calls).toEqual([{ distanceFromStart: 20 }]);
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
                queuedInitialLayout: true,
                scroll: 0,
                scrollLength: 300,
            },
        );

        checkAtTop(ctx);

        const state = ctx.state;
        expect(state.isStartReached).toBe(false);
        expect(state.startReachedSnapshot).toBeUndefined();
        expect(ctx.values.get("isAtStart")).toBe(true);
        expect(ctx.values.get("isNearStart")).toBe(true);
        expect(calls).toEqual([]);
    });

    it("suppresses onStartReached during programmatic scroll and fires after it finishes", () => {
        const calls: Array<{ distanceFromStart: number }> = [];
        const ctx = createMockContext(
            {},
            {
                isStartReached: null,
                props: {
                    onStartReached: (payload) => calls.push(payload),
                    onStartReachedThreshold: 0.2, // threshold = 60
                },
                queuedInitialLayout: true,
                scroll: 20,
                scrollingTo: { animated: true, offset: 100 } as any,
                scrollLength: 300,
                totalSize: 600,
            },
        );
        const state = ctx.state;

        // While programmatic scroll is active, do not emit.
        checkAtTop(ctx);
        expect(calls).toEqual([]);
        expect(state.isStartReached).toBeNull();
        expect(ctx.values.get("isAtStart")).toBe(false);
        expect(ctx.values.get("isNearStart")).toBe(true);

        // Once scrollingTo is done, threshold check can emit normally.
        state.scrollingTo = undefined;
        checkAtTop(ctx);
        expect(calls).toEqual([{ distanceFromStart: 20 }]);
        expect(state.isStartReached).toBe(true);
        expect(ctx.values.get("isAtStart")).toBe(false);
        expect(ctx.values.get("isNearStart")).toBe(true);
    });

    it("resets after leaving hysteresis band", () => {
        const ctx = createMockContext(
            {},
            {
                isStartReached: null,
                props: {
                    onStartReached: () => {},
                    onStartReachedThreshold: 0.2, // threshold = 60
                },
                queuedInitialLayout: true,
                scroll: 200,
                scrollLength: 300,
            },
        );
        const state = ctx.state;

        // Outside threshold: establish eligibility
        checkAtTop(ctx);
        expect(state.isStartReached).toBe(false);
        expect(state.startReachedSnapshot).toBeUndefined();
        expect(ctx.values.get("isAtStart")).toBe(false);
        expect(ctx.values.get("isNearStart")).toBe(false);

        // Enter threshold: trigger
        state.scroll = 20;
        checkAtTop(ctx);
        expect(state.isStartReached).toBe(true);
        expect(state.startReachedSnapshot).toBeDefined();
        expect(ctx.values.get("isAtStart")).toBe(false);
        expect(ctx.values.get("isNearStart")).toBe(true);

        state.scroll = 200; // beyond hysteresis
        checkAtTop(ctx);
        expect(state.isStartReached).toBe(false);
        expect(state.startReachedSnapshot).toBeUndefined();
        expect(ctx.values.get("isAtStart")).toBe(false);
        expect(ctx.values.get("isNearStart")).toBe(false);
    });

    it("does not re-fire inside threshold for same data epoch context changes", () => {
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
                queuedInitialLayout: true,
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

        // Content size/data length change inside the same data epoch -> no re-fire
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

    it("does not re-fire inside threshold after data changes", () => {
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
                queuedInitialLayout: true,
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

        // Data changes while still inside threshold.
        state.dataChangeEpoch += 1;
        state.totalSize = 800;
        state.props.data = [{ id: 1 }, { id: 2 }];
        state.scroll = 30;
        checkAtTop(ctx);
        expect(calls).toEqual([{ distanceFromStart: 20 }]);

        // More checks in same epoch should not re-fire.
        state.scroll = 10;
        checkAtTop(ctx);
        expect(calls).toEqual([{ distanceFromStart: 20 }]);
    });

    it("re-arms inside the hysteresis band when a new user scroll begins toward start", () => {
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
                queuedInitialLayout: true,
                scroll: 200,
                scrollLength: 300,
                totalSize: 600,
            },
        );
        const state = ctx.state;

        checkAtTop(ctx);
        state.scroll = 20;
        checkAtTop(ctx);
        expect(calls).toEqual([{ distanceFromStart: 20 }]);

        // A small prepend leaves the viewport inside the same hysteresis band.
        state.totalSize = 800;
        state.props.data = [{ id: 10 }, { id: 1 }];
        state.scroll = 30;
        checkAtTop(ctx);
        expect(calls).toEqual([{ distanceFromStart: 20 }]);

        prepareReachedEdgeForNextUserScroll(ctx);

        // A new user gesture toward start can trigger the edge again.
        const allowedEdge = beginReachedEdgeUserScroll(ctx, -20);
        state.scroll = 10;
        checkAtTop(ctx, allowedEdge);
        expect(calls).toEqual([{ distanceFromStart: 20 }, { distanceFromStart: 10 }]);
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
                queuedInitialLayout: true,
                scroll: 0,
                scrollLength: 300,
                totalSize: 600,
            },
        );
        const state = ctx.state;

        // First call inside threshold triggers
        checkAtTop(ctx);
        expect(state.isStartReached).toBe(true);
        expect(calls).toEqual([{ distanceFromStart: 0 }]);

        // Move outside the threshold to make it eligible
        state.scroll = 200;
        checkAtTop(ctx);
        expect(state.isStartReached).toBe(false);

        // Re-enter threshold should trigger
        state.scroll = 20;
        checkAtTop(ctx);

        expect(state.isStartReached).toBe(true);
        expect(calls).toEqual([{ distanceFromStart: 0 }, { distanceFromStart: 20 }]);
        expect(state.startReachedSnapshot).toMatchObject({
            atThreshold: false,
            dataLength: state.props.data.length,
            scrollPosition: 20,
        });
    });
});
