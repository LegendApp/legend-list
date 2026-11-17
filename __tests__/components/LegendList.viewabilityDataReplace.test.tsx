import * as React from "react";

import { afterEach, beforeEach, describe, expect, it, jest } from "bun:test";
import "../setup";

import { LegendList } from "../../src/components/LegendList";
import { Platform } from "../../src/platform/Platform";
import type { OnViewableItemsChangedInfo, ViewToken } from "../../src/types.base";
import { act, render } from "../helpers/testingLibrary";

// Replays a recorded app failure: 100 rows of 120 px in a 600 px viewport. While a
// minimumViewTime report is pending after scrollToIndex, the data is replaced so
// indices shift. Every token must take its key and item from the data current at
// the report, and a key must stay visible for the full minimumViewTime under that data.

type Row = { id: string };
type KeyMode = "id" | "index" | "none";

const ROW = 120;
const VIEWPORT = 600;
const VISIBLE_ROWS = VIEWPORT / ROW;
const rows = (prefix: string, count: number): Row[] =>
    Array.from({ length: count }, (_, i) => ({ id: `${prefix}-${i}` }));
const base = rows("row", 100);
const keyFor = (mode: KeyMode, item: Row, index: number) => (mode === "id" ? item.id : String(index));

let surface: any;
function scrollEvent(y: number) {
    surface.onScroll({
        nativeEvent: {
            contentOffset: { x: 0, y },
            contentSize: { height: base.length * ROW, width: 300 },
            layoutMeasurement: { height: VIEWPORT, width: 300 },
        },
        timeStamp: Date.now(),
    });
}
const Surface = React.forwardRef(function ReplaceSurface(props: any, ref: React.Ref<any>) {
    surface = props;
    React.useImperativeHandle(ref, () => ({
        getScrollableNode: () => null,
        measure: () => {},
        // The platform reports the imperative scroll a frame later.
        scrollTo: (options: { y: number }) => setTimeout(() => act(() => scrollEvent(options.y)), 16),
    }));
    return <>{props.children}</>;
});

async function run(keyMode: KeyMode, minimumViewTime: number, mutate: (data: Row[]) => Row[]) {
    let data = base;
    const reports: { at: number; data: Row[]; info: OnViewableItemsChangedInfo<Row> }[] = [];
    const ref = React.createRef<any>();
    const keyExtractor =
        keyMode === "id" ? (item: Row) => item.id : keyMode === "index" ? (_: Row, i: number) => String(i) : undefined;
    const tree = () => (
        <LegendList
            data={data}
            estimatedItemSize={ROW}
            keyExtractor={keyExtractor}
            maintainVisibleContentPosition={false}
            onViewableItemsChanged={(info) => reports.push({ at: Date.now(), data, info })}
            recycleItems
            ref={ref}
            renderItem={() => null}
            renderScrollComponent={(props) => <Surface {...props} />}
            viewabilityConfig={{ itemVisiblePercentThreshold: 50, minimumViewTime }}
        />
    );

    // Independent model of when each key became visible under the current data.
    const entered = new Map<string, number>();
    const firstVisible = () => Math.round(ref.current.getState().scroll / ROW);
    const sample = () => {
        const first = firstVisible();
        const seen = new Set<string>();
        for (let i = first; i < Math.min(data.length, first + VISIBLE_ROWS); i++) {
            const key = keyFor(keyMode, data[i], i);
            seen.add(key);
            if (!entered.has(key)) entered.set(key, Date.now());
        }
        for (const key of entered.keys()) if (!seen.has(key)) entered.delete(key);
    };
    const dwell: { key: string; observed: number }[] = [];
    let checkedReports = 0;
    const step = async (ms: number) => {
        for (let elapsed = 0; elapsed < ms; elapsed += 10) {
            await act(async () => {
                jest.advanceTimersByTime(10);
            });
            for (; checkedReports < reports.length; checkedReports++) {
                const { at, info } = reports[checkedReports];
                for (const token of info.changed) {
                    if (token.isViewable) dwell.push({ key: token.key, observed: at - (entered.get(token.key) ?? at) });
                }
            }
            sample();
        }
    };

    const rendered = render(tree());
    await step(10);
    act(() => surface.onLayout({ nativeEvent: { layout: { height: VIEWPORT, width: 300, x: 0, y: 0 } } }));
    await step(10);
    await act(async () => {
        void ref.current.scrollToIndex({ animated: false, index: 20 });
    });
    await step(500);
    const settled = reports.length;
    dwell.length = 0;
    await act(async () => {
        void ref.current.scrollToIndex({ animated: false, index: 25 });
    });
    await step(90);
    data = mutate(base);
    rendered.rerender(tree());
    sample();
    await step(550);

    const after = reports.slice(settled);
    const isMismatched = (token: ViewToken<Row>, snapshot: Row[]) =>
        token.item !== snapshot[token.index] || token.key !== keyFor(keyMode, token.item, token.index);
    const wrong = after.flatMap(({ data: snapshot, info }) =>
        info.viewableItems.filter((t) => isMismatched(t, snapshot)).map((t) => [t.key, t.item?.id, t.index]),
    );
    const first = firstVisible();
    const expected = data.slice(first, first + VISIBLE_ROWS).map((item, i) => keyFor(keyMode, item, first + i));
    const last = after.at(-1)?.info.viewableItems.map((t) => t.key);
    rendered.unmount();
    // Visibility is sampled every 10 ms, so a recorded entry can be one sample late.
    const early = minimumViewTime > 0 ? dwell.filter((d) => d.observed < minimumViewTime - 10) : [];
    return { early, expected, last, wrong };
}

const mutations: Record<string, (data: Row[]) => Row[]> = {
    "drop leading rows": (data) => data.slice(3),
    "prepend rows": (data) => [...rows("new", 3), ...data],
    "remove visible rows": (data) => [...data.slice(0, 26), ...data.slice(29)],
    "replace visible items": (data) => data.map((item, i) => (i >= 25 && i < 30 ? { id: `swap-${i}` } : item)),
};

describe("viewability across data replacement during a pending report", () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });
    afterEach(() => {
        Platform.OS = "ios";
        jest.useRealTimers();
    });

    it("reports the recorded repro from one data snapshot after a full dwell", async () => {
        const result = await run("id", 250, (data) => data.slice(3));
        expect(result.wrong).toEqual([]);
        expect(result.early).toEqual([]);
        expect(result.last).toEqual(["row-28", "row-29", "row-30", "row-31", "row-32"]);
    });

    for (const os of ["ios", "android", "web"] as const) {
        for (const minimumViewTime of [0, 250]) {
            for (const keyMode of ["id", "index", "none"] as const) {
                for (const [name, mutate] of Object.entries(mutations)) {
                    it(`${name} (${os}, keys=${keyMode}, minimumViewTime=${minimumViewTime})`, async () => {
                        Platform.OS = os;
                        const result = await run(keyMode, minimumViewTime, mutate);
                        expect(result.wrong).toEqual([]);
                        expect(result.early).toEqual([]);
                        // Without a keyExtractor a data change drops all layout; a real scroll view
                        // clamps to the emptied content, which this surface does not model.
                        if (keyMode !== "none") expect(result.last).toEqual(result.expected);
                    });
                }
            }
        }
    }
});
