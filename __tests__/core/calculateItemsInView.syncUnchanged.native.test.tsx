import { describe, expect, it, spyOn } from "bun:test";
import { getLayoutValue } from "../helpers/layoutStore";
import "../setup";
import * as React from "react";

import * as syncModule from "../../src/core/syncMountedContainer";
import { updateItemSizes } from "../../src/core/updateItemSizes";
import { Platform } from "../../src/platform/Platform";
import * as stateModule from "../../src/state/state";
import { act, render } from "../helpers/testingLibrary";
import { installFakeClock } from "../helpers/webScrollHarness";

const VIEW = 800;
const SIZE = 70;
const N = 2000;

async function renderScrollableList(listProps: Record<string, unknown> = {}) {
    Platform.OS = "ios";
    const clock = installFakeClock();
    spyOn(Date, "now").mockImplementation(() => clock.now);
    let ctx!: stateModule.StateContext;
    let scrollProps: any;
    let offset = 0;
    function Surface(props: any) {
        ctx = stateModule.useStateContext();
        scrollProps = props;
        React.useImperativeHandle(props.ref, () => ({
            getCurrentScrollOffset: () => offset,
            getScrollableNode: () => ({}),
            measure: (cb: any) => cb(0, 0, 300, VIEW),
            scrollTo: () => {},
        }));
        return <>{props.children}</>;
    }
    const { LegendList } = await import("../../src/components/LegendList?syncUnchanged");
    const result = render(
        <LegendList
            data={Array.from({ length: N }, (_, i) => String(i))}
            drawDistance={VIEW * 2}
            estimatedItemSize={SIZE}
            estimatedListSize={{ height: VIEW, width: 300 }}
            getFixedItemSize={() => SIZE}
            keyExtractor={(item: string) => item}
            recycleItems
            renderItem={() => null}
            renderScrollComponent={(props: any) => <Surface {...props} />}
            {...listProps}
        />,
    );
    for (let frame = 0; frame < 20; frame++) act(() => clock.tick(16));
    const scrollTo = (next: number) => {
        offset = next;
        act(() => {
            clock.tick(16);
            scrollProps.onScroll({
                nativeEvent: {
                    contentInset: { bottom: 0, left: 0, right: 0, top: 0 },
                    contentOffset: { x: 0, y: offset },
                    contentSize: { height: N * SIZE, width: 300 },
                    layoutMeasurement: { height: VIEW, width: 300 },
                },
            });
        });
    };
    return { clock, ctx, result, scrollTo };
}

describe("calculateItemsInView container sync", () => {
    it("syncs only newly assigned containers while positions are unchanged", async () => {
        const list = await renderScrollableList();
        const sync = spyOn(syncModule, "syncMountedContainer");
        let assigned = 0;
        const realSet = stateModule.set$;
        spyOn(stateModule, "set$").mockImplementation((ctx, key, value) => {
            if (key.startsWith("containerItemKey") && stateModule.peek$(ctx, key) !== value) assigned++;
            realSet(ctx, key, value);
        });

        let velocity = 8;
        let offset = 0;
        while (velocity > 0.05) {
            offset += velocity * 16;
            velocity *= 0.998 ** 16;
            list.scrollTo(offset);
        }

        expect(assigned).toBeGreaterThan(0);
        expect(sync.mock.calls.length).toBe(assigned);
        list.result.unmount();
        list.clock.restore();
    });

    it("notifies each container subscriber once per recycle", async () => {
        const list = await renderScrollableList();
        const calls = new Map<unknown, number>();
        // One counting wrapper per subscriber, shared across its signals like the original.
        const wrappers = new Map<(value: unknown) => void, (value: unknown) => void>();
        for (const [name, listeners] of list.ctx.listeners) {
            if (!name.startsWith("container")) continue;
            for (const listener of [...listeners]) {
                let wrapper = wrappers.get(listener);
                if (!wrapper) {
                    wrapper = (value) => {
                        calls.set(listener, (calls.get(listener) ?? 0) + 1);
                        listener(value);
                    };
                    wrappers.set(listener, wrapper);
                }
                listeners.delete(listener);
                listeners.add(wrapper);
            }
        }

        let repeats = 0;
        for (let offset = 16; offset < SIZE * 60; offset += 16) {
            calls.clear();
            list.scrollTo(offset);
            for (const count of calls.values()) repeats += count - 1;
        }

        expect(repeats).toBe(0);
        list.result.unmount();
        list.clock.restore();
    });

    it("re-syncs every mounted container after an earlier row changes size", async () => {
        const list = await renderScrollableList({ getFixedItemSize: undefined, maintainVisibleContentPosition: false });
        list.scrollTo(SIZE * 40);
        const { ctx } = list;
        const key = ctx.state.startBufferedId!;
        act(() => {
            updateItemSizes(ctx, { itemKey: key, size: { height: SIZE * 3, width: 300 } });
        });
        list.scrollTo(SIZE * 40 + 4);
        for (let i = 0; i < stateModule.peek$(ctx, "numContainers"); i++) {
            const itemKey = stateModule.peek$(ctx, `containerItemKey${i}`);
            if (itemKey === undefined) continue;
            const index = ctx.state.indexByKey.get(itemKey)!;
            expect(stateModule.peek$(ctx, `containerPosition${i}`)).toBe(getLayoutValue(ctx.state, "positions", index));
        }
        list.result.unmount();
        list.clock.restore();
    });
});
