import { afterEach, beforeEach, describe, expect, it, jest } from "bun:test";
import "../setup";

import { setupViewability, updateViewableItems } from "../../src/core/viewability";
import type { OnViewableItemsChangedInfo, ViewabilityConfig } from "../../src/types.base";
import { createImperativeHandle } from "../../src/utils/createImperativeHandle";
import { createMockContext } from "../__mocks__/createMockContext";

function probe(configs: ViewabilityConfig[] = [{ id: "dwell", minimumViewTime: 250 }], columns = 1) {
    const ctx = createMockContext();
    const calls: OnViewableItemsChangedInfo<{ id: string; revision: number }>[][] = configs.map(() => []);
    const pairs = setupViewability({
        viewabilityConfigCallbackPairs: configs.map((config, index) => ({
            onViewableItemsChanged: (info) => calls[index].push(info),
            viewabilityConfig: { itemVisiblePercentThreshold: 50, ...config },
        })),
    })!;
    const data = (keys: string[], revision = 0) => {
        ctx.state.props.data = keys.map((id) => ({ id, revision }));
        ctx.state.props.keyExtractor = (item: { id: string }) => item.id;
        ctx.state.props.numColumns = columns;
        ctx.state.idCache = keys.slice();
        ctx.state.indexByKey = new Map(keys.map((key, index) => [key, index]));
        ctx.state.positions = keys.map((_, index) => Math.floor(index / columns) * 100);
        ctx.state.sizes = new Map(keys.map((key) => [key, 100]));
    };
    const refresh = (offset = 0, start = 0, end = ctx.state.props.data.length - 1) => {
        Object.assign(ctx.state, { endNoBuffer: end, scroll: offset, scrollLength: 200, startNoBuffer: start });
        ctx.state.viewabilityConfigCallbackPairs = pairs;
        updateViewableItems(ctx.state, ctx, pairs, 200, start, end);
    };
    data(["a", "b", "c", "d", "e", "f"]);
    return { calls, ctx, data, pairs, refresh };
}

const entered = (calls: OnViewableItemsChangedInfo<any>[]) =>
    calls.flatMap((info) => info.changed.filter((token) => token.isViewable).map((token) => token.key));

