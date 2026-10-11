import { expect, it, spyOn } from "bun:test";
import { applyDataSourceMutationBatches } from "../../src/core/DataSourceMutationCoordinator";
import { LayoutStoreRuntime } from "../../src/core/LayoutStoreRuntime";
import { PrefixLayoutStore } from "../../src/core/PrefixLayoutStore";
import "../setup";

import { resetViewabilityTimers, setupViewability, updateViewableItems } from "../../src/core/viewability";
import type { OnViewableItemsChangedInfo, ViewabilityConfig } from "../../src/types.base";
import { createMockContext } from "../__mocks__/createMockContext";
import { setLayoutValue } from "../helpers/layoutStore";
import { createViewabilityClock } from "../helpers/viewabilityClock";

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
    it(`retains array visibility credit for a same-key item replacement (published: ${published})`, () =>
        scenario(({ advance, calls, ctx, update, pending }) => {
            update(0);
            advance(published ? 150 : 50);
            ctx.state.props.data = ctx.state.props.data!.map((item, index) => (index === 0 ? { ...item } : item));
            update();
            expect(calls).toHaveLength(published ? 1 : 0);
            expect(pending.size).toBe(published ? 0 : 1);
            advance(published ? 249 : 99);
            expect(calls).toHaveLength(published ? 1 : 0);
            advance(published ? 250 : 100);
            expect(calls).toHaveLength(1);
            expect(calls[0].changed).toMatchObject([{ isViewable: true, key: "a" }]);
            expect(ctx.mapViewabilityConfigStates.get("")!.viewableItems[0].item).toBe(ctx.state.props.data![0]);
            expect(pending.size).toBe(0);
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

it("keeps the Notifications Inbox fourth row unread below 60% after viewport measurement and prepend", () => {
    const ctx = createMockContext(
        {},
        {
            props: {
                data: Array.from({ length: 96 }, (_, index) => ({ id: String(index), isUnread: index < 18 })),
                estimatedItemSize: 108,
                keyExtractor: (item) => item.id,
            },
            scrollLength: 874,
        },
    );
    const store = new PrefixLayoutStore(96, 108);
    ctx.state.layoutStoreRuntime = new LayoutStoreRuntime(store, 108);
    const calls: OnViewableItemsChangedInfo[] = [];
    ctx.state.viewabilityConfigCallbackPairs = setupViewability({
        onViewableItemsChanged: (info) => {
            calls.push(info);
            const visible = new Set(info.viewableItems.map((token) => token.key));
            ctx.state.props.data = ctx.state.props.data!.map((item) =>
                visible.has(item.id) && item.isUnread ? { ...item, isUnread: false } : item,
            );
        },
        viewabilityConfig: {
            id: "notifications-inbox-read",
            itemVisiblePercentThreshold: 60,
            minimumViewTime: 120,
        },
    });
    const clock = createViewabilityClock(ctx.state.scheduledWork);
    const update = (start: number, end: number) => {
        for (let index = start; index <= end; index++) {
            ctx.state.indexByKey.set(ctx.state.props.data![index].id, index);
        }
        updateViewableItems(ctx, ctx.state.viewabilityConfigCallbackPairs!, ctx.state.scrollLength, start, end);
    };
    const unread = () => ctx.state.props.data!.filter((item) => item.isUnread).length;
    try {
        // Before native onLayout, window height and estimated rows overstate visibility.
        update(0, 3);
        clock.advance(20);
        for (let index = 0; index < 4; index++) store.setMeasuredSize(index, 160);
        ctx.state.scrollLength = 536;
        update(0, 3);
        clock.advance(119);
        expect(calls).toHaveLength(0);
        clock.advance(120);
        expect(calls[0].viewableItems.map((token) => token.key)).toEqual(["0", "1", "2"]);
        expect(unread()).toBe(15);
        expect(ctx.state.props.data![3].isUnread).toBe(true);

        clock.advance(200);
        ctx.state.props.data = [
            ...Array.from({ length: 3 }, (_, index) => ({ id: `new-${index}`, isUnread: true })),
            ...ctx.state.props.data!,
        ];
        ctx.state.idCache.length = 0;
        ctx.state.indexByKey.clear();
        store.splice(0, 0, 3);
        for (let index = 0; index < 3; index++) store.setMeasuredSize(index, 160);
        ctx.state.scroll = 3 * 160; // MVCP preserves the same rows after Add 3 newer.
        update(3, 6);
        clock.advance(1000);
        expect(calls).toHaveLength(1);
        expect(unread()).toBe(18);
        expect(ctx.state.props.data!.length - unread()).toBe(81);
        expect(ctx.state.props.data![6].isUnread).toBe(true);

        // Exactly 60% is eligible, but needs its own full 120ms of eligibility.
        ctx.state.scrollLength = 3 * 160 + 0.6 * 160;
        update(3, 6);
        clock.advance(1119);
        expect(unread()).toBe(18);
        clock.advance(1120);
        expect(unread()).toBe(17);
        expect(calls[1].changed).toMatchObject([{ isViewable: true, key: "3" }]);
    } finally {
        clock.restore();
        ctx.state.scheduledWork.dispose();
    }
});
