import { afterEach, beforeEach, describe, expect, it, jest, spyOn } from "bun:test";
import "../setup";

import { setupViewability, updateViewableItems } from "../../src/core/viewability";
import type { StateContext } from "../../src/state/state";
import type {
    OnViewableItemsChangedInfo,
    ViewabilityConfig,
    ViewabilityConfigCallbackPair,
} from "../../src/types.base";
import { createImperativeHandle } from "../../src/utils/createImperativeHandle";
import { clearWarnDevOnceForTests } from "../../src/utils/helpers";
import { createMockContext } from "../__mocks__/createMockContext";

const ROW = 100;

function setData(ctx: StateContext, keys: string[]) {
    const state = ctx.state;
    state.props.data = keys.map((id) => ({ id }));
    state.props.keyExtractor = (item: { id: string }) => item.id;
    state.idCache = keys.slice();
    state.indexByKey = new Map(keys.map((key, index) => [key, index]));
    state.positions = keys.map((_, index) => index * ROW);
    state.sizes = new Map(keys.map((key) => [key, ROW]));
}

function createList(keys: string[], configs: ViewabilityConfig[], viewport = 300) {
    const ctx = createMockContext();
    setData(ctx, keys);
    const calls: Record<string, OnViewableItemsChangedInfo[]> = {};
    const pairs: ViewabilityConfigCallbackPair[] = configs.map((viewabilityConfig) => {
        calls[viewabilityConfig.id!] = [];
        return {
            onViewableItemsChanged: (info) => {
                calls[viewabilityConfig.id!].push(info);
            },
            viewabilityConfig,
        };
    });
    ctx.state.viewabilityConfigCallbackPairs = pairs;
    const scrollTo = (scroll: number) => {
        ctx.state.scroll = scroll;
        const last = ctx.state.props.data.length - 1;
        const start = Math.min(last, Math.floor(scroll / ROW));
        const end = Math.min(last, Math.floor((scroll + viewport - 1) / ROW));
        Object.assign(ctx.state, { endNoBuffer: end, scrollLength: viewport, startNoBuffer: start });
        updateViewableItems(ctx.state, ctx, pairs, viewport, start, end);
    };
    return { calls, ctx, scrollTo };
}

// Every reported token must pair its key with that key's current item and index.
function changes(ctx: StateContext, infos: OnViewableItemsChangedInfo[]) {
    return infos.flatMap((info) =>
        info.changed.map((token) => {
            expect(token.item.id).toBe(token.key);
            if (token.isViewable) {
                expect(token.index).toBe(ctx.state.indexByKey.get(token.key)!);
            }
            return `${token.isViewable ? "+" : "-"}${token.key}@${token.index}`;
        }),
    );
}

const config = (id: string, itemVisiblePercentThreshold = 50): ViewabilityConfig => ({
    id,
    itemVisiblePercentThreshold,
    minimumViewTime: 250,
});

