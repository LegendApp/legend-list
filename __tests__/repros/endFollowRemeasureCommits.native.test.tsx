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

it("a re-measure while following the end commits only in its own frame", async () => {
    clock = installFakeClock();
    const now = spyOn(Date, "now").mockImplementation(() => clock.now);
    const perf = spyOn(performance, "now").mockImplementation(() => clock.now);
    const dispatch = spyOn(platformScroll, "doScrollTo").mockImplementation(doNativeScrollTo);
    restores.push(() => {
        dispatch.mockRestore();
        perf.mockRestore();
        now.mockRestore();
        clock.restore();
    });
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
