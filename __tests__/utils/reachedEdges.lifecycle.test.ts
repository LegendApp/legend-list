import { describe, expect, it } from "bun:test";
import "../setup";

import { checkThresholds } from "../../src/utils/checkThresholds";
import { beginReachedEdgeUserScroll, prepareReachedEdgeForNextUserScroll } from "../../src/utils/edgeReachedGate";
import { setDidLayout } from "../../src/utils/setDidLayout";
import { resetInitialRenderState } from "../../src/utils/setInitialRenderState";
import { createMockContext } from "../__mocks__/createMockContext";

function scenario(size = 566, viewport = 474, callbacks = "both", threshold = 0.5) {
    const start: number[] = [];
    const end: number[] = [];
    const ctx = createMockContext(
        { footerSize: 0, headerSize: 0, stylePaddingTop: 0, totalSize: size },
        {
            props: {
                data: size ? Array.from({ length: 15 }, (_, id) => ({ id })) : [],
                onEndReached:
                    callbacks === "both" || callbacks === "end"
                        ? ({ distanceFromEnd }) => end.push(distanceFromEnd)
                        : undefined,
                onEndReachedThreshold: threshold,
                onStartReached:
                    callbacks === "both" || callbacks === "start"
                        ? ({ distanceFromStart }) => start.push(distanceFromStart)
                        : undefined,
                onStartReachedThreshold: threshold,
            },
            queuedInitialLayout: false,
            scroll: 0,
            scrollLength: viewport,
        },
    );
    return { ctx, end, start };
}