describe("viewability minimumViewTime", () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it("rearms dwell after update, dispose and update in the same tick", () => {
        const { calls, ctx, scrollTo } = createList(["a", "b", "c"], [config("c")]);
        scrollTo(0);
        ctx.state.scheduledWork.dispose();
        scrollTo(0);

        jest.advanceTimersByTime(249);
        expect(calls.c).toHaveLength(0);
        jest.advanceTimersByTime(1);
        expect(changes(ctx, calls.c)).toEqual(["+a@0", "+b@1", "+c@2"]);
        expect(jest.getTimerCount()).toBe(0);
    });

    it("coerces a string minimumViewTime before adding it to the entry time", () => {
        const { calls, ctx, scrollTo } = createList(
            ["a", "b", "c"],
            [{ ...config("c"), minimumViewTime: "250" as unknown as number }],
        );
        scrollTo(0);
        jest.advanceTimersByTime(249);
        expect(calls.c).toHaveLength(0);
        jest.advanceTimersByTime(1);
        expect(changes(ctx, calls.c)).toEqual(["+a@0", "+b@1", "+c@2"]);
        expect(jest.getTimerCount()).toBe(0);
    });

    it("reports exits immediately and restarts the full dwell after scrolling back", () => {
        const { calls, ctx, scrollTo } = createList(["a", "b", "c", "d"], [config("c")]);
        scrollTo(0);
        jest.advanceTimersByTime(250);
        expect(changes(ctx, calls.c)).toEqual(["+a@0", "+b@1", "+c@2"]);

        scrollTo(100);
        expect(changes(ctx, calls.c.slice(1))).toEqual(["-a@0"]);
        expect(calls.c[1].viewableItems.map((token) => token.key)).toEqual(["b", "c"]);
        jest.advanceTimersByTime(50);
        scrollTo(0);
        jest.advanceTimersByTime(249);
        expect(calls.c).toHaveLength(2);
        jest.advanceTimersByTime(1);
        expect(changes(ctx, calls.c.slice(2))).toEqual(["+a@0"]);
        expect(calls.c[2].viewableItems.map((token) => token.key)).toEqual(["a", "b", "c"]);
    });

    it.each([false, true])("preserves pending dwell on a null-range inset refresh (external: %s)", (external) => {
        const { calls, ctx, scrollTo } = createList(["a", "b", "c"], [config("c")]);
        ctx.state.props.hasExternalScroll = external;
        scrollTo(0);
        jest.advanceTimersByTime(200);
        // A layout refresh has not calculated a visible range yet.
        Object.assign(ctx.state, { endNoBuffer: null, startNoBuffer: null });
        createImperativeHandle(ctx).reportViewabilityInsetEndInternal(10);
        scrollTo(0);
        jest.advanceTimersByTime(49);
        expect(calls.c).toHaveLength(0);
        jest.advanceTimersByTime(1);
        expect(changes(ctx, calls.c)).toEqual(["+a@0", "+b@1", "+c@2"]);
    });

    it("preserves reported external-scroll rows across a null-range inset refresh", () => {
        const { calls, ctx, scrollTo } = createList(["a", "b", "c"], [config("c")]);
        ctx.state.props.hasExternalScroll = true;
        scrollTo(0);
        jest.advanceTimersByTime(250);
        expect(changes(ctx, calls.c)).toEqual(["+a@0", "+b@1", "+c@2"]);

        Object.assign(ctx.state, { endNoBuffer: null, startNoBuffer: null });
        createImperativeHandle(ctx).reportViewabilityInsetEndInternal(10);
        scrollTo(0);
        jest.advanceTimersByTime(250);
        expect(calls.c).toHaveLength(1);
        expect(jest.getTimerCount()).toBe(0);

        // Once a range exists, keyboard occlusion still reports exits immediately.
        createImperativeHandle(ctx).reportViewabilityInsetEndInternal(260);
        expect(changes(ctx, calls.c.slice(1))).toEqual(["-a@0", "-b@1", "-c@2"]);
        createImperativeHandle(ctx).reportViewabilityInsetEndInternal(0);
        jest.advanceTimersByTime(249);
        expect(calls.c).toHaveLength(2);
        jest.advanceTimersByTime(1);
        expect(changes(ctx, calls.c.slice(2))).toEqual(["+a@0", "+b@1", "+c@2"]);
    });

    it("does not repeatedly arm overflowing timers for a huge minimumViewTime", () => {
        const { calls, scrollTo } = createList(["a"], [{ ...config("c"), minimumViewTime: 1e15 }]);
        const timeout = spyOn(globalThis, "setTimeout");
        try {
            scrollTo(0);
            expect(timeout).toHaveBeenCalledTimes(1);
            expect(timeout.mock.calls[0][1]).toBe(2147483647);
            jest.advanceTimersByTime(1000);
            expect(timeout).toHaveBeenCalledTimes(1);
            expect(calls.c).toHaveLength(0);
            expect(jest.getTimerCount()).toBe(1);
        } finally {
            timeout.mockRestore();
        }
    });

    it("reports after the full dwell when minimumViewTime exceeds one timer's range", () => {
        const { calls, ctx, scrollTo } = createList(["a"], [{ ...config("c"), minimumViewTime: 2147483647 + 250 }]);
        scrollTo(0);
        jest.advanceTimersByTime(2147483647);
        expect(calls.c).toHaveLength(0);
        expect(jest.getTimerCount()).toBe(1);
        jest.advanceTimersByTime(249);
        expect(calls.c).toHaveLength(0);
        jest.advanceTimersByTime(1);
        expect(changes(ctx, calls.c)).toEqual(["+a@0"]);
        expect(jest.getTimerCount()).toBe(0);
    });

    it("never reports or arms a timer for an infinite minimumViewTime", () => {
        const viewabilityConfig = { ...config("c"), minimumViewTime: Number.POSITIVE_INFINITY };
        const { calls, ctx, scrollTo } = createList(["a"], [viewabilityConfig]);
        const timeout = spyOn(globalThis, "setTimeout");
        try {
            scrollTo(0);
            jest.advanceTimersByTime(2147483647);
            scrollTo(0);
            expect(timeout).not.toHaveBeenCalled();
            expect(calls.c).toHaveLength(0);
            expect(jest.getTimerCount()).toBe(0);

            // Changing a pending finite dwell to Infinity cancels its timer too.
            viewabilityConfig.minimumViewTime = 2147483647 + 1000;
            scrollTo(0);
            expect(jest.getTimerCount()).toBe(1);
            viewabilityConfig.minimumViewTime = Number.POSITIVE_INFINITY;
            scrollTo(0);
            jest.advanceTimersByTime(1000);
            expect(calls.c).toHaveLength(0);
            expect(jest.getTimerCount()).toBe(0);

            viewabilityConfig.minimumViewTime = 250;
            scrollTo(0);
            expect(changes(ctx, calls.c)).toEqual(["+a@0"]);
            expect(jest.getTimerCount()).toBe(0);
        } finally {
            timeout.mockRestore();
        }
    });

    it("cancels pending work and releases state when a config is removed", () => {
        const { calls, ctx, scrollTo } = createList(["a", "b", "c"], [config("c")]);
        scrollTo(0);
        jest.advanceTimersByTime(100);
        setupViewability({}, ctx);
        expect(ctx.mapViewabilityConfigStates.size).toBe(0);
        expect(jest.getTimerCount()).toBe(0);
        jest.advanceTimersByTime(1000);
        expect(calls.c).toHaveLength(0);

        scrollTo(0);
        jest.advanceTimersByTime(249);
        expect(calls.c).toHaveLength(0);
        jest.advanceTimersByTime(1);
        expect(changes(ctx, calls.c)).toEqual(["+a@0", "+b@1", "+c@2"]);
    });

    it.each([-10000, 10000])("ignores a wall clock adjustment of %i ms during dwell", (jump) => {
        const { calls, ctx, scrollTo } = createList(["a", "b", "c"], [config("c")]);
        scrollTo(0);
        jest.advanceTimersByTime(100);
        const clock = spyOn(Date, "now").mockReturnValue(Date.now() + jump);
        try {
            scrollTo(0);
            jest.advanceTimersByTime(149);
            expect(calls.c).toHaveLength(0);
            jest.advanceTimersByTime(1);
            expect(changes(ctx, calls.c)).toEqual(["+a@0", "+b@1", "+c@2"]);
            expect(jest.getTimerCount()).toBe(0);
        } finally {
            clock.mockRestore();
        }
    });

    it("tracks uninterrupted dwell under the viewport coverage threshold", () => {
        const { calls, ctx, scrollTo } = createList(
            ["a", "b", "c", "d"],
            [{ id: "c", minimumViewTime: 250, viewAreaCoveragePercentThreshold: 25 }],
            200,
        );
        scrollTo(0);
        jest.advanceTimersByTime(100);
        // a covers only 20% of the viewport; c covers 30%.
        scrollTo(60);
        jest.advanceTimersByTime(150);
        expect(changes(ctx, calls.c)).toEqual(["+b@1"]);
        jest.advanceTimersByTime(100);
        expect(changes(ctx, calls.c.slice(1))).toEqual(["+c@2"]);
    });

    it("uses the latest dwell duration and cancels the timer when it becomes immediate", () => {
        const viewabilityConfig = config("c");
        const { calls, ctx, scrollTo } = createList(["a", "b", "c"], [viewabilityConfig]);
        scrollTo(0);
        jest.advanceTimersByTime(100);
        viewabilityConfig.minimumViewTime = 1000;
        scrollTo(0);
        jest.advanceTimersByTime(899);
        expect(calls.c).toHaveLength(0);
        viewabilityConfig.minimumViewTime = -1;
        scrollTo(0);
        expect(changes(ctx, calls.c)).toEqual(["+a@0", "+b@1", "+c@2"]);
        expect(jest.getTimerCount()).toBe(0);
    });

    it.each(["duplicate", undefined])("warns when multiple configs share id %s", (id) => {
        clearWarnDevOnceForTests();
        const warning = spyOn(console, "warn").mockImplementation(() => {});
        try {
            setupViewability({
                viewabilityConfigCallbackPairs: [
                    { viewabilityConfig: { ...config("a"), id } },
                    { viewabilityConfig: { ...config("b"), id } },
                ],
            });
            expect(warning).toHaveBeenCalledWith(
                "[legend-list] Each viewability config must have a unique id when using multiple configs.",
            );
        } finally {
            warning.mockRestore();
            clearWarnDevOnceForTests();
        }
    });

    it("credits the correct item and index when data is prepended while a timer is pending", () => {
        const { calls, ctx, scrollTo } = createList(["a", "b", "c", "d", "e"], [config("c")]);
        scrollTo(0);
        jest.advanceTimersByTime(100);

        // Prepend; content position is maintained so a, b and c stay on screen.
        setData(ctx, ["x", "a", "b", "c", "d", "e"]);
        scrollTo(100);
        jest.advanceTimersByTime(149);
        expect(calls.c).toHaveLength(0);

        jest.advanceTimersByTime(1);
        expect(changes(ctx, calls.c)).toEqual(["+a@1", "+b@2", "+c@3"]);

        jest.advanceTimersByTime(1000);
        expect(calls.c).toHaveLength(1);
    });

    it("never reports rows passed during a fast fling", () => {
        const keys = Array.from({ length: 20 }, (_, i) => `r${i}`);
        const { calls, ctx, scrollTo } = createList(keys, [config("c")]);
        scrollTo(0);
        jest.advanceTimersByTime(200);
        scrollTo(600);
        jest.advanceTimersByTime(100);
        scrollTo(1200);
        jest.advanceTimersByTime(249);
        expect(calls.c).toHaveLength(0);

        jest.advanceTimersByTime(1);
        expect(changes(ctx, calls.c)).toEqual(["+r12@12", "+r13@13", "+r14@14"]);
    });

    it("reports a row only once it has itself been visible for minimumViewTime", () => {
        const { calls, ctx, scrollTo } = createList(["r0", "r1", "r2", "r3", "r4"], [config("c")]);
        scrollTo(0);
        jest.advanceTimersByTime(200);
        scrollTo(100);

        jest.advanceTimersByTime(50);
        expect(changes(ctx, calls.c)).toEqual(["+r1@1", "+r2@2"]);

        jest.advanceTimersByTime(199);
        expect(calls.c).toHaveLength(1);

        jest.advanceTimersByTime(1);
        expect(changes(ctx, calls.c.slice(1))).toEqual(["+r3@3"]);
        expect(calls.c[1].viewableItems.map((token) => token.key)).toEqual(["r1", "r2", "r3"]);
    });

    it("resolves current items when data is replaced or filtered while a timer is pending", () => {
        const { calls, ctx, scrollTo } = createList(["a", "b", "c", "d", "e"], [config("c")]);
        scrollTo(0);
        jest.advanceTimersByTime(100);

        setData(ctx, ["a", "c", "f", "g"]);
        scrollTo(0);
        jest.advanceTimersByTime(150);
        expect(changes(ctx, calls.c)).toEqual(["+a@0", "+c@1"]);

        jest.advanceTimersByTime(100);
        expect(changes(ctx, calls.c.slice(1))).toEqual(["+f@2"]);

        // A reported key that is removed is reported as no longer viewable.
        setData(ctx, ["c", "f", "g"]);
        scrollTo(0);
        expect(changes(ctx, calls.c.slice(2))).toEqual(["-a@0"]);

        jest.advanceTimersByTime(250);
        expect(changes(ctx, calls.c.slice(3))).toEqual(["+g@2"]);
        expect(calls.c.some((info) => info.changed.some((token) => token.key === "b"))).toBe(false);
    });

    it("tracks dwell separately for each config threshold", () => {
        const { calls, ctx, scrollTo } = createList(
            ["r0", "r1", "r2", "r3"],
            [config("fifty", 50), config("zero", 0)],
            230,
        );
        // r2 is 30% visible: viewable for threshold 0 only.
        scrollTo(0);
        jest.advanceTimersByTime(100);
        // r2 is now 80% visible and r0 50%.
        scrollTo(50);

        jest.advanceTimersByTime(150);
        expect(changes(ctx, calls.zero)).toEqual(["+r0@0", "+r1@1", "+r2@2"]);
        expect(changes(ctx, calls.fifty)).toEqual(["+r0@0", "+r1@1"]);

        jest.advanceTimersByTime(100);
        expect(changes(ctx, calls.fifty.slice(1))).toEqual(["+r2@2"]);
        expect(calls.zero).toHaveLength(1);
    });

    it("keeps one timer per config and leaves nothing pending after unmount", () => {
        const { calls, ctx, scrollTo } = createList(
            Array.from({ length: 20 }, (_, i) => `r${i}`),
            [config("fifty", 50), config("zero", 0)],
        );
        for (let i = 0; i < 5; i++) {
            scrollTo(i * 10);
            jest.advanceTimersByTime(10);
        }
        expect(jest.getTimerCount()).toBe(2);

        ctx.state.scheduledWork.dispose();
        expect(jest.getTimerCount()).toBe(0);
        jest.advanceTimersByTime(1000);
        expect(calls.fifty).toHaveLength(0);
        expect(calls.zero).toHaveLength(0);
    });

    it("delivers pending dwell to the latest callback without another range update", () => {
        const viewabilityConfig = config("c");
        const { calls, ctx, scrollTo } = createList(["a", "b", "c"], [viewabilityConfig]);
        scrollTo(0);
        jest.advanceTimersByTime(200);
        const latest: OnViewableItemsChangedInfo[] = [];
        setupViewability({ onViewableItemsChanged: (info) => latest.push(info), viewabilityConfig }, ctx);
        jest.advanceTimersByTime(50);
        expect(calls.c).toEqual([]);
        expect(changes(ctx, latest)).toEqual(["+a@0", "+b@1", "+c@2"]);
        expect(jest.getTimerCount()).toBe(0);
    });

    it("starts dwell for a replacement config id using the current stationary range", () => {
        const { calls, ctx, scrollTo } = createList(["a", "b", "c"], [config("old")]);
        scrollTo(0);
        jest.advanceTimersByTime(200);
        const latest: OnViewableItemsChangedInfo[] = [];
        setupViewability(
            { onViewableItemsChanged: (info) => latest.push(info), viewabilityConfig: config("new") },
            ctx,
        );
        jest.advanceTimersByTime(249);
        expect(calls.old).toEqual([]);
        expect(latest).toEqual([]);
        jest.advanceTimersByTime(1);
        expect(changes(ctx, latest)).toEqual(["+a@0", "+b@1", "+c@2"]);
        expect(ctx.mapViewabilityConfigStates.has("old")).toBe(false);
        expect(jest.getTimerCount()).toBe(0);
    });
});
