import { expect, mock, test } from "bun:test";
import "../setup";
import React from "react";

import { getIndexedData } from "../../src/core/IndexedData";
import { resetViewabilityTimers } from "../../src/core/viewability";
import { type StateContext, set$, useStateContext } from "../../src/state/state";
import type { DataSourceMutationBatch } from "../../src/types.base";
import { act, render } from "../helpers/testingLibrary";
import { createViewabilityClock } from "../helpers/viewabilityClock";

let scenarioId = 0;

async function mountScenario(mode: "array" | "source" = "array", minimumViewTime = 100) {
    let ctx!: StateContext;
    let listProps: any;
    let listener!: (batch: DataSourceMutationBatch) => void;
    let revision = 0;
    let items = Array.from({ length: 20 }, (_, index) => ({ id: String(index), text: "original" }));
    const subscribe = mock((onBatch: typeof listener) => {
        listener = onBatch;
        return () => {};
    });
    const source = {
        getItem: (index: number) => items[index],
        getKey: (index: number) => items[index].id,
        getLength: () => items.length,
        getRevision: () => revision,
        subscribe,
    };
    mock.module("@/components/ListComponent", () => ({
        ListComponent: (componentProps: any) => {
            ctx = useStateContext();
            listProps = componentProps;
            return null;
        },
    }));
    const { LegendList } = await import(`../../src/components/LegendList?mounted-timing-${scenarioId++}`);
    const callback = mock((_info: any) => {});
    const props = {
        ...(mode === "source" ? { dataSource: source } : { data: items }),
        estimatedItemSize: 100,
        estimatedListSize: { height: 100, width: 320 },
        keyExtractor: (item: { id: string }) => item.id,
        onViewableItemsChanged: callback,
        recycleItems: false,
        renderItem: () => null,
        viewabilityConfig: { id: "", itemVisiblePercentThreshold: 50, minimumViewTime },
    };
    const screen = render(React.createElement(LegendList, props));
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const clock = createViewabilityClock(ctx.state.scheduledWork);
    resetViewabilityTimers(ctx);
    callback.mockClear();
    await act(async () => {
        listProps.onLayout({ nativeEvent: { layout: { height: 100, width: 320, x: 0, y: 0 } } });
        ctx.state.triggerCalculateItemsInView!({ forceFullItemPositions: true });
    });
    return {
        advance: async (time: number) => act(async () => clock.advance(time)),
        callback,
        clock,
        ctx,
        dispose() {
            screen.unmount();
            clock.restore();
        },
        props,
        rerender: async (patch: Record<string, unknown>) =>
            act(async () => screen.rerender(React.createElement(LegendList, { ...props, ...patch }))),
        scroll: async (offset: number, cached = false) => {
            ctx.state.scroll = offset;
            ctx.state.scrollPending = offset;
            if (cached) {
                ctx.state.enableScrollForNextCalculateItemsInView = true;
                ctx.state.scrollForNextCalculateItemsInView = { bottom: 10000, top: null };
            }
            await act(async () => ctx.state.triggerCalculateItemsInView!({ forceFullItemPositions: !cached }));
        },
        source,
        subscribe,
        update: async (reset: boolean, inPlace = false) => {
            await act(async () => {
                if (inPlace) items[0].text = "updated";
                else items = items.map((item) => ({ ...item, text: "updated" }));
                const previousRevision = revision++;
                listener({
                    length: items.length,
                    operations: reset
                        ? [{ type: "reset" }]
                        : [{ count: 1, index: 0, layout: "preserve", type: "update" }],
                    previousLength: items.length,
                    previousRevision,
                    revision,
                });
            });
        },
    };
}

// Keep mounted ListComponent mocks isolated from other component suites.
test("does not publish a new row on the previous row's visibility deadline", async () => {
    const s = await mountScenario();
    try {
        await s.advance(90);
        await s.scroll(100);
        await s.advance(100);
        expect(s.callback).not.toHaveBeenCalled();
        await s.advance(190);
        expect(s.callback).toHaveBeenCalledTimes(1);
        expect(s.callback.mock.calls[0][0].viewableItems.map((item: any) => item.key)).toEqual(["1"]);
    } finally {
        s.dispose();
    }
});

for (const mode of ["array", "source"] as const) {
    for (const change of ["unrelated prop", "callback", "equivalent config", "extraData"] as const) {
        test(`preserves pending visibility across ${mode} rerenders changing ${change}`, async () => {
            const s = await mountScenario(mode);
            try {
                const adapter = getIndexedData(s.ctx.state);
                const replacement = mock((_info: any) => {});
                await s.advance(50);
                await s.rerender(
                    change === "callback"
                        ? { onViewableItemsChanged: replacement }
                        : change === "equivalent config"
                          ? { viewabilityConfig: { ...s.props.viewabilityConfig } }
                          : change === "extraData"
                            ? { extraData: 1 }
                            : { testID: "parent-rerender" },
                );
                expect(getIndexedData(s.ctx.state)).toBe(adapter);
                expect(s.clock.pending.size).toBe(1);
                await s.advance(99);
                expect(s.callback).not.toHaveBeenCalled();
                expect(replacement).not.toHaveBeenCalled();
                await s.advance(100);
                const target = change === "callback" ? replacement : s.callback;
                expect(target).toHaveBeenCalledTimes(1);
                expect(target.mock.calls[0][0].viewableItems.map((item: any) => item.key)).toEqual(["0"]);
                if (mode === "source") expect(s.subscribe).toHaveBeenCalledTimes(1);
            } finally {
                s.dispose();
            }
        });
    }
}

