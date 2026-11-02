import { describe, expect, it } from "bun:test";
import "../setup";

import { setFooterSize } from "../../src/core/updateContentMetrics";
import { checkThresholds } from "../../src/utils/checkThresholds";
import { createImperativeHandle } from "../../src/utils/createImperativeHandle";
import { beginReachedEdgeUserScroll, prepareReachedEdgeForNextUserScroll } from "../../src/utils/edgeReachedGate";
import { setDidLayout } from "../../src/utils/setDidLayout";
import { createMockContext } from "../__mocks__/createMockContext";

describe("checkThresholds", () => {
    for (const edge of ["end", "start"] as const) {
        function shortList() {
            const calls: number[] = [];
            const ctx = createMockContext(
                { totalSize: 128 },
                {
                    props: {
                        data: [{ id: "0" }, { id: "1" }],
                        onEndReached: edge === "end" ? ({ distanceFromEnd }) => calls.push(distanceFromEnd) : undefined,
                        onStartReached:
                            edge === "start" ? ({ distanceFromStart }) => calls.push(distanceFromStart) : undefined,
                    },
                    queuedInitialLayout: true,
                    scrollLength: 800,
                },
            );
            checkThresholds(ctx);
            expect(calls).toHaveLength(1);
            return { calls, ctx };
        }

        it(`${edge}: does not fire again for content size 128 -> 143 with unchanged keys and data length`, () => {
            const { calls, ctx } = shortList();
            for (const size of [15, 0, 15]) {
                setFooterSize(ctx, size);
                checkThresholds(ctx);
            }
            expect(calls).toEqual(edge === "end" ? [-672] : [0]);
        });

        it(`${edge}: does not fire when data length changes from 2 -> 0 with content size 128 -> 0`, () => {
            const { calls, ctx } = shortList();
            ctx.state.props.data = [];
            ctx.values.set("totalSize", 0);
            checkThresholds(ctx);
            checkThresholds(ctx);
            expect(calls).toHaveLength(1);
        });

        it(`${edge}: does not re-fire for a new data reference with unchanged length and size`, () => {
            const { calls, ctx } = shortList();
            ctx.state.props.data = ctx.state.props.data.concat([]);
            checkThresholds(ctx);
            checkThresholds(ctx);
            expect(calls).toHaveLength(1);
        });

        it(`${edge}: does not loop replacements with unchanged keys and size`, () => {
            const { calls, ctx } = shortList();
            for (let i = 0; i < 20; i++) {
                ctx.state.props.data = ctx.state.props.data.map((item) => ({ ...item }));
                checkThresholds(ctx);
                checkThresholds(ctx);
            }
            expect(calls).toHaveLength(1);
        });

        it(`${edge}: fires once for a data length change even if content size is unchanged`, () => {
            const { calls, ctx } = shortList();
            ctx.state.props.data = [{ id: "0" }];
            checkThresholds(ctx);
            checkThresholds(ctx);
            expect(calls).toHaveLength(2);
        });
    }

    it.each(["start", "end"] as const)("preserves the latest %s admission through nested data changes", (edge) => {
        const calls: number[] = [];
        const callback = () => {
            calls.push(ctx.state.props.data.length);
            if (calls.length === 1) {
                ctx.state.props.data = [...ctx.state.props.data, { id: "2" }];
                checkThresholds(ctx);
            }
        };
        const ctx = createMockContext(
            { totalSize: 128 },
            {
                props: {
                    data: [{ id: "0" }, { id: "1" }],
                    onEndReached: edge === "end" ? callback : undefined,
                    onStartReached: edge === "start" ? callback : undefined,
                },
                queuedInitialLayout: true,
                scrollLength: 800,
            },
        );
        try {
            checkThresholds(ctx);
            checkThresholds(ctx);
            expect(calls).toEqual([2, 3]);
            expect(ctx.state[edge === "start" ? "startReachedSnapshot" : "endReachedSnapshot"]).toMatchObject({
                data: ctx.state.props.data,
                dataLength: 3,
            });
        } finally {
            ctx.state.scheduledWork.dispose();
        }
    });

    it("measures start distance from the top inset and ignores size changes without scrolling", () => {
        const calls: number[] = [];
        const ctx = createMockContext(
            { totalSize: 128 },
            {
                props: {
                    contentInset: { bottom: 0, left: 0, right: 0, top: 200 },
                    data: [{ id: "0" }, { id: "1" }],
                    onStartReached: ({ distanceFromStart }) => calls.push(distanceFromStart),
                },
                queuedInitialLayout: true,
                scroll: -200,
                scrollLength: 800,
            },
        );
        checkThresholds(ctx);
        setFooterSize(ctx, 15);
        checkThresholds(ctx);
        checkThresholds(ctx);
        expect(calls).toEqual([0]);
        expect(ctx.state.startReachedSnapshot).toMatchObject({ data: ctx.state.props.data, dataLength: 2 });
        expect(ctx.values.get("isAtStart")).toBe(true);
    });

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
    it("rearms changed data after a footer briefly leaves the end threshold", () => {
        const endCalls: number[] = [];
        const ctx = createMockContext(
            { footerSize: 0, totalSize: 1500 },
            {
                props: {
                    data: Array.from({ length: 10 }, (_, id) => ({ id })),
                    onEndReached: ({ distanceFromEnd }) => endCalls.push(distanceFromEnd),
                    onEndReachedThreshold: 0.1,
                },
                queuedInitialLayout: true,
                scroll: 1000,
                scrollLength: 500,
            },
        );
        checkThresholds(ctx);
        expect(endCalls).toEqual([0]);
        setFooterSize(ctx, 60);
        expect(ctx.state.isEndReached).toBe(false);
        expect(ctx.state.edgeReachedGate).toBe("closed");
        setFooterSize(ctx, 0);
        expect(endCalls).toEqual([0]);
        ctx.state.props.data = [...ctx.state.props.data, { id: 10 }];
        ctx.values.set("totalSize", 1520);
        checkThresholds(ctx);
        checkThresholds(ctx);
        expect(endCalls).toEqual([0, 20]);
        ctx.state.scheduledWork.dispose();
    });

    it.each(["start", "end"] as const)("records the changed %s length before a callback cancels scrolling", (edge) => {
        let calls = 0;
        let reenter = false;
        const callback = () => {
            calls++;
            if (reenter && calls < 5) handle.cancelScroll();
        };
        const ctx = createMockContext(
            { totalSize: 1500 },
            {
                props: {
                    data: Array.from({ length: 10 }, (_, id) => ({ id })),
                    onEndReached: edge === "end" ? callback : undefined,
                    onEndReachedThreshold: 0.1,
                    onStartReached: edge === "start" ? callback : undefined,
                    onStartReachedThreshold: 0.1,
                },
                queuedInitialLayout: true,
                scroll: edge === "end" ? 1000 : 0,
                scrollLength: 500,
            },
        );
        const handle = createImperativeHandle(ctx);
        checkThresholds(ctx);
        expect(calls).toBe(1);
        ctx.state.props.data = [...ctx.state.props.data, { id: 10 }];
        ctx.values.set("totalSize", 1520);
        reenter = true;
        checkThresholds(ctx);
        expect(calls).toBe(2);
        ctx.state.scheduledWork.dispose();
    });

    it("does not retain opposite-edge eligibility across a full threshold departure", () => {
        let startCalls = 0;
        let endCalls = 0;
        const ctx = createMockContext(
            { totalSize: 1500 },
            {
                props: {
                    data: Array.from({ length: 10 }, (_, id) => ({ id })),
                    onEndReached: () => endCalls++,
                    onEndReachedThreshold: 0.1,
                    onStartReached: () => startCalls++,
                    onStartReachedThreshold: 0.1,
                },
                queuedInitialLayout: true,
                scroll: 0,
                scrollLength: 500,
            },
        );
        checkThresholds(ctx);
        expect(startCalls).toBe(1);
        prepareReachedEdgeForNextUserScroll(ctx);
        ctx.state.scroll = 1000;
        checkThresholds(ctx, beginReachedEdgeUserScroll(ctx, 1000));
        expect(endCalls).toBe(1);
        ctx.state.props.data = [...ctx.state.props.data, { id: 10 }];
        ctx.values.set("totalSize", 1520);
        ctx.state.scroll = 0;
        checkThresholds(ctx);
        expect(startCalls).toBe(1);
        expect(endCalls).toBe(1);
        ctx.state.scheduledWork.dispose();
    });

    it("delivers each eligible short-list edge once per new length without ping-pong", () => {
        let startCalls = 0;
        let endCalls = 0;
        const ctx = createMockContext(
            { totalSize: 100 },
            {
                props: {
                    data: [{ id: 0 }],
                    onEndReached: () => endCalls++,
                    onEndReachedThreshold: 0.5,
                    onStartReached: () => startCalls++,
                    onStartReachedThreshold: 0.5,
                },
                queuedInitialLayout: true,
                scroll: 0,
                scrollLength: 500,
            },
        );
        checkThresholds(ctx);
        expect([startCalls, endCalls]).toEqual([1, 1]);
        ctx.state.props.data = [...ctx.state.props.data, { id: 1 }];
        ctx.values.set("totalSize", 120);
        for (let i = 0; i < 10; i++) checkThresholds(ctx);
        setFooterSize(ctx, 30);
        setFooterSize(ctx, 0);
        expect([startCalls, endCalls]).toEqual([2, 2]);
        ctx.state.scheduledWork.dispose();
    });
});
