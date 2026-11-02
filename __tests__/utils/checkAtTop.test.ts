import { afterEach, describe, expect, it } from "bun:test";
import "../setup";

import { Platform } from "../../src/platform/Platform";
import { checkAtTop } from "../../src/utils/checkAtTop";
import { beginReachedEdgeUserScroll, prepareReachedEdgeForNextUserScroll } from "../../src/utils/edgeReachedGate";
import { createMockContext } from "../__mocks__/createMockContext";

const originalPlatform = Platform.OS;

describe("checkAtTop", () => {
    afterEach(() => {
        Platform.OS = originalPlatform;
    });

    it.each([
        { name: "prop", props: { contentInset: { bottom: 0, left: 0, right: 0, top: 96 } } },
        {
            name: "native",
            nativeContentInset: { bottom: 0, left: 0, right: 0, top: 96 },
            props: { contentInset: undefined },
        },
        {
            contentInsetOverride: { bottom: 0, left: 0, right: 0, top: 96 },
            name: "override",
            props: { contentInset: { bottom: 0, left: 0, right: 0, top: 20 } },
        },
    ])("measures the start threshold from the resting $name inset offset", (testCase) => {
        Platform.OS = "ios";
        const calls: number[] = [];
        const ctx = createMockContext(
            {},
            {
                contentInsetOverride: testCase.contentInsetOverride,
                nativeContentInset: testCase.nativeContentInset,
                props: {
                    data: [{ id: 1 }],
                    ...testCase.props,
                    onStartReached: ({ distanceFromStart }) => calls.push(distanceFromStart),
                    onStartReachedThreshold: 0.1,
                },
                queuedInitialLayout: true,
                scroll: -96,
                scrollLength: 300,
                totalSize: 1000,
            },
        );

        checkAtTop(ctx);
        expect(calls).toEqual([0]);
        expect(ctx.values.get("isAtStart")).toBe(true);
        expect(ctx.values.get("isNearStart")).toBe(true);

        ctx.state.scroll = -60; // 36px from the start, outside the 30px threshold but inside its 39px hysteresis band.
        ctx.state.totalSize = 1100;
        checkAtTop(ctx);
        expect(ctx.state.isStartReached).toBe(false);
        expect(ctx.state.startReachedSnapshot).toMatchObject({ data: ctx.state.props.data, dataLength: 1 });
        expect(ctx.values.get("isAtStart")).toBe(false);
        expect(ctx.values.get("isNearStart")).toBe(false);

        ctx.state.scroll = 0; // Native zero is already 96px from the resting start.
        checkAtTop(ctx);
        expect(ctx.values.get("isNearStart")).toBe(false);
        expect(ctx.state.startReachedSnapshot).toBeUndefined();
        ctx.state.scroll = -76;
        checkAtTop(ctx);
        expect(calls).toEqual([0, 20]);
    });

    it.each([
        { horizontal: false, os: "android" },
        { horizontal: false, os: "web" },
        { horizontal: true, os: "ios" },
    ] as const)("keeps native zero as the start on $os (horizontal: $horizontal)", ({ horizontal, os }) => {
        Platform.OS = os;
        const calls: number[] = [];
        const ctx = createMockContext(
            {},
            {
                props: {
                    contentInset: { bottom: 0, left: 0, right: 0, top: 96 },
                    data: [{ id: 1 }],
                    horizontal,
                    onStartReached: ({ distanceFromStart }) => calls.push(distanceFromStart),
                    onStartReachedThreshold: 0.1,
                },
                queuedInitialLayout: true,
                scroll: 0,
                scrollLength: 300,
            },
        );
        checkAtTop(ctx);
        expect(calls).toEqual([0]);
        expect(ctx.values.get("isAtStart")).toBe(true);
    });

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
                    data: [{ id: 1 }],
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
                    data: [{ id: 1 }],
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
                    data: [{ id: 1 }],
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

    it("fires again inside threshold when the data length changes", () => {
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

        // A content size change alone, such as a re-measure or header toggle, does not re-fire.
        state.totalSize = 800;
        state.scroll = 25;
        checkAtTop(ctx);
        expect(calls).toEqual([]);

        // A data length change produces another callback.
        state.props.data = [{ id: 1 }, { id: 2 }];
        state.scroll = 30;
        checkAtTop(ctx);

        expect(calls).toEqual([{ distanceFromStart: 30 }]);
        expect(state.startReachedSnapshot).toMatchObject({ data: state.props.data, dataLength: 2 });
    });

    it("retries unchanged content when a new gesture begins inside the threshold", () => {
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
        expect(calls).toEqual([{ distanceFromStart: 20 }, { distanceFromStart: 30 }]);

        prepareReachedEdgeForNextUserScroll(ctx);

        // The prepend was already delivered, so the next gesture does not duplicate it.
        const allowedEdge = beginReachedEdgeUserScroll(ctx, -20);
        state.scroll = 10;
        checkAtTop(ctx, allowedEdge);
        expect(calls).toEqual([{ distanceFromStart: 20 }, { distanceFromStart: 30 }]);

        // A later gesture can still retry the same array.
        prepareReachedEdgeForNextUserScroll(ctx);
        checkAtTop(ctx, beginReachedEdgeUserScroll(ctx, -10));
        expect(calls).toEqual([{ distanceFromStart: 20 }, { distanceFromStart: 30 }, { distanceFromStart: 10 }]);
    });

    it("fires after leaving and re-entering the threshold window", () => {
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
            dataLength: state.props.data.length,
        });
    });
});