for (const inPlace of [false, true]) {
    test(`retains pending source visibility after a preserve update (in-place: ${inPlace})`, async () => {
        const s = await mountScenario("source");
        try {
            await s.advance(50);
            await s.update(false, inPlace);
            await s.advance(100);
            expect(s.callback).toHaveBeenCalledTimes(1);
            expect(s.callback.mock.calls[0][0].viewableItems[0].item.text).toBe("updated");
        } finally {
            s.dispose();
        }
    });
}

for (const mode of ["reset", "replace"] as const) {
    test(`restarts pending visibility after source ${mode} with reused keys`, async () => {
        const s = await mountScenario("source");
        try {
            await s.advance(50);
            if (mode === "reset") await s.update(true);
            else await s.rerender({ dataSource: { ...s.source } });
            await s.advance(100);
            expect(s.callback).not.toHaveBeenCalled();
            await s.advance(149);
            expect(s.callback).not.toHaveBeenCalled();
            await s.advance(150);
            expect(s.callback).toHaveBeenCalledTimes(1);
        } finally {
            s.dispose();
        }
    });
}

for (const cached of [false, true]) {
    test(`restarts pending visibility after an empty footer viewport (cached range: ${cached})`, async () => {
        const s = await mountScenario("source");
        try {
            set$(s.ctx, "footerSize", 1000);
            await s.advance(50);
            await s.scroll(2100, cached);
            expect(s.ctx.state.startNoBuffer).toBeNull();
            expect(s.clock.pending.size).toBe(0);
            await s.advance(80);
            await s.scroll(0, cached);
            await s.advance(100);
            expect(s.callback).not.toHaveBeenCalled();
            await s.advance(179);
            expect(s.callback).not.toHaveBeenCalled();
            await s.advance(180);
            expect(s.callback).toHaveBeenCalledTimes(1);
        } finally {
            s.dispose();
        }
    });

    for (const minimumViewTime of [0, 100]) {
        test(`publishes exits and fresh entries around an empty viewport (minimum: ${minimumViewTime}, cached: ${cached})`, async () => {
            const s = await mountScenario("array", minimumViewTime);
            try {
                set$(s.ctx, "footerSize", 1000);
                await s.advance(100);
                expect(s.ctx.mapViewabilityConfigStates.get("")!.viewableItems.map((item) => item.key)).toEqual(["0"]);
                s.callback.mockClear();
                await s.advance(150);
                await s.scroll(2100, cached);
                expect(s.callback).toHaveBeenCalledTimes(1);
                expect(s.callback.mock.calls[0][0].changed).toMatchObject([{ isViewable: false, key: "0" }]);
                expect(s.callback.mock.calls[0][0].viewableItems).toEqual([]);
                await s.advance(180);
                await s.scroll(0, cached);
                if (minimumViewTime > 0) {
                    await s.advance(279);
                    expect(s.callback).toHaveBeenCalledTimes(1);
                    await s.advance(280);
                }
                expect(s.callback).toHaveBeenCalledTimes(2);
                expect(s.callback.mock.calls[1][0].changed).toMatchObject([{ isViewable: true, key: "0" }]);
            } finally {
                s.dispose();
            }
        });
    }
}

for (const mode of ["array", "source"] as const) {
    test(`resumes delayed visibility on an idle Strict Mode ${mode} mount`, async () => {
        const items = [{ id: "visible" }, { id: "below" }];
        const callback = mock((_info: any) => {});
        mock.module("@/components/ListComponent", () => ({
            ListComponent: (props: any) => {
                React.useLayoutEffect(() => {
                    props.onLayout({ nativeEvent: { layout: { height: 100, width: 320, x: 0, y: 0 } } });
                }, []);
                return null;
            },
        }));
        const { LegendList } = await import(`../../src/components/LegendList?strict-idle-${mode}`);
        const screen = render(
            <React.StrictMode>
                <LegendList
                    {...(mode === "array"
                        ? { data: items }
                        : {
                              dataSource: {
                                  getItem: (index: number) => items[index],
                                  getKey: (index: number) => items[index].id,
                                  getLength: () => items.length,
                                  getRevision: () => 0,
                                  subscribe: () => () => {},
                              },
                          })}
                    estimatedItemSize={100}
                    estimatedListSize={{ height: 100, width: 320 }}
                    keyExtractor={(item: { id: string }) => item.id}
                    onViewableItemsChanged={callback}
                    recycleItems={false}
                    renderItem={() => null}
                    viewabilityConfig={{ minimumViewTime: 40 }}
                />
            </React.StrictMode>,
        );
        try {
            expect(callback).not.toHaveBeenCalled();
            await act(async () => new Promise((resolve) => setTimeout(resolve, 100)));
            expect(callback).toHaveBeenCalledTimes(1);
            expect(callback.mock.calls[0][0].viewableItems.map((item: any) => item.key)).toEqual(["visible"]);
        } finally {
            screen.unmount();
        }
        await act(async () => new Promise((resolve) => setTimeout(resolve, 60)));
        expect(callback).toHaveBeenCalledTimes(1);
    });
}
