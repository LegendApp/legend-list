import { describe, expect, it } from "bun:test";
import "../setup";

import { checkAtBottom } from "../../src/utils/checkAtBottom";
import { checkAtTop } from "../../src/utils/checkAtTop";
import { checkThresholds } from "../../src/utils/checkThresholds";
import { beginReachedEdgeUserScroll, prepareReachedEdgeForNextUserScroll } from "../../src/utils/edgeReachedGate";
import { createMockContext } from "../__mocks__/createMockContext";

describe("reached edge gate", () => {
    it("blocks a residual end scroll after a programmatic reach and rearms for the next gesture", () => {
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
        expect(calls).toEqual([50, 48]);
    });

    it("blocks a residual start scroll after a programmatic reach and rearms for the next gesture", () => {
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
        expect(calls).toEqual([50, 48]);
    });

    it("clears the gate after leaving both hysteresis regions", () => {
        const calls: number[] = [];
        const ctx = createMockContext(
            { footerSize: 0, headerSize: 0, stylePaddingTop: 0, totalSize: 1000 },
            {
                isEndReached: false,
                props: {
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

    it("keeps short-content edge callbacks latched until an explicit new gesture", () => {
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
        expect(endCalls).toHaveLength(2);
        expect(startCalls).toHaveLength(1);
    });
});
