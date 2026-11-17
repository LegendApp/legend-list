import * as React from "react";

import { afterEach, beforeEach, describe, expect, it, jest } from "bun:test";
import "../setup";

import { LegendList } from "../../src/components/LegendList";
import { Platform } from "../../src/platform/Platform";
import { type StateContext, useStateContext } from "../../src/state/state";
import type {
    OnViewableItemsChangedInfo,
    ViewabilityConfig,
    ViewabilityConfigCallbackPairs,
} from "../../src/types.base";
import { act, render } from "../helpers/testingLibrary";

let surface: any;
let ctx: StateContext;
let surfaceSetups = 0;
const Surface = React.forwardRef(function DwellSurface(props: any, ref: React.Ref<any>) {
    ctx = useStateContext();
    surface = props;
    React.useLayoutEffect(() => {
        surfaceSetups++;
    }, []);
    React.useImperativeHandle(ref, () => ({
        measure: (callback: (...args: number[]) => void) => {
            if (props.synchronousLayout) callback(0, 0, 200, 200);
        },
        scrollTo: () => {},
    }));
    return <>{props.children}</>;
});
const initialData = Array.from({ length: 12 }, (_, index) => ({ id: String(index), revision: 0 }));
const config = { itemVisiblePercentThreshold: 50, minimumViewTime: 250 };

async function advance(ms: number) {
    await act(async () => {
        jest.advanceTimersByTime(ms);
    });
}

async function mount({ horizontal = false, columns = 1, strict = false, synchronousLayout = false } = {}) {
    const calls: OnViewableItemsChangedInfo<(typeof initialData)[number]>[] = [];
    let data = initialData;
    let currentConfig: ViewabilityConfig | undefined = config;
    let pairs: ViewabilityConfigCallbackPairs | undefined;
    let callback: ((info: OnViewableItemsChangedInfo<(typeof initialData)[number]>) => void) | undefined = (info) =>
        calls.push(info);
    const tree = () => {
        const list = (
            <LegendList
                data={data}
                estimatedItemSize={100}
                getFixedItemSize={() => 100}
                horizontal={horizontal}
                keyExtractor={(item) => item.id}
                numColumns={columns}
                onViewableItemsChanged={callback}
                recycleItems={false}
                renderItem={() => null}
                renderScrollComponent={(props) => <Surface {...props} synchronousLayout={synchronousLayout} />}
                viewabilityConfig={currentConfig}
                viewabilityConfigCallbackPairs={pairs}
            />
        );
        return strict ? <React.StrictMode>{list}</React.StrictMode> : list;
    };
    const rendered = render(tree());
    await advance(1);
    if (!synchronousLayout) {
        act(() => surface.onLayout({ nativeEvent: { layout: { height: 200, width: 200, x: 0, y: 0 } } }));
    }
    await advance(1);
    return {
        calls,
        configure(next: ViewabilityConfig | undefined, nextPairs = pairs) {
            currentConfig = next;
            pairs = nextPairs;
            rendered.rerender(tree());
        },
        ctx,
        rendered,
        replace(next: typeof initialData, nextCallback: typeof callback = callback) {
            data = next;
            callback = nextCallback;
            rendered.rerender(tree());
        },
        scroll(offset: number) {
            act(() =>
                surface.onScroll({
                    nativeEvent: {
                        contentOffset: { x: horizontal ? offset : 0, y: horizontal ? 0 : offset },
                        contentSize: { height: 1200, width: horizontal ? 1200 : 200 },
                        layoutMeasurement: { height: 200, width: 200 },
                    },
                    timeStamp: Date.now(),
                }),
            );
        },
        setCallback(next: typeof callback) {
            callback = next;
            rendered.rerender(tree());
        },
    };
}

