import * as React from "react";
import { Text } from "react-native";

import { afterEach, expect, it, spyOn } from "bun:test";
import "../setup";

import { LegendList } from "../../src/components/LegendList";
import * as platformScroll from "../../src/core/doScrollTo";
import { doScrollTo as doNativeScrollTo } from "../../src/core/doScrollTo.native";
import { updateItemSizesBatch } from "../../src/core/updateItemSizes";
import { getContentSize } from "../../src/state/getContentSize";
import { peek$, type StateContext, useStateContext } from "../../src/state/state";
import type { LegendListRef } from "../../src/types";
import { act, render } from "../helpers/testingLibrary";
import { installFakeClock } from "../helpers/webScrollHarness";

// The last row re-measures while instant end following owns the viewport. Every React commit
// belongs to the re-measure's own frame: the end hold lands there, and when a follow does move
// the list, releasing its pinned render range must not re-render containers on a later frame.
const VIEWPORT = 600;
const rows = Array.from({ length: 20 }, (_, index) => ({ height: 80 + ((index * 37) % 90), id: String(index) }));
const sizes = new Map(rows.map((row) => [row.id, row.height]));
const last = rows[rows.length - 1].id;

let clock: ReturnType<typeof installFakeClock>;
let ctx: StateContext;
let scrollProps: any;
let commits = 0;
let scroll = 0;
let appliedAdjust = 0;
let pendingScroll: number | undefined;
const restores: (() => void)[] = [];

afterEach(() => {
    for (const restore of restores.splice(0)) restore();
});

const Surface = React.forwardRef(function ScrollSurface(props: any, ref: React.Ref<any>) {
    ctx = useStateContext();
    scrollProps = props;
    React.useImperativeHandle(ref, () => ({
        getScrollableNode: () => null,
        getScrollResponder() {
            return this;
        },
        measure: () => {},
        scrollTo: ({ y }: { y: number }) => {
            pendingScroll = y;
        },
    }));
    return <>{props.children}</>;
});

function observe() {
    scrollProps.onScroll({
        nativeEvent: {
            contentOffset: { x: 0, y: scroll },
            contentSize: { height: getContentSize(ctx), width: 400 },
            layoutMeasurement: { height: VIEWPORT, width: 400 },
        },
        timeStamp: clock.now,
    });
}

// One native frame: report changed rows, apply the MVCP adjust and scroll command, then advance.
// Returns the React commits made during the frame.
async function frame(before?: () => void) {
    const start = commits;
    await act(async () => {
        before?.();
        const measurements: { itemKey: string; size: { height: number; width: number } }[] = [];
        for (let i = 0; i < (peek$(ctx, "numContainers") ?? 0); i++) {
            const key = peek$(ctx, `containerItemKey${i}`);
            const height = key === undefined ? undefined : sizes.get(key);
            if (height !== undefined && ctx.state.sizesKnown.get(key!) !== height) {
                measurements.push({ itemKey: key!, size: { height, width: 400 } });
            }
        }
        if (measurements.length) updateItemSizesBatch(ctx, measurements);
        const adjust = peek$(ctx, "scrollAdjust") ?? 0;
        if (adjust !== appliedAdjust) {
            scroll += adjust - appliedAdjust;
            appliedAdjust = adjust;
            observe();
        }
        if (pendingScroll !== undefined) {
            scroll = pendingScroll;
            pendingScroll = undefined;
            observe();
        }
        clock.advance(16);
    });
    return commits - start;
}

// Grows the last row, then returns the commits made on each later frame until things settle.
async function remeasure(growth: number, before?: () => void) {
    sizes.set(last, sizes.get(last)! + growth);
    expect(await frame(before)).toBeGreaterThan(0);
    const later: number[] = [];
    for (let i = 0; i < 20; i++) later.push(await frame());
    return later.filter(Boolean);
}

function installNativeClock() {
    clock = installFakeClock();
    scroll = 0;
    appliedAdjust = 0;
    pendingScroll = undefined;
    const now = spyOn(Date, "now").mockImplementation(() => clock.now);
    const perf = spyOn(performance, "now").mockImplementation(() => clock.now);
    const dispatch = spyOn(platformScroll, "doScrollTo").mockImplementation(doNativeScrollTo);
    restores.push(() => {
        dispatch.mockRestore();
        perf.mockRestore();
        now.mockRestore();
        clock.restore();
    });
}

