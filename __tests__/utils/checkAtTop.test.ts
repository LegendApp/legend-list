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
                initialScroll: { index: 0, viewOffset: 0 },
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

        // Once scrollingTo is done, threshold check can emit normally.
        state.scrollingTo = undefined;
        checkAtTop(ctx);
        expect(calls).toEqual([{ distanceFromStart: 20 }]);
        expect(state.isStartReached).toBe(true);
    });

    it("suppresses onStartReached while a deferred boundary handoff is still pending", () => {
        const calls: Array<{ distanceFromStart: number }> = [];
        const ctx = createMockContext(
            {},
            {
                isStartReached: null,
                props: {
                    onStartReached: (payload) => calls.push(payload),
                    onStartReachedThreshold: 0.2,
                },
                scroll: 20,
                scrollLength: 300,
            },
        );
        const state = ctx.state;
        state.deferredGeometry.pendingBoundaryHandoff = {
            startScroll: 120,
            targetScroll: 80,
        };

        checkAtTop(ctx);

        expect(calls).toEqual([]);
        expect(state.isStartReached).toBeNull();
        expect(state.pendingStartReachedAfterDeferredBoundaryHandoff).toBe(true);
        expect(state.startReachedSnapshot).toBeUndefined();
    });

    it("consumes the first in-threshold check after a deferred boundary handoff and fires on the next one", () => {
        const calls: Array<{ distanceFromStart: number }> = [];
        const ctx = createMockContext(
            {},
            {
                isStartReached: null,
                pendingStartReachedAfterDeferredBoundaryHandoff: true,
                props: {
                    onStartReached: (payload) => calls.push(payload),
                    onStartReachedThreshold: 0.2,
                },
                scroll: 20,
                scrollLength: 300,
            },
        );
        const state = ctx.state;

        checkAtTop(ctx);
        expect(calls).toEqual([]);
        expect(state.isStartReached).toBeNull();
        expect(state.pendingStartReachedAfterDeferredBoundaryHandoff).toBe(false);

        checkAtTop(ctx);
        expect(calls).toEqual([{ distanceFromStart: 20 }]);
        expect(state.isStartReached).toBe(true);
        expect(state.startReachedSnapshot).toBeDefined();
    });

    it("clears deferred handoff suppression after leaving the threshold window", () => {
        const calls: Array<{ distanceFromStart: number }> = [];
        const ctx = createMockContext(
            {},
            {
                isStartReached: null,
                pendingStartReachedAfterDeferredBoundaryHandoff: true,
                props: {
                    onStartReached: (payload) => calls.push(payload),
                    onStartReachedThreshold: 0.2,
                },
                scroll: 100,
                scrollLength: 300,
            },
        );
        const state = ctx.state;

        checkAtTop(ctx);
        expect(calls).toEqual([]);
        expect(state.isStartReached).toBe(false);
        expect(state.pendingStartReachedAfterDeferredBoundaryHandoff).toBe(false);

        state.scroll = 20;
        checkAtTop(ctx);
        expect(calls).toEqual([{ distanceFromStart: 20 }]);
        expect(state.isStartReached).toBe(true);
    });

    it("suppresses the first in-threshold check after a data-change reset with synthetic scroll adjustment", () => {
        const calls: Array<{ distanceFromStart: number }> = [];
        const ctx = createMockContext(
            {},
            {
                dataChangeEpoch: 2,
                isStartReached: true,
                props: {
                    onStartReached: (payload) => calls.push(payload),
                    onStartReachedThreshold: 0.2,
                },
                scroll: 100,
                scrollAdjustHandler: {
                    consumeAppliedAdjust: () => undefined,
                    getAdjust: () => 200,
                    requestAdjust: () => undefined,
                    setMounted: () => undefined,
                } as any,
                scrollLength: 300,
                startReachedSnapshot: {
                    atThreshold: false,
                    contentSize: 1000,
                    dataLength: 10,
                    scrollPosition: 20,
                },
                startReachedSnapshotDataChangeEpoch: 1,
                totalSize: 1200,
            },
        );
        const state = ctx.state;

        checkAtTop(ctx);
        expect(calls).toEqual([]);
        expect(state.isStartReached).toBe(false);
        expect(state.pendingStartReachedAfterDeferredBoundaryHandoff).toBe(true);

        state.scroll = 20;
        checkAtTop(ctx);
        expect(calls).toEqual([]);
        expect(state.pendingStartReachedAfterDeferredBoundaryHandoff).toBe(false);

        checkAtTop(ctx);
        expect(calls).toEqual([{ distanceFromStart: 20 }]);
        expect(state.isStartReached).toBe(true);
    });

    it("keeps suppressing start reached while a deferred handoff is pending and the start latch is still set", () => {
        const calls: Array<{ distanceFromStart: number }> = [];
        const ctx = createMockContext(
            {},
            {
                dataChangeEpoch: 2,
                isStartReached: true,
                pendingStartReachedAfterDeferredBoundaryHandoff: true,
                props: {
                    onStartReached: (payload) => calls.push(payload),
                    onStartReachedThreshold: 0.2,
                },
                scroll: 20,
                scrollLength: 300,
                startReachedSnapshot: {
                    atThreshold: true,
                    contentSize: 1000,
                    dataLength: 10,
                    scrollPosition: 20,
                },
                startReachedSnapshotDataChangeEpoch: 1,
                totalSize: 1200,
            },
        );
        const state = ctx.state;

        checkAtTop(ctx);
        expect(calls).toEqual([]);
        expect(state.isStartReached).toBe(true);
        expect(state.pendingStartReachedAfterDeferredBoundaryHandoff).toBe(true);

        state.scroll = 120;
        checkAtTop(ctx);
        expect(state.pendingStartReachedAfterDeferredBoundaryHandoff).toBe(false);
        expect(state.isStartReached).toBe(false);

        state.startReachedSnapshot = undefined;
        state.startReachedSnapshotDataChangeEpoch = undefined;
        state.scroll = 20;
        checkAtTop(ctx);
        expect(calls).toEqual([{ distanceFromStart: 20 }]);
        expect(state.isStartReached).toBe(true);
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

    it("re-fires once inside threshold for each settled data change epoch", () => {
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

        // Data changes while still inside threshold.
        state.dataChangeEpoch += 1;
        state.totalSize = 800;
        state.props.data = [{ id: 1 }, { id: 2 }];
        state.scroll = 30;
        checkAtTop(ctx);
        expect(calls).toEqual([{ distanceFromStart: 20 }, { distanceFromStart: 30 }]);

        // More checks in same epoch should not re-fire.
        state.scroll = 10;
        checkAtTop(ctx);
        expect(calls).toEqual([{ distanceFromStart: 20 }, { distanceFromStart: 30 }]);
    });

    it("defers inside-window re-fire until MVCP settles", () => {
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

        checkAtTop(ctx);
        state.scroll = 20;
        checkAtTop(ctx);
        expect(calls).toEqual([{ distanceFromStart: 20 }]);

        // New data while MVCP is still active: no re-fire yet.
        state.dataChangeEpoch += 1;
        state.dataChangeNeedsScrollUpdate = true;
        state.props.data = [{ id: 10 }];
        state.scroll = 15;
        checkAtTop(ctx);
        expect(calls).toEqual([{ distanceFromStart: 20 }]);
        expect(state.startReachedSnapshotDataChangeEpoch).toBe(0);

        // Once settled, it should re-fire once for this epoch.
        state.dataChangeNeedsScrollUpdate = false;
        checkAtTop(ctx);
        expect(calls).toEqual([{ distanceFromStart: 20 }, { distanceFromStart: 15 }]);

        // Same epoch should not re-fire again.
        state.scroll = 10;
        checkAtTop(ctx);
        expect(calls).toEqual([{ distanceFromStart: 20 }, { distanceFromStart: 15 }]);
    });

    it("resets immediately when data changes push scroll outside the threshold", () => {
        const calls: Array<{ distanceFromStart: number }> = [];
        const ctx = createMockContext(
            {},
            {
                isStartReached: null,
                props: {
                    data: [{ id: 1 }],
                    onStartReached: (payload) => calls.push(payload),
                    onStartReachedThreshold: 0.2, // threshold = 60, hysteresis reset was 78
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
        expect(state.isStartReached).toBe(true);

        // Data changes push us just outside threshold but not beyond hysteresis.
        // We should still reset so a fast return can trigger again.
        state.dataChangeEpoch += 1;
        state.totalSize = 800;
        state.props.data = [{ id: 1 }, { id: 2 }];
        state.scroll = 70;
        checkAtTop(ctx);
        expect(state.isStartReached).toBe(false);
        expect(state.startReachedSnapshot).toBeUndefined();

        // Re-enter threshold quickly: should trigger again.
        state.scroll = 10;
        checkAtTop(ctx);
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
