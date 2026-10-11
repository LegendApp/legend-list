import { expect, it, spyOn } from "bun:test";
import { applyDataSourceMutationBatches } from "../../src/core/DataSourceMutationCoordinator";
import { LayoutStoreRuntime } from "../../src/core/LayoutStoreRuntime";
import { PrefixLayoutStore } from "../../src/core/PrefixLayoutStore";
import "../setup";

import { resetViewabilityTimers, setupViewability, updateViewableItems } from "../../src/core/viewability";
import type { OnViewableItemsChangedInfo, ViewabilityConfig } from "../../src/types.base";
import { createMockContext } from "../__mocks__/createMockContext";
import { setLayoutValue } from "../helpers/layoutStore";

function scenario(run: (test: ReturnType<typeof createScenario>) => void) {
    const test = createScenario();
    try {
        run(test);
    } finally {
        test.dispose();
    }
}

function createScenario() {
    let now = 0,
        nextId = 0;
    const pending = new Map<number, { at: number; callback: () => void }>();
    const clock = spyOn(Date, "now").mockImplementation(() => now);
    const timeout = spyOn(globalThis, "setTimeout").mockImplementation(((callback: () => void, delay: number) => {
        const id = ++nextId;
        pending.set(id, { at: now + delay, callback });
        return id;
    }) as any);
    const cancel = spyOn(globalThis, "clearTimeout").mockImplementation(((id: number) => pending.delete(id)) as any);
    const calls: OnViewableItemsChangedInfo[] = [];
    const ctx = createMockContext(
        {},
        {
            idCache: ["a", "b", "c"],
            indexByKey: new Map([
                ["a", 0],
                ["b", 1],
                ["c", 2],
            ]),
            props: {
                data: [{ id: "a" }, { id: "b" }, { id: "c" }],
                estimatedItemSize: 100,
                keyExtractor: (item: any) => item.id,
            },
            scrollLength: 100,
        },
    );
    for (let index = 0; index < 3; index++) setLayoutValue(ctx.state, index, index * 100, 100);
    const configure = (
        config: ViewabilityConfig = {},
        callback = (info: OnViewableItemsChangedInfo) => calls.push(info),
    ) => {
        ctx.state.viewabilityConfigCallbackPairs = setupViewability({
            onViewableItemsChanged: callback,
            viewabilityConfig: { id: "", itemVisiblePercentThreshold: 50, minimumViewTime: 100, ...config },
        });
    };
    configure();
    const update = (scroll = ctx.state.scroll) => {
        ctx.state.scroll = scroll;
        updateViewableItems(ctx, ctx.state.viewabilityConfigCallbackPairs!, 100, 0, 2);
    };
    const advance = (target: number) => {
        while (true) {
            const entry = [...pending].sort((a, b) => a[1].at - b[1].at)[0];
            if (!entry || entry[1].at > target) break;
            now = entry[1].at;
            pending.delete(entry[0]);
            entry[1].callback();
        }
        now = target;
    };
    return {
        advance,
        calls,
        configure,
        ctx,
        dispose: () => {
            ctx.state.scheduledWork.dispose();
            cancel.mockRestore();
            timeout.mockRestore();
            clock.mockRestore();
        },
        pending,
        update,
    };
}

it("does not credit a newly visible row with another row's timer", () =>
    scenario(({ advance, calls, update, pending }) => {
        update(0);
        advance(90);
        update(100);
        advance(100);
        expect(calls).toEqual([]);
        expect(pending.size).toBe(1);
        advance(189);
        expect(calls).toEqual([]);
        advance(190);
        expect(calls[0].viewableItems.map((item) => item.key)).toEqual(["b"]);
        expect(pending.size).toBe(0);
        advance(200);
        update(200);
        expect(calls[1].changed).toMatchObject([{ isViewable: false, key: "b" }]);
        advance(300);
        expect(calls[2].viewableItems.map((item) => item.key)).toEqual(["c"]);
    }));

it("restarts elapsed time when a row leaves and reenters before its first deadline", () =>
    scenario(({ advance, calls, update }) => {
        update(0);
        advance(49);
        update(100);
        advance(80);
        update(0);
        advance(100);
        expect(calls).toEqual([]);
        advance(179);
        expect(calls).toEqual([]);
        advance(180);
        expect(calls[0].viewableItems.map((item) => item.key)).toEqual(["a"]);
    }));

it("retains elapsed time and one timer across repeated calculations above the threshold", () =>
    scenario(({ advance, calls, update, pending }) => {
        update(0);
        for (let time = 1; time < 100; time++) {
            advance(time);
            update(time % 40);
            expect(pending.size).toBe(1);
        }
        advance(100);
        expect(calls).toHaveLength(1);
        expect(calls[0].viewableItems.map((item) => item.key)).toEqual(["a"]);
        expect(pending.size).toBe(0);
    }));