describe("mounted minimumViewTime", () => {
    beforeEach(() => {
        Platform.OS = "ios";
        jest.useFakeTimers();
    });
    afterEach(() => {
        Platform.OS = "ios";
        jest.useRealTimers();
    });

    // The controlled surface exercises list effects and real scroll/range calculation.
    // Browser-engine layout and native UI-thread delivery need separate runtime checks.
    for (const os of ["ios", "android", "web"] as const) {
        for (const horizontal of [false, true]) {
            it(`does not borrow another row's pending dwell (${os}, horizontal=${horizontal})`, async () => {
                Platform.OS = os;
                const list = await mount({ horizontal });
                await advance(190);
                list.scroll(100);
                await advance(70);
                expect(
                    list.calls.flatMap((info) => info.changed.filter((token) => token.isViewable).map((t) => t.key)),
                ).toEqual(["1"]);
                await advance(180);
                expect(list.calls.at(-1)!.viewableItems.map((token) => token.key)).toEqual(["1", "2"]);
                list.rendered.unmount();
            });
        }
    }

    it("keeps column peers on separate keys with the same row deadline", async () => {
        const list = await mount({ columns: 2 });
        await advance(190);
        list.scroll(100);
        await advance(70);
        expect(list.calls[0].viewableItems.map((token) => token.key)).toEqual(["2", "3"]);
        await advance(180);
        expect(list.calls.at(-1)!.viewableItems.map((token) => token.key)).toEqual(["2", "3", "4", "5"]);
        list.rendered.unmount();
    });

    it("survives StrictMode effect replay and cancels pending reports on unmount", async () => {
        const setupsBefore = surfaceSetups;
        const list = await mount({ strict: true });
        expect(surfaceSetups - setupsBefore).toBe(2);
        await advance(260);
        expect(list.calls[0].viewableItems.map((token) => token.key)).toEqual(["0", "1"]);
        list.scroll(100);
        const reports = list.calls.length;
        list.rendered.unmount();
        await advance(1000);
        expect(list.calls).toHaveLength(reports);
        expect(list.ctx.state.isUnmounted).toBe(true);
        expect(list.ctx.state.scheduledWork.has("viewabilityundefined")).toBe(false);
    });

    it("resolves replacement data and callback during a mounted pending report", async () => {
        const list = await mount();
        await advance(190);
        const latest: OnViewableItemsChangedInfo[] = [];
        list.replace(
            initialData.map((item) => ({ ...item, revision: 1 })),
            (info) => latest.push(info),
        );
        await advance(70);
        expect(list.calls).toEqual([]);
        expect(latest[0].viewableItems.map((token) => [token.key, token.index, token.item.revision])).toEqual([
            ["0", 0, 1],
            ["1", 1, 1],
        ]);
        list.rendered.unmount();
    });

    it.each([0, 100, 500, Number.POSITIVE_INFINITY])(
        "applies replacement minimumViewTime %s without scrolling",
        async (minimumViewTime) => {
            const list = await mount();
            await advance(190);
            list.configure({ ...config, minimumViewTime });
            if (minimumViewTime <= 100) {
                expect(list.calls[0].viewableItems.map((token) => token.key)).toEqual(["0", "1"]);
            } else {
                await advance(70);
                expect(list.calls).toEqual([]);
                if (Number.isFinite(minimumViewTime)) {
                    await advance(250);
                    expect(list.calls[0].viewableItems.map((token) => token.key)).toEqual(["0", "1"]);
                } else {
                    expect(list.ctx.state.scheduledWork.has("viewabilityundefined")).toBe(false);
                    list.configure({ ...config, minimumViewTime: 100 });
                    expect(list.calls[0].viewableItems.map((token) => token.key)).toEqual(["0", "1"]);
                }
            }
            list.rendered.unmount();
        },
    );

    it("uses replacement thresholds rather than a cached amount while a report is pending", async () => {
        const list = await mount();
        list.scroll(60);
        await advance(190);
        // Row 0 is 40% visible. The lower threshold starts its dwell now.
        list.configure({ ...config, itemVisiblePercentThreshold: 25 });
        await advance(70);
        expect(list.calls.at(-1)!.viewableItems.map((token) => token.key)).toEqual(["1", "2"]);
        await advance(180);
        expect(list.calls.at(-1)!.viewableItems.map((token) => token.key)).toEqual(["0", "1", "2"]);
        list.rendered.unmount();
    });

    it("refreshes callback pairs independently while their reports are pending", async () => {
        const list = await mount();
        const old: OnViewableItemsChangedInfo[] = [];
        const fast: OnViewableItemsChangedInfo[] = [];
        const slow: OnViewableItemsChangedInfo[] = [];
        const fastConfig = { ...config, id: "fast" };
        const slowConfig = { ...config, id: "slow", minimumViewTime: 500 };
        list.configure(undefined, [
            { onViewableItemsChanged: (info) => old.push(info), viewabilityConfig: fastConfig },
            { onViewableItemsChanged: (info) => old.push(info), viewabilityConfig: slowConfig },
        ]);
        list.scroll(100);
        await advance(190);
        list.configure(undefined, [
            { onViewableItemsChanged: (info) => fast.push(info), viewabilityConfig: fastConfig },
            { onViewableItemsChanged: (info) => slow.push(info), viewabilityConfig: slowConfig },
        ]);
        await advance(70);
        expect(old).toEqual([]);
        expect(fast[0].viewableItems.map((token) => token.key)).toEqual(["1", "2"]);
        expect(slow).toEqual([]);
        await advance(250);
        expect(slow[0].viewableItems.map((token) => token.key)).toEqual(["1", "2"]);
        list.rendered.unmount();
    });

    it.each([false, true])("cancels the first pending report on unmount (StrictMode %s)", async (strict) => {
        const list = await mount({ strict });
        await advance(190);
        expect(list.calls).toEqual([]);
        list.rendered.unmount();
        await advance(1000);
        expect(list.calls).toEqual([]);
        expect(list.ctx.state.scheduledWork.has("viewabilityundefined")).toBe(false);
    });

    it("removes a pending callback without delivering to its previous owner", async () => {
        const list = await mount();
        await advance(190);
        list.setCallback(undefined);
        await advance(1000);
        expect(list.calls).toEqual([]);
        list.rendered.unmount();
    });

    it("starts a replacement config id without waiting for another scroll", async () => {
        const list = await mount();
        await advance(190);
        list.configure({ ...config, id: "replacement" });
        await advance(70);
        expect(list.calls).toEqual([]);
        await advance(180);
        expect(list.calls[0].viewableItems.map((token) => token.key)).toEqual(["0", "1"]);
        expect([...list.ctx.mapViewabilityConfigStates.keys()]).toEqual(["replacement"]);
        list.rendered.unmount();
    });

    it("cancels a removed callback pair without cancelling the other config", async () => {
        const list = await mount();
        const removed: OnViewableItemsChangedInfo[] = [];
        const retained: OnViewableItemsChangedInfo[] = [];
        const retainedPair = {
            onViewableItemsChanged: (info: OnViewableItemsChangedInfo) => retained.push(info),
            viewabilityConfig: { ...config, id: "retained", minimumViewTime: 500 },
        };
        list.configure(undefined, [
            { onViewableItemsChanged: (info) => removed.push(info), viewabilityConfig: { ...config, id: "removed" } },
            retainedPair,
        ]);
        list.scroll(100);
        await advance(190);
        list.configure(undefined, [retainedPair]);
        await advance(320);
        expect(removed).toEqual([]);
        expect(retained[0].viewableItems.map((token) => token.key)).toEqual(["1", "2"]);
        expect(list.ctx.state.scheduledWork.has("viewabilityremoved")).toBe(false);
        list.rendered.unmount();
    });

    it("drops removed pending rows and starts new keys with a full dwell", async () => {
        const list = await mount();
        await advance(190);
        list.replace([initialData[0], ...initialData.slice(2)]);
        await advance(70);
        expect(list.calls.at(-1)!.viewableItems.map((token) => [token.key, token.index])).toEqual([["0", 0]]);
        await advance(180);
        expect(list.calls.at(-1)!.viewableItems.map((token) => [token.key, token.index])).toEqual([
            ["0", 0],
            ["2", 1],
        ]);
        expect(list.calls.some((info) => info.changed.some((token) => token.key === "1"))).toBe(false);
        list.rendered.unmount();
    });

    it("preserves keys through a mounted reorder during dwell", async () => {
        const list = await mount();
        await advance(190);
        list.replace([initialData[1], initialData[0], ...initialData.slice(2)]);
        await advance(70);
        expect(list.calls.at(-1)!.viewableItems.map((token) => [token.key, token.index, token.item.id])).toEqual([
            ["1", 0, "1"],
            ["0", 1, "0"],
        ]);
        list.rendered.unmount();
    });

    it("restarts dwell after all mounted data is cleared and restored before the old deadline", async () => {
        const list = await mount();
        await advance(190);
        list.replace([]);
        await advance(20);
        list.replace(initialData);
        await advance(50);
        expect(list.calls).toEqual([]);
        await advance(190);
        expect(list.calls).toEqual([]);
        await advance(10);
        expect(list.calls.at(-1)!.viewableItems.map((token) => token.key)).toEqual(["0", "1"]);
        list.rendered.unmount();
    });

    it("reports exits when all mounted data is cleared after dwell completes", async () => {
        const list = await mount();
        await advance(260);
        expect(list.calls.at(-1)!.viewableItems.map((token) => token.key)).toEqual(["0", "1"]);
        list.replace([]);
        expect(list.calls.at(-1)!.viewableItems).toEqual([]);
        expect(list.calls.at(-1)!.changed.map((token) => [token.key, token.isViewable])).toEqual([
            ["0", false],
            ["1", false],
        ]);
        list.rendered.unmount();
    });

    it("rearms pending dwell through StrictMode replay with synchronous initial layout", async () => {
        const setupsBefore = surfaceSetups;
        const list = await mount({ strict: true, synchronousLayout: true });
        expect(surfaceSetups - setupsBefore).toBe(2);
        await advance(240);
        expect(list.calls).toEqual([]);
        await advance(20);
        expect(list.calls.at(-1)!.viewableItems.map((token) => token.key)).toEqual(["0", "1"]);
        list.rendered.unmount();
    });
});