describe("minimumViewTime lifecycle boundaries", () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it.each([undefined, 0, -1, Number.NaN])("keeps duration %s immediate without timers", (minimumViewTime) => {
        const list = probe([{ id: "immediate", minimumViewTime }]);
        list.refresh();
        expect(entered(list.calls[0])).toEqual(["a", "b"]);
        expect(jest.getTimerCount()).toBe(0);
    });

    it("drops all pending rows when data becomes empty", () => {
        const list = probe();
        list.refresh();
        jest.advanceTimersByTime(200);
        list.data([]);
        list.refresh();
        jest.advanceTimersByTime(1000);
        expect(list.calls[0]).toEqual([]);
        expect(jest.getTimerCount()).toBe(0);
    });

    it("preserves dwell by key through a reorder and reports current objects and indexes", () => {
        const list = probe();
        list.refresh();
        jest.advanceTimersByTime(200);
        list.data(["b", "a", "c", "d"], 1);
        list.refresh();
        jest.advanceTimersByTime(50);
        expect(list.calls[0][0].viewableItems.map(({ key, index, item }) => [key, index, item])).toEqual([
            ["b", 0, { id: "b", revision: 1 }],
            ["a", 1, { id: "a", revision: 1 }],
        ]);
    });

    it("reads replacement objects at report time even without another range update", () => {
        const list = probe();
        list.refresh();
        jest.advanceTimersByTime(200);
        list.data(["a", "b", "c", "d"], 1);
        jest.advanceTimersByTime(50);
        expect(list.calls[0][0].viewableItems.map(({ item }) => item.revision)).toEqual([1, 1]);
    });

    it("starts a full dwell for a different key replacing a pending row", () => {
        const list = probe();
        list.refresh();
        jest.advanceTimersByTime(200);
        list.data(["a", "replacement", "c", "d"]);
        list.refresh();
        jest.advanceTimersByTime(50);
        expect(entered(list.calls[0])).toEqual(["a"]);
        jest.advanceTimersByTime(199);
        expect(entered(list.calls[0])).toEqual(["a"]);
        jest.advanceTimersByTime(1);
        expect(entered(list.calls[0])).toEqual(["a", "replacement"]);
    });

    it("keeps timers and dwell isolated between lists using the same config id", () => {
        const first = probe();
        const second = probe();
        first.refresh();
        jest.advanceTimersByTime(200);
        second.refresh();
        jest.advanceTimersByTime(50);
        expect(entered(first.calls[0])).toEqual(["a", "b"]);
        expect(second.calls[0]).toEqual([]);
        first.ctx.state.scheduledWork.dispose();
        jest.advanceTimersByTime(200);
        expect(entered(second.calls[0])).toEqual(["a", "b"]);
    });

    it("keeps a top-level config independent from callback pairs with different durations", () => {
        const list = probe([{ id: "fast", minimumViewTime: 100 }]);
        const slow: OnViewableItemsChangedInfo[] = [];
        list.pairs.push(
            setupViewability({
                onViewableItemsChanged: (info) => slow.push(info),
                viewabilityConfig: { id: "slow", itemVisiblePercentThreshold: 50, minimumViewTime: 250 },
            })![0],
        );
        list.refresh();
        jest.advanceTimersByTime(100);
        expect(entered(list.calls[0])).toEqual(["a", "b"]);
        expect(slow).toEqual([]);
        jest.advanceTimersByTime(150);
        expect(entered(slow)).toEqual(["a", "b"]);
    });

    it.each([false, true])("restarts dwell after a fully occluded viewport (external %s)", (external) => {
        const list = probe();
        list.ctx.state.props.hasExternalScroll = external;
        list.refresh();
        jest.advanceTimersByTime(200);
        const ref = createImperativeHandle(list.ctx);
        ref.reportViewabilityInsetEndInternal(200);
        jest.advanceTimersByTime(100);
        expect(list.calls[0]).toEqual([]);
        ref.reportViewabilityInsetEndInternal(0);
        jest.advanceTimersByTime(249);
        expect(list.calls[0]).toEqual([]);
        jest.advanceTimersByTime(1);
        expect(entered(list.calls[0])).toEqual(["a", "b"]);
    });

    it("restarts dwell after an external list leaves its owner's viewport", () => {
        const list = probe();
        list.ctx.state.props.hasExternalScroll = true;
        list.refresh();
        jest.advanceTimersByTime(200);
        list.refresh(1000, 0, -1);
        jest.advanceTimersByTime(100);
        expect(list.calls[0]).toEqual([]);
        list.refresh();
        jest.advanceTimersByTime(249);
        expect(list.calls[0]).toEqual([]);
        jest.advanceTimersByTime(1);
        expect(entered(list.calls[0])).toEqual(["a", "b"]);
    });

    for (const horizontal of [false, true]) {
        for (const columns of horizontal ? [1] : [1, 2, 3]) {
            it(`requires each key's own dwell with horizontal=${horizontal}, columns=${columns}`, () => {
                const list = probe(undefined, columns);
                const keys = ["a", "b", "c", "d", "e", "f", "g", "h", "i"];
                list.data(keys);
                list.ctx.state.props.horizontal = horizontal;
                list.refresh();
                jest.advanceTimersByTime(200);
                list.refresh(100);
                jest.advanceTimersByTime(50);
                expect(entered(list.calls[0])).toEqual(keys.slice(columns, columns * 2));
                jest.advanceTimersByTime(200);
                expect(entered(list.calls[0])).toEqual(keys.slice(columns, columns * 3));
                list.ctx.state.scheduledWork.dispose();
            });
        }
    }

    it("uses the latest callback for a pending config with the same id", () => {
        const list = probe();
        list.refresh();
        jest.advanceTimersByTime(200);
        const latest: OnViewableItemsChangedInfo[] = [];
        list.pairs[0] = { ...list.pairs[0], onViewableItemsChanged: (info) => latest.push(info) };
        list.refresh();
        jest.advanceTimersByTime(50);
        expect(list.calls[0]).toEqual([]);
        expect(entered(latest)).toEqual(["a", "b"]);
    });

    it("does not retain dwell for a key removed and then reinserted", () => {
        const list = probe();
        list.refresh();
        jest.advanceTimersByTime(200);
        list.data(["b", "c", "d"]);
        list.refresh();
        jest.advanceTimersByTime(20);
        list.data(["a", "b", "c", "d"]);
        list.refresh();
        jest.advanceTimersByTime(30);
        expect(entered(list.calls[0])).toEqual(["b"]);
        jest.advanceTimersByTime(219);
        expect(entered(list.calls[0])).toEqual(["b"]);
        jest.advanceTimersByTime(1);
        expect(entered(list.calls[0])).toEqual(["b", "a"]);
    });

    it("restarts dwell when a threshold replacement makes a pending key invisible", () => {
        const list = probe([{ id: "threshold", itemVisiblePercentThreshold: 25, minimumViewTime: 250 }]);
        list.refresh(60);
        jest.advanceTimersByTime(200);
        list.pairs[0] = {
            ...list.pairs[0],
            viewabilityConfig: { ...list.pairs[0].viewabilityConfig, itemVisiblePercentThreshold: 50 },
        };
        setupViewability({ viewabilityConfigCallbackPairs: list.pairs }, list.ctx);
        jest.advanceTimersByTime(50);
        expect(entered(list.calls[0])).toEqual(["b", "c"]);
        list.pairs[0] = {
            ...list.pairs[0],
            viewabilityConfig: { ...list.pairs[0].viewabilityConfig, itemVisiblePercentThreshold: 25 },
        };
        setupViewability({ viewabilityConfigCallbackPairs: list.pairs }, list.ctx);
        jest.advanceTimersByTime(249);
        expect(entered(list.calls[0])).toEqual(["b", "c"]);
        jest.advanceTimersByTime(1);
        expect(entered(list.calls[0])).toEqual(["b", "c", "a"]);
    });
});
