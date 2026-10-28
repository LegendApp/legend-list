import { afterEach, describe, expect, it } from "bun:test";
import "../setup";

import { Platform } from "../../src/platform/Platform";
import { checkAtBottom } from "../../src/utils/checkAtBottom";
import { checkAtTop } from "../../src/utils/checkAtTop";
import { checkThresholds } from "../../src/utils/checkThresholds";
import {
    beginReachedEdgeUserScroll,
    prepareReachedEdgeForNextUserScroll,
    resetSharedEdgeGateIfOutsideHysteresis,
} from "../../src/utils/edgeReachedGate";
import { createMockContext } from "../__mocks__/createMockContext";

const originalPlatform = Platform.OS;

describe("reached edge gate", () => {
    afterEach(() => {
        Platform.OS = originalPlatform;
    });

    it.each([
        [-120, "closed"],
        [-65, "closed"],
        [-30, undefined],
    ] as const)("uses distance from the inset start to rearm at native offset %i", (scroll, expected) => {
        Platform.OS = "ios";
        const ctx = createMockContext(
            { totalSize: 1000 },
            {
                edgeReachedGate: "closed",
                props: {
                    contentInset: { bottom: 0, left: 0, right: 0, top: 120 },
                    onEndReachedThreshold: 0.2,
                    onStartReachedThreshold: 0.2,
                },
                scroll,
                scrollLength: 300,
            },
        );
        resetSharedEdgeGateIfOutsideHysteresis(ctx);
        if (expected === undefined) expect(ctx.state.edgeReachedGate).toBeUndefined();
        else expect(ctx.state.edgeReachedGate).toBe(expected);
    });

    it("keeps the gate closed at the natural start with a top inset", () => {
        Platform.OS = "ios";
        const ctx = createMockContext(
            { totalSize: 1000 },
            {
                edgeReachedGate: "closed",
                props: {
                    contentInset: { bottom: 0, left: 0, right: 0, top: 200 },
                    onEndReachedThreshold: 0.1,
                    onStartReachedThreshold: 0.1,
                },
                scroll: -200,
                scrollLength: 800,
            },
        );
        resetSharedEdgeGateIfOutsideHysteresis(ctx);
        expect(ctx.state.edgeReachedGate).toBe("closed");
    });

    it("rearms after scrolling away from the end within a large end inset", () => {
        const ctx = createMockContext(
            { totalSize: 1000 },
            {
                edgeReachedGate: "closed",
                props: {
                    contentInset: { bottom: 400 },
                    data: [{ id: 1 }],
                    onEndReachedThreshold: 0.2,
                    onStartReachedThreshold: 0.2,
                },
                scroll: 700,
                scrollLength: 300,
            },
        );
        // The scrollable end is 1100, so this is 400px from it and from either edge's hysteresis band.
        resetSharedEdgeGateIfOutsideHysteresis(ctx);
        expect(ctx.state.edgeReachedGate).toBeUndefined();
    });

    it("keeps the end content snapshot across residual scrolls and new gestures", () => {
        const calls: number[] = [];
        const ctx = createMockContext(
            { footerSize: 0, headerSize: 0, stylePaddingTop: 0, totalSize: 1000 },
            {
                isEndReached: false,
                props: {
                    data: [{ id: 1 }],
                    onEndReached: ({ distanceFromEnd }) => calls.push(distanceFromEnd),
                    onEndReachedThreshold: 0.2,
                },
                queuedInitialLayout: true,
                scroll: 650,
                scrollLength: 300,
            },
        );

        checkAtBottom(ctx);
        expect(calls).toEqual([50]);
        expect(ctx.state.edgeReachedGate).toBe("closed");

        const residualAllowedEdge = beginReachedEdgeUserScroll(ctx, 1);
        ctx.state.scroll = 651;
        checkAtBottom(ctx, residualAllowedEdge);
        expect(residualAllowedEdge).toBeUndefined();
        expect(calls).toEqual([50]);

        prepareReachedEdgeForNextUserScroll(ctx);
        const nextGestureAllowedEdge = beginReachedEdgeUserScroll(ctx, 1);
        ctx.state.scroll = 652;
        checkAtBottom(ctx, nextGestureAllowedEdge);
        expect(nextGestureAllowedEdge).toBe("end");
        expect(calls).toEqual([50]);
    });

    it("keeps the start content snapshot across residual scrolls and new gestures", () => {
        const calls: number[] = [];
        const ctx = createMockContext(
            {},
            {
                isStartReached: false,
                props: {
                    data: [{ id: 1 }],
                    onStartReached: ({ distanceFromStart }) => calls.push(distanceFromStart),
                    onStartReachedThreshold: 0.2,
                },
                queuedInitialLayout: true,
                scroll: 50,
                scrollLength: 300,
                totalSize: 1000,
            },
        );

        checkAtTop(ctx);
        expect(calls).toEqual([50]);
        expect(ctx.state.edgeReachedGate).toBe("closed");

        const residualAllowedEdge = beginReachedEdgeUserScroll(ctx, -1);
        ctx.state.scroll = 49;
        checkAtTop(ctx, residualAllowedEdge);
        expect(residualAllowedEdge).toBeUndefined();
        expect(calls).toEqual([50]);

        prepareReachedEdgeForNextUserScroll(ctx);
        const nextGestureAllowedEdge = beginReachedEdgeUserScroll(ctx, -1);
        ctx.state.scroll = 48;
        checkAtTop(ctx, nextGestureAllowedEdge);
        expect(nextGestureAllowedEdge).toBe("start");
        expect(calls).toEqual([50]);
    });

    it("clears the gate after leaving both hysteresis regions", () => {
        const calls: number[] = [];
        const ctx = createMockContext(
            { footerSize: 0, headerSize: 0, stylePaddingTop: 0, totalSize: 1000 },
            {
                isEndReached: false,
                props: {
                    data: [{ id: 1 }],
                    onEndReached: ({ distanceFromEnd }) => calls.push(distanceFromEnd),
                    onEndReachedThreshold: 0.2,
                    onStartReachedThreshold: 0.2,
                },
                queuedInitialLayout: true,
                scroll: 650,
                scrollLength: 300,
            },
        );

        checkAtBottom(ctx);
        ctx.state.scroll = 300;
        checkAtBottom(ctx);
        expect(ctx.state.edgeReachedGate).toBeUndefined();

        ctx.state.scroll = 650;
        checkAtBottom(ctx);
        expect(calls).toEqual([50, 50]);
    });

    it("keeps unchanged short-content edge callbacks latched across new gestures", () => {
        const startCalls: number[] = [];
        const endCalls: number[] = [];
        const ctx = createMockContext(
            { footerSize: 0, headerSize: 0, stylePaddingTop: 0, totalSize: 100 },
            {
                isEndReached: false,
                isStartReached: false,
                props: {
                    data: [{ id: 1 }],
                    onEndReached: ({ distanceFromEnd }) => endCalls.push(distanceFromEnd),
                    onEndReachedThreshold: 0.2,
                    onStartReached: ({ distanceFromStart }) => startCalls.push(distanceFromStart),
                    onStartReachedThreshold: 0.2,
                },
                queuedInitialLayout: true,
                scroll: 0,
                scrollLength: 300,
            },
        );

        checkThresholds(ctx);
        checkThresholds(ctx);
        expect(endCalls).toHaveLength(1);
        expect(startCalls).toHaveLength(1);
        expect(ctx.state.edgeReachedGate).toBe("closed");

        prepareReachedEdgeForNextUserScroll(ctx);
        const allowedEdge = beginReachedEdgeUserScroll(ctx, 1);
        checkThresholds(ctx, allowedEdge);
        expect(allowedEdge).toBe("end");
        expect(endCalls).toHaveLength(1);
        expect(startCalls).toHaveLength(1);
    });
});