it("restarts elapsed time after falling below the visibility threshold", () =>
    scenario(({ advance, calls, update }) => {
        update(0);
        advance(60);
        update(60);
        advance(80);
        update(0);
        advance(179);
        expect(calls).toEqual([]);
        advance(180);
        expect(calls[0].viewableItems.map((item) => item.key)).toEqual(["a"]);
    }));

it("uses a replacement callback without resetting unchanged visibility timing", () =>
    scenario(({ advance, calls, configure, update }) => {
        const replacement: OnViewableItemsChangedInfo[] = [];
        update(0);
        advance(40);
        configure({}, (info) => replacement.push(info));
        update();
        advance(100);
        expect(calls).toEqual([]);
        expect(replacement).toHaveLength(1);
    }));

it("restarts timing when threshold configuration changes", () =>
    scenario(({ advance, calls, configure, update }) => {
        update(0);
        advance(40);
        configure({ minimumViewTime: 50 });
        update();
        advance(89);
        expect(calls).toEqual([]);
        advance(90);
        expect(calls).toHaveLength(1);
    }));

it("revokes pending timers on reset even when logical keys are reused", () =>
    scenario(({ advance, calls, ctx, update, pending }) => {
        update(0);
        advance(90);
        resetViewabilityTimers(ctx);
        expect(pending.size).toBe(0);
        update();
        advance(100);
        expect(calls).toEqual([]);
        advance(190);
        expect(calls).toHaveLength(1);
    }));

it("cancels pending visibility when interaction gating is enabled", () =>
    scenario(({ advance, calls, configure, update, pending }) => {
        update(0);
        advance(50);
        configure({ waitForInteraction: true });
        update();
        expect(pending.size).toBe(0);
        advance(200);
        expect(calls).toEqual([]);
    }));

it("drops removed callbacks and cancels timers on disposal", () =>
    scenario(({ advance, calls, ctx, update, pending }) => {
        update(0);
        ctx.state.viewabilityConfigCallbackPairs = setupViewability({});
        advance(100);
        expect(calls).toEqual([]);
        ctx.state.viewabilityConfigCallbackPairs = setupViewability({
            onViewableItemsChanged: (info) => calls.push(info),
            viewabilityConfig: { minimumViewTime: 200 },
        });
        update();
        expect(pending.size).toBe(1);
        ctx.state.scheduledWork.dispose();
        expect(pending.size).toBe(0);
        advance(500);
        expect(calls).toEqual([]);
    }));

it("restarts timing after a source deletes and reinserts a key before the next calculation", () =>
    scenario(({ advance, calls, ctx, update }) => {
        let items = [{ id: "a" }, { id: "b" }, { id: "c" }];
        const source = {
            getItem: (index: number) => items[index],
            getKey: (index: number) => items[index].id,
            getLength: () => items.length,
            getRevision: () => 0,
            subscribe: () => () => {},
        };
        ctx.state.props.dataSource = source;
        ctx.state.layoutStoreRuntime = new LayoutStoreRuntime(new PrefixLayoutStore(3, 100));
        update(0);
        advance(90);
        items = [];
        const removed = applyDataSourceMutationBatches(ctx, source, [
            {
                length: 0,
                operations: [{ deleteCount: 3, index: 0, insertCount: 0, type: "splice" }],
                previousLength: 3,
                previousRevision: 0,
                revision: 1,
            },
        ]);
        expect(removed.applied).toBe(true);
        items = [{ id: "a" }];
        const inserted = applyDataSourceMutationBatches(ctx, source, [
            {
                length: 1,
                operations: [{ deleteCount: 0, index: 0, insertCount: 1, type: "splice" }],
                previousLength: 0,
                previousRevision: 1,
                revision: 2,
            },
        ]);
        expect(inserted.applied).toBe(true);
        update(0);
        advance(100);
        expect(calls).toEqual([]);
        advance(190);
        expect(calls[0].viewableItems.map((item) => item.key)).toEqual(["a"]);
    }));

it("keeps independent deadlines when visibility configurations overlap", () =>
    scenario(({ advance, ctx, update, pending }) => {
        const fast: OnViewableItemsChangedInfo[] = [];
        const slow: OnViewableItemsChangedInfo[] = [];
        ctx.state.viewabilityConfigCallbackPairs = setupViewability({
            viewabilityConfigCallbackPairs: [
                {
                    onViewableItemsChanged: (info) => fast.push(info),
                    viewabilityConfig: { id: "fast", itemVisiblePercentThreshold: 50, minimumViewTime: 100 },
                },
                {
                    onViewableItemsChanged: (info) => slow.push(info),
                    viewabilityConfig: { id: "slow", itemVisiblePercentThreshold: 75, minimumViewTime: 200 },
                },
            ],
        });
        update(0);
        expect(pending.size).toBe(2);
        advance(50);
        update(40); // a remains eligible for fast, but drops below slow's threshold.
        expect(pending.size).toBe(1);
        advance(80);
        update(0);
        expect(pending.size).toBe(2);
        advance(100);
        expect(fast).toHaveLength(1);
        expect(fast[0].viewableItems.map((item) => item.key)).toEqual(["a"]);
        expect(slow).toEqual([]);
        advance(279);
        expect(slow).toEqual([]);
        advance(280);
        expect(slow).toHaveLength(1);
        expect(slow[0].viewableItems.map((item) => item.key)).toEqual(["a"]);
        expect(pending.size).toBe(0);
    }));

