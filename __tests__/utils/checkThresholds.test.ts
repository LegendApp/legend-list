import { describe, expect, it } from "bun:test";
import "../setup";

import { checkThresholds } from "../../src/utils/checkThresholds";
import { setDidLayout } from "../../src/utils/setDidLayout";
import { createMockContext } from "../__mocks__/createMockContext";

describe("checkThresholds", () => {
    it("does not let an absent start callback block scrolling into the end window", () => {
        const endCalls: number[] = [];
        const ctx = createMockContext(
            { footerSize: 0, headerSize: 0, stylePaddingTop: 0, totalSize: 566 },
            {
                props: {
                    data: Array.from({ length: 15 }, (_, id) => ({ id })),
                    onEndReached: ({ distanceFromEnd }) => endCalls.push(distanceFromEnd),
                    onEndReachedThreshold: 0.1,
                    onStartReachedThreshold: 0.5,
                },
                queuedInitialLayout: true,
                scroll: 0,
                scrollLength: 474,
            },
        );
        checkThresholds(ctx);
        expect(ctx.state.edgeReachedGate).toBeUndefined();
        ctx.state.scroll = 92;
        checkThresholds(ctx);
        checkThresholds(ctx);
        expect(endCalls).toEqual([0]);
    });

    for (const withStartCallback of [false, true]) {
        it(`delivers the initial end callback after layout for a short grid (start callback: ${withStartCallback})`, () => {
            const startCalls: number[] = [];
            const endCalls: number[] = [];
            const ctx = createMockContext(
                { footerSize: 0, headerSize: 0, stylePaddingTop: 0, totalSize: 566 },
                {
                    isEndReached: false,
                    isStartReached: false,
                    props: {
                        data: Array.from({ length: 15 }, (_, id) => ({ id })),
                        onEndReached: ({ distanceFromEnd }) => endCalls.push(distanceFromEnd),
                        onEndReachedThreshold: 0.5,
                        onStartReached: withStartCallback
                            ? ({ distanceFromStart }) => startCalls.push(distanceFromStart)
                            : undefined,
                        onStartReachedThreshold: 0.5,
                    },
                    queuedInitialLayout: false,
                    scroll: 0,
                    scrollLength: 474,
                },
            );

            checkThresholds(ctx);
            setDidLayout(ctx);
            ctx.state.scroll = 92;
            checkThresholds(ctx);

            expect(endCalls).toEqual([92]);
            expect(startCalls).toEqual(withStartCallback ? [0] : []);
        });
    }

    it("does not switch directly from start reached to end reached after an MVCP data shift", () => {
        const startCalls: number[] = [];
        const endCalls: number[] = [];
        const ctx = createMockContext(
            { footerSize: 0, headerSize: 0, stylePaddingTop: 0, totalSize: 3840 },
            {
                isEndReached: false,
                isStartReached: false,
                props: {
                    data: Array.from({ length: 12 }, (_, index) => ({ id: index })),
                    onEndReached: ({ distanceFromEnd }) => endCalls.push(distanceFromEnd),
                    onEndReachedThreshold: 0.25,
                    onStartReached: ({ distanceFromStart }) => startCalls.push(distanceFromStart),
                    onStartReachedThreshold: 0.25,
                },
                queuedInitialLayout: true,
                scroll: 223.5,
                scrollLength: 1409,
                totalSize: 3840,
            },
        );

        checkThresholds(ctx);

        expect(startCalls).toEqual([223.5]);
        expect(endCalls).toEqual([]);
        expect(ctx.state.edgeReachedGate).toBe("closed");

        // A six-item prepend moves the retained anchor by 1920px. This lands inside
        // the opposite threshold, but it is still part of the same reached gesture.
        ctx.state.scroll = 2143.5;
        checkThresholds(ctx);

        expect(startCalls).toEqual([223.5]);
        expect(endCalls).toEqual([]);
        expect(ctx.state.edgeReachedGate).toBe("closed");
        expect(ctx.state.isEndReached).toBe(false);
        expect(ctx.state.endReachedSnapshot).toBeUndefined();
    });
});
