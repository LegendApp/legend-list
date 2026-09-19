import { describe, expect, it } from "bun:test";
import "../setup";

import { updateScroll } from "../../src/core/updateScroll";
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
        it(`retains a pending gesture when the ${edge} callback is temporarily absent`, () => {
            const { ctx, start, end } = scenario(566, 474, "both", 0.1);
            const position = (offset: number) => (edge === "end" ? offset : 92 - offset);
            ctx.state.scroll = position(0);
            setDidLayout(ctx);
            prepareReachedEdgeForNextUserScroll(ctx);
            updateScroll(ctx, position(20), true, { fromNativeScrollEvent: true });
            const startCallback = ctx.state.props.onStartReached;
            const endCallback = ctx.state.props.onEndReached;
            if (edge === "start") ctx.state.props.onStartReached = undefined;
            else ctx.state.props.onEndReached = undefined;
            updateScroll(ctx, position(60), true, { fromNativeScrollEvent: true });
            expect(ctx.state.edgeReachedGate).toBe("prepared");
            const calls = edge === "end" ? end : start;
            expect(calls).toEqual([]);
            ctx.state.props.onStartReached = startCallback;
            ctx.state.props.onEndReached = endCallback;
            updateScroll(ctx, position(61), true, { fromNativeScrollEvent: true });
            expect(calls).toEqual([31]);
            expect(ctx.state.edgeReachedGate).toBe("closed");
        });

        it(`allows a gesture to reverse toward ${edge} before delivering a callback`, () => {
            const { ctx, start, end } = scenario(566, 474, "both", 0.1);
            const position = (offset: number) => (edge === "start" ? offset : 92 - offset);
            ctx.state.scroll = position(0);
            setDidLayout(ctx);
            prepareReachedEdgeForNextUserScroll(ctx);
            updateScroll(ctx, position(20), true, { fromNativeScrollEvent: true });
            const calls = edge === "start" ? start : end;
            expect(calls).toEqual([0]);
            updateScroll(ctx, position(10), true, { fromNativeScrollEvent: true });
            updateScroll(ctx, position(0), true, { fromNativeScrollEvent: true });
            expect(calls).toEqual([0, 10]);
            expect(edge === "start" ? end : start).toEqual([]);
        });
    }
    for (const edge of ["start", "end"] as const) {
        it(`preserves pending ${edge} eligibility across programmatic threshold checks`, () => {
            const { ctx, start, end } = scenario(566, 474, "both", 0.1);
            const position = (offset: number) => (edge === "end" ? offset : 92 - offset);
            ctx.state.scroll = position(0);
            setDidLayout(ctx);
            const calls = edge === "end" ? end : start;
            prepareReachedEdgeForNextUserScroll(ctx);
            updateScroll(ctx, position(20), true, { fromNativeScrollEvent: true });
            expect(ctx.state.edgeReachedGate).toBe("prepared");
            updateScroll(ctx, position(60), true);
            checkThresholds(ctx);
            expect(calls).toEqual([]);
            updateScroll(ctx, position(61), true, { fromNativeScrollEvent: true });
            expect(calls).toEqual([31]);
            expect(ctx.state.edgeReachedGate).toBe("closed");
            updateScroll(ctx, position(92), true, { fromNativeScrollEvent: true });
            checkThresholds(ctx);
            expect(calls).toEqual([31]);
        });
    }
    for (const steps of [1, 2, 4, 16]) {
        it(`reaches the end with ${steps} events in one short-list gesture`, () => {
            const { ctx, end } = scenario(566, 474, "both", 0.1);
            setDidLayout(ctx);
            prepareReachedEdgeForNextUserScroll(ctx);
            for (let i = 1; i <= steps; i++) {
                updateScroll(ctx, (92 * i) / steps, true, { fromNativeScrollEvent: true });
            }
            expect(end).toHaveLength(1);
            expect(end[0]).toBeGreaterThanOrEqual(0);
            expect(end[0]).toBeLessThanOrEqual(47.4);
        });
    }

    it("recovers after a failed short gesture when a later gesture starts inside the end window", () => {
        const { ctx, end } = scenario(566, 474, "both", 0.1);
        setDidLayout(ctx);
        prepareReachedEdgeForNextUserScroll(ctx);
        updateScroll(ctx, 20, true, { fromNativeScrollEvent: true });
        updateScroll(ctx, 80, true, { fromNativeScrollEvent: true });
        // A separate gesture must be eligible even if a prior gesture was suppressed.
        prepareReachedEdgeForNextUserScroll(ctx);
        updateScroll(ctx, 92, true, { fromNativeScrollEvent: true });
        expect(end.at(-1)).toBe(0);
    });

    for (const horizontal of [false, true]) {
        it(`accounts for headers, footers, padding, and insets (horizontal: ${horizontal})`, () => {
            const { ctx, end } = scenario(500, 474, "end", 0.1);
            ctx.state.props.horizontal = horizontal;
            ctx.values.set("headerSize", 20);
            ctx.values.set("footerSize", 30);
            ctx.state.props.contentInset = { bottom: 100, left: 0, right: 100, top: 0 };
            if (horizontal) {
                ctx.state.props.stylePaddingLeft = 10;
                ctx.state.props.stylePaddingRight = 6;
            } else {
                ctx.values.set("stylePaddingTop", 10);
                ctx.state.props.stylePaddingBottom = 6;
            }
            setDidLayout(ctx);
            expect(end).toEqual([]);
            updateScroll(ctx, 92, true, { fromNativeScrollEvent: true });
            expect(end).toEqual([0]);
        });
    }

    it("checks an expanded threshold without requiring a new gesture when no callback has fired", () => {
        const { ctx, end } = scenario(1000, 474, "end", 0.1);
        setDidLayout(ctx);
        ctx.state.props.onEndReachedThreshold = 2;
        checkThresholds(ctx);
        checkThresholds(ctx);
        expect(end).toEqual([526]);
    });

    it("does not let MVCP adjustment events consume prepared gesture eligibility", () => {
        const { ctx, start, end } = scenario();
        setDidLayout(ctx);
        prepareReachedEdgeForNextUserScroll(ctx);
        ctx.state.lastScrollAdjustForHistory = 0;
        ctx.state.scrollAdjustHandler.getAdjust = () => 20;
        updateScroll(ctx, 20, true, { fromNativeScrollEvent: true });
        expect(ctx.state.edgeReachedGate).toBe("prepared");
        expect(start).toHaveLength(1);
        expect(end).toHaveLength(1);
        updateScroll(ctx, 21, true, { fromNativeScrollEvent: true });
        expect(end).toHaveLength(2);
    });

    it("keeps a closed gate through direction reversal after notification", () => {
        const { ctx, start, end } = scenario();
        setDidLayout(ctx);
        prepareReachedEdgeForNextUserScroll(ctx);
        updateScroll(ctx, 20, true, { fromNativeScrollEvent: true });
        updateScroll(ctx, 10, true, { fromNativeScrollEvent: true });
        updateScroll(ctx, 30, true, { fromNativeScrollEvent: true });
        expect(start).toHaveLength(1);
        expect(end).toHaveLength(2);
    });

    it("does not redispatch recursively when a callback synchronously rechecks thresholds", () => {
        const { ctx, start, end } = scenario();
        ctx.state.props.onEndReached = ({ distanceFromEnd }) => {
            end.push(distanceFromEnd);
            checkThresholds(ctx);
        };
        setDidLayout(ctx);
        checkThresholds(ctx);
        expect(start).toEqual([0]);
        expect(end).toEqual([92]);
    });

    for (const edge of ["start", "end"] as const) {
        it(`delivers ${edge} when a new gesture enters the window after its first scroll event`, () => {
            const { ctx, start, end } = scenario(566, 474, "both", 0.1);
            ctx.state.scroll = edge === "end" ? 0 : 92;
            setDidLayout(ctx);
            const calls = edge === "end" ? end : start;
            expect(calls).toEqual([]);
            prepareReachedEdgeForNextUserScroll(ctx);
            updateScroll(ctx, edge === "end" ? 20 : 72, true, { fromNativeScrollEvent: true });
            expect(calls).toEqual([]);
            updateScroll(ctx, edge === "end" ? 92 : 0, true, { fromNativeScrollEvent: true });
            expect(calls).toEqual([0]);
        });

        it(`does not consume prepared ${edge} intent for same-offset or programmatic events`, () => {
            const { ctx, start, end } = scenario();
            ctx.state.scroll = 40;
            setDidLayout(ctx);
            prepareReachedEdgeForNextUserScroll(ctx);
            updateScroll(ctx, 40, true, { fromNativeScrollEvent: true });
            updateScroll(ctx, 41, true);
            expect(start).toHaveLength(1);
            expect(end).toHaveLength(1);
            expect(ctx.state.edgeReachedGate).toBe("prepared");
            updateScroll(ctx, edge === "end" ? 42 : 39, true, { fromNativeScrollEvent: true });
            expect(start).toHaveLength(edge === "start" ? 2 : 1);
            expect(end).toHaveLength(edge === "end" ? 2 : 1);
        });

        it(`uses the latest ${edge} callback on the next gesture without notifying just for replacement`, () => {
            const { ctx, start, end } = scenario();
            setDidLayout(ctx);
            const latest: number[] = [];
            if (edge === "start")
                ctx.state.props.onStartReached = ({ distanceFromStart }) => latest.push(distanceFromStart);
            else ctx.state.props.onEndReached = ({ distanceFromEnd }) => latest.push(distanceFromEnd);
            checkThresholds(ctx);
            expect(latest).toEqual([]);
            prepareReachedEdgeForNextUserScroll(ctx);
            checkThresholds(ctx, beginReachedEdgeUserScroll(ctx, edge === "start" ? -1 : 1));
            expect(latest).toEqual([edge === "start" ? 0 : 92]);
            expect(start).toEqual([0]);
            expect(end).toEqual([92]);
        });
    }
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