describe("reached edges lifecycle", () => {
    for (const edge of ["start", "end"] as const) {
        it(`honors exact threshold and hysteresis boundaries at ${edge}`, () => {
            const { ctx, start, end } = scenario(1000, 200, edge, 0.5);
            const setDistance = (distance: number) => {
                ctx.state.scroll = edge === "start" ? distance : 800 - distance;
            };
            const calls = edge === "start" ? start : end;
            setDistance(100.01);
            setDidLayout(ctx);
            expect(calls).toEqual([]);
            setDistance(100);
            checkThresholds(ctx);
            expect(calls).toEqual([100]);
            setDistance(129.99);
            checkThresholds(ctx);
            setDistance(100);
            checkThresholds(ctx);
            expect(calls).toEqual([100]);
            setDistance(130);
            checkThresholds(ctx);
            setDistance(100);
            checkThresholds(ctx);
            expect(calls).toEqual([100, 100]);
        });
    }

    for (const threshold of [0, -1]) {
        it(`does not enter a disabled threshold on scrollable content: ${threshold}`, () => {
            const { ctx, start, end } = scenario(566, 474, "both", threshold);
            setDidLayout(ctx);
            ctx.state.scroll = 92;
            checkThresholds(ctx);
            expect(start).toEqual([]);
            expect(end).toEqual([]);
        });
    }

    it("rearms a suppressed opposite edge on the next gesture with asymmetric thresholds", () => {
        const { ctx, start, end } = scenario();
        ctx.state.props.onStartReachedThreshold = 0.1;
        ctx.state.props.onEndReachedThreshold = 0.05;
        setDidLayout(ctx);
        expect(start).toEqual([0]);
        ctx.state.scroll = 92;
        checkThresholds(ctx);
        expect(end).toEqual([]);
        expect(ctx.state.isEndReached).toBe(false);
        prepareReachedEdgeForNextUserScroll(ctx);
        checkThresholds(ctx, beginReachedEdgeUserScroll(ctx, 1));
        checkThresholds(ctx);
        expect(end).toEqual([0]);
    });

    for (const resetLayout of [false, true]) {
        it(`resets edge notifications only for fresh layout, resetLayout: ${resetLayout}`, () => {
            const { ctx, start, end } = scenario();
            setDidLayout(ctx);
            resetInitialRenderState(ctx, { resetInitialScroll: true, resetLayout });
            if (resetLayout) {
                expect(ctx.state.edgeReachedGate).toBeUndefined();
                expect(ctx.state.startReachedSnapshot).toBeUndefined();
                expect(ctx.state.endReachedSnapshot).toBeUndefined();
                checkThresholds(ctx);
                expect(start).toHaveLength(1);
                expect(end).toHaveLength(1);
            }
            setDidLayout(ctx);
            checkThresholds(ctx);
            expect(start).toHaveLength(resetLayout ? 2 : 1);
            expect(end).toHaveLength(resetLayout ? 2 : 1);
        });
    }
    for (const size of [0, 100, 474, 566, 987, 3000]) {
        for (const callbacks of ["none", "start", "end", "both"]) {
            it(`initial layout: content ${size}, callbacks ${callbacks}`, () => {
                const { ctx, start, end } = scenario(size, 474, callbacks);
                checkThresholds(ctx);
                checkThresholds(ctx);
                expect(start).toEqual([]);
                expect(end).toEqual([]);
                expect(ctx.state.edgeReachedGate).toBeUndefined();

                setDidLayout(ctx);
                checkThresholds(ctx);
                checkThresholds(ctx);
                expect(start).toEqual(callbacks === "start" || callbacks === "both" ? [0] : []);
                expect(end).toEqual(
                    size > 0 && size <= 711 && (callbacks === "end" || callbacks === "both") ? [size - 474] : [],
                );
            });
        }
    }

    for (const layoutFirst of [false, true]) {
        it(`waits for layout and initial scroll, layout first: ${layoutFirst}`, () => {
            const { ctx, start, end } = scenario();
            ctx.state.initialScroll = { index: 14, viewPosition: 1 };
            checkThresholds(ctx);
            if (layoutFirst) setDidLayout(ctx);
            else ctx.state.didFinishInitialScroll = true;
            checkThresholds(ctx);
            expect(start).toEqual([]);
            expect(end).toEqual([]);
            ctx.state.scroll = 92;
            if (layoutFirst) ctx.state.didFinishInitialScroll = true;
            else setDidLayout(ctx);
            checkThresholds(ctx);
            checkThresholds(ctx);
            expect(start).toEqual([92]);
            expect(end).toEqual([0]);
        });
    }

    for (const edge of ["start", "end"] as const) {
        it(`allows a ${edge} callback registered after layout`, () => {
            const { ctx } = scenario(566, 474, "none");
            setDidLayout(ctx);
            const calls: number[] = [];
            if (edge === "start")
                ctx.state.props.onStartReached = ({ distanceFromStart }) => calls.push(distanceFromStart);
            else ctx.state.props.onEndReached = ({ distanceFromEnd }) => calls.push(distanceFromEnd);
            checkThresholds(ctx);
            checkThresholds(ctx);
            expect(calls).toEqual([edge === "start" ? 0 : 92]);
        });

        it(`only rearms ${edge} on repeated explicit gestures with overlapping windows`, () => {
            const { ctx, start, end } = scenario();
            setDidLayout(ctx);
            for (let i = 0; i < 3; i++) {
                prepareReachedEdgeForNextUserScroll(ctx);
                const allowed = beginReachedEdgeUserScroll(ctx, edge === "start" ? -1 : 1);
                checkThresholds(ctx, allowed);
                checkThresholds(ctx);
                checkThresholds(ctx, beginReachedEdgeUserScroll(ctx, edge === "start" ? -1 : 1));
            }
            expect(start).toHaveLength(edge === "start" ? 4 : 1);
            expect(end).toHaveLength(edge === "end" ? 4 : 1);
        });
    }

    it("delivers the first end notification when an empty list receives data", () => {
        const { ctx, end } = scenario(0, 474, "end");
        setDidLayout(ctx);
        expect(end).toEqual([]);
        ctx.state.props.data = [{ id: 1 }];
        ctx.state.totalSize = 100;
        checkThresholds(ctx);
        checkThresholds(ctx);
        expect(end).toEqual([-374]);
    });

    for (const change of ["append", "prepend", "shrink", "resize", "inset"] as const) {
        it(`does not duplicate a delivered event after ${change} within overlapping windows`, () => {
            const { ctx, start, end } = scenario();
            setDidLayout(ctx);
            if (change === "append" || change === "prepend") {
                ctx.state.props.data =
                    change === "prepend"
                        ? [{ id: 15 }, ...ctx.state.props.data]
                        : [...ctx.state.props.data, { id: 15 }];
                ctx.state.totalSize += 50;
                if (change === "prepend") ctx.state.scroll += 50;
            } else if (change === "shrink") ctx.state.totalSize = 100;
            else if (change === "resize") ctx.state.scrollLength = 600;
            else ctx.state.props.contentInset = { bottom: 100, left: 0, right: 0, top: 0 };
            checkThresholds(ctx);
            checkThresholds(ctx);
            expect(start).toEqual([0]);
            expect(end).toEqual([92]);
        });
    }

    for (const change of ["shrink", "resize"]) {
        it(`delivers a previously unreached end after ${change}`, () => {
            const { ctx, end } = scenario(1000, 474, "end");
            setDidLayout(ctx);
            expect(end).toEqual([]);
            if (change === "shrink") ctx.state.totalSize = 566;
            else ctx.state.scrollLength = 800;
            checkThresholds(ctx);
            checkThresholds(ctx);
            expect(end).toEqual([change === "shrink" ? 92 : 200]);
        });
    }

    for (const viewport of [314, 474]) {
        for (const threshold of [0.1, 0.5, 2]) {
            it(`short grid end-only: viewport ${viewport}, threshold ${threshold}`, () => {
                const { ctx, end } = scenario(566, viewport, "end", threshold);
                setDidLayout(ctx);
                const initialDistance = 566 - viewport;
                const expectedDistance = initialDistance <= threshold * viewport ? initialDistance : 0;
                ctx.state.scroll = initialDistance;
                checkThresholds(ctx);
                checkThresholds(ctx);
                expect(end).toEqual([expectedDistance]);
            });
        }
    }
});