it("a re-measure while following the end commits only in its own frame", async () => {
    installNativeClock();
    const ref = React.createRef<any>();
    const rendered = render(
        <React.Profiler id="follow" onRender={() => commits++}>
            <LegendList
                data={rows}
                estimatedItemSize={100}
                initialScrollAtEnd
                keyExtractor={(row) => row.id}
                maintainScrollAtEnd={{ animated: false, on: { itemLayout: true } }}
                maintainVisibleContentPosition
                recycleItems={false}
                ref={ref}
                renderItem={({ item }) => <Text>{item.id}</Text>}
                renderScrollComponent={(props: any) => <Surface {...props} />}
            />
        </React.Profiler>,
    );
    act(() => scrollProps.onLayout({ nativeEvent: { layout: { height: VIEWPORT, width: 400, x: 0, y: 0 } } }));
    for (let i = 0; i < 40; i++) await frame();
    const end = () => getContentSize(ctx) - VIEWPORT;
    expect(ctx.state.didFinishInitialScroll).toBe(true);
    expect(scroll).toBeCloseTo(end(), 3);

    // The end hold lands at the new end in the re-measure's pass; the follow then has nothing to move.
    expect(await remeasure(40)).toEqual([]);
    expect(scroll).toBeCloseTo(end(), 3);

    // With an end command in flight the follow moves the list instead. Once it arrives, releasing
    // its pinned range used to write sticky=false to containers that were never sticky.
    expect(await remeasure(20, () => void ref.current.scrollToEnd({ animated: false }))).toEqual([]);
    expect(scroll).toBeCloseTo(end(), 3);
    rendered.unmount();
});

// Known 3.x bug: the fresh-data lifecycle clears end following on refill, so the list reopens at 0.
(it as typeof it & { failing: typeof it }).failing(
    "keeps a pinned list at the end from the first painted frame after emptying and refilling",
    async () => {
        installNativeClock();
        const initial = Array.from({ length: 40 }, (_, index) => ({ id: `refill-${index}` }));
        for (const row of initial) sizes.set(row.id, 120);
        const ref = React.createRef<LegendListRef>();
        const refillCommits: boolean[] = [];
        const pinned = { distanceFromEnd: 0, isAtEnd: true };
        let refilling = false;
        const keyExtractor = (row: { id: string }) => row.id;
        const renderList = (data: typeof initial) => (
            <React.Profiler
                id="refill"
                onRender={() => {
                    if (refilling) refillCommits.push(ref.current!.getState().isAtEnd);
                }}
            >
                <LegendList
                    data={data}
                    estimatedItemSize={120}
                    keyExtractor={keyExtractor}
                    maintainScrollAtEnd
                    maintainVisibleContentPosition={false}
                    recycleItems
                    ref={ref}
                    renderItem={({ item }) => <Text style={{ height: 120 }}>{item.id}</Text>}
                    renderScrollComponent={(props: any) => <Surface {...props} />}
                />
            </React.Profiler>
        );

        const rendered = render(renderList(initial));
        act(() => scrollProps.onLayout({ nativeEvent: { layout: { height: VIEWPORT, width: 400, x: 0, y: 0 } } }));
        for (let i = 0; i < 40; i++) await frame();
        let scrollToEnd: Promise<void>;
        act(() => {
            scrollToEnd = ref.current!.scrollToEnd({ animated: false });
        });
        for (let i = 0; i < 40; i++) await frame();
        await scrollToEnd!;
        expect(ref.current!.getState()).toMatchObject(pinned);
        expect(scroll).toBe(4200);

        rendered.rerender(renderList([]));
        act(() => {
            scroll = 0;
            observe();
        });
        for (let i = 0; i < 38; i++) await frame();
        expect(ref.current!.getState()).toMatchObject(pinned);

        refilling = true;
        rendered.rerender(renderList(initial.map((row) => ({ ...row }))));
        await frame();
        const firstFrame = ref.current!.getState();
        // Native keeps the fresh layer hidden until its placement lands.
        for (let i = 0; i < 8 && !peek$(ctx, "readyToRender"); i++) await frame();
        expect(peek$(ctx, "readyToRender")).toBe(true);
        const firstPaint = ref.current!.getState();
        const firstPaintScroll = scroll;
        for (let i = 0; i < 94; i++) await frame();
        const settled = ref.current!.getState();

        const readPin = ({ distanceFromEnd, isAtEnd }: typeof firstPaint) => ({ distanceFromEnd, isAtEnd });
        expect({
            commits: [...new Set(refillCommits)],
            firstFrame: readPin(firstFrame),
            firstPaint: { ...readPin(firstPaint), end: firstPaint.end },
            firstPaintScroll,
            settled: readPin(settled),
            settledScroll: scroll,
        }).toEqual({
            commits: [true],
            firstFrame: pinned,
            firstPaint: { ...pinned, end: 39 },
            firstPaintScroll: 4200,
            settled: pinned,
            settledScroll: 4200,
        });
        rendered.unmount();
    },
);