it("publishes immediately when minimum view time is disabled and restarts when enabled", () =>
    scenario(({ advance, calls, configure, update, pending }) => {
        update(0);
        advance(50);
        configure({ minimumViewTime: 0 });
        update();
        expect(pending.size).toBe(0);
        expect(calls).toHaveLength(1);
        expect(calls[0].changed).toMatchObject([{ isViewable: true, key: "a" }]);
        advance(60);
        configure({ minimumViewTime: 100 });
        update();
        expect(calls[1].changed).toMatchObject([{ isViewable: false, key: "a" }]);
        advance(159);
        expect(calls).toHaveLength(2);
        advance(160);
        expect(calls[2].changed).toMatchObject([{ isViewable: true, key: "a" }]);
    }));

it("does not cancel another configuration when a callback pair is removed", () =>
    scenario(({ advance, ctx, update, pending }) => {
        const removed: OnViewableItemsChangedInfo[] = [];
        const retained: OnViewableItemsChangedInfo[] = [];
        const first = {
            onViewableItemsChanged: (info: OnViewableItemsChangedInfo) => removed.push(info),
            viewabilityConfig: { id: "removed", minimumViewTime: 100 },
        };
        const second = {
            onViewableItemsChanged: (info: OnViewableItemsChangedInfo) => retained.push(info),
            viewabilityConfig: { id: "retained", minimumViewTime: 200 },
        };
        ctx.state.viewabilityConfigCallbackPairs = setupViewability({
            viewabilityConfigCallbackPairs: [first, second],
        });
        update(0);
        advance(50);
        ctx.state.viewabilityConfigCallbackPairs = setupViewability({ viewabilityConfigCallbackPairs: [second] });
        update();
        advance(100);
        expect(removed).toEqual([]);
        expect(retained).toEqual([]);
        advance(200);
        expect(retained).toHaveLength(1);
        expect(pending.size).toBe(0);
    }));

it("fires the original deadline after an idle shallow array copy", () =>
    scenario(({ advance, calls, ctx, update, pending }) => {
        update(0);
        advance(50);
        ctx.state.props.data = [...ctx.state.props.data!];
        advance(100);
        expect(calls).toHaveLength(1);
        expect(calls[0].changed).toMatchObject([{ isViewable: true, key: "a" }]);
        expect(pending.size).toBe(0);
    }));

it("retains visibility credit through repeated array copies and append calculations", () =>
    scenario(({ advance, calls, ctx, update, pending }) => {
        update(0);
        for (const time of [25, 50, 75]) {
            advance(time);
            ctx.state.props.data = [...ctx.state.props.data!, { id: `new-${time}` }];
            update();
            expect(pending.size).toBe(1);
        }
        advance(100);
        expect(calls).toHaveLength(1);
        advance(150);
        ctx.state.props.data = [...ctx.state.props.data!];
        update();
        expect(calls).toHaveLength(1);
        expect(pending.size).toBe(0);
    }));

for (const published of [false, true]) {
    it(`restarts array visibility for a same-key item replacement (published: ${published})`, () =>
        scenario(({ advance, calls, ctx, update }) => {
            update(0);
            advance(published ? 150 : 50);
            ctx.state.props.data = ctx.state.props.data!.map((item, index) => (index === 0 ? { ...item } : item));
            update();
            if (published) expect(calls[1].changed).toMatchObject([{ isViewable: false, key: "a" }]);
            advance(published ? 249 : 149);
            expect(calls).toHaveLength(published ? 2 : 0);
            advance(published ? 250 : 150);
            expect(calls.at(-1)!.changed).toMatchObject([{ isViewable: true, key: "a" }]);
        }));
}

it("restarts visibility when dataKey changes despite retained array items", () =>
    scenario(({ advance, calls, ctx, update }) => {
        update(0);
        advance(50);
        ctx.state.props.dataKey = "new-dataset";
        update();
        advance(149);
        expect(calls).toHaveLength(0);
        advance(150);
        expect(calls).toHaveLength(1);
    }));

it("prunes a removed array key before its pending deadline", () =>
    scenario(({ advance, calls, ctx, update, pending }) => {
        update(0);
        advance(50);
        ctx.state.props.data = [{ id: "replacement" }];
        ctx.state.idCache = ["replacement"];
        ctx.state.indexByKey = new Map([["replacement", 0]]);
        advance(100);
        expect(calls).toHaveLength(0);
        expect(pending.size).toBe(1);
        advance(200);
        expect(calls[0].changed).toMatchObject([{ isViewable: true, key: "replacement" }]);
    }));
