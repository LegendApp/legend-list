// Runs in a fresh process so ListComponent mocks cannot leak into other mounted suites.
import { expect, mock, test } from "bun:test";
import "../setup";
import React from "react";

import { measureContainersInLayoutEffect } from "../../src/core/measureContainersInLayoutEffect.native";
import { getContainerLayoutEffectScope } from "../../src/core/scheduleContainerLayout";
import { updateItemSizesBatch } from "../../src/core/updateItemSizes";
import { useStateContext } from "../../src/state/state";
import { act, render } from "../helpers/testingLibrary";

for (const mode of ["invalidate", "reset", "replace", "revision-gap"])
    test(`reject a pre-${mode} measurement for reused keys`, async () => {
        let ctx: any,
            listProps: any,
            listener: any,
            revision = 0;
        let items = Array.from({ length: 20 }, (_, i) => ({ id: String(i), text: "old" }));
        mock.module("@/components/ListComponent", () => ({
            ListComponent: (componentProps: any) => {
                ctx = useStateContext();
                listProps = componentProps;
                return null;
            },
        }));
        const { LegendList } = await import(`../../src/components/LegendList?review-reset-${mode}`);
        const source = {
            getItem: (i: number) => items[i],
            getKey: (i: number) => items[i].id,
            getLength: () => items.length,
            getRevision: () => revision,
            subscribe: (l: any) => {
                listener = l;
                return () => {};
            },
        };
        const props = {
            dataSource: source,
            estimatedItemSize: 50,
            estimatedListSize: { height: 100, width: 320 },
            recycleItems: false,
            renderItem: () => null,
        };
        const rendered = render(React.createElement(LegendList, props));
        try {
            await act(async () => {
                await new Promise((r) => setTimeout(r, 0));
            });
            await act(async () =>
                listProps.onLayout({ nativeEvent: { layout: { height: 100, width: 320, x: 0, y: 0 } } }),
            );
            await act(async () =>
                updateItemSizesBatch(
                    ctx,
                    Array.from(ctx.state.containerItemKeys, ([itemKey, measuredContainerId]: any) => ({
                        containerId: measuredContainerId,
                        itemKey,
                        size: { height: 50, width: 320 },
                    })),
                ),
            );
            const containerId = ctx.state.containerItemKeys.get("0");
            let oldMeasurement: any;
            ctx.viewRefs.set(containerId, {
                current: {
                    measure: (callback: any) => {
                        oldMeasurement = callback;
                    },
                },
            });
            measureContainersInLayoutEffect(ctx, new Set([containerId]));
            expect(oldMeasurement).toBeDefined();
            await act(async () => {
                items = items.map((i) => ({ ...i, text: "new" }));
                revision++;
                if (mode === "replace")
                    rendered.rerender(React.createElement(LegendList, { ...props, dataSource: { ...source } }));
                else
                    listener({
                        length: 20,
                        operations: [
                            mode === "reset"
                                ? { type: "reset" }
                                : { count: 20, index: 0, layout: "invalidate", type: "update" },
                        ],
                        previousLength: 20,
                        previousRevision: mode === "revision-gap" ? 9 : 0,
                        revision: 1,
                    });
            });
            const before = ctx.state.sizesKnown.get("0");
            await act(async () => oldMeasurement(0, 0, 320, 77));
            expect(ctx.state.sizesKnown.get("0")).toBe(before);
            measureContainersInLayoutEffect(ctx, new Set([containerId]));
            await act(async () => oldMeasurement(0, 0, 320, 88));
            expect(ctx.state.sizesKnown.get("0")).toBe(88);
        } finally {
            rendered.unmount();
        }
    });

for (const mode of ["reset", "revision-gap", "changed-key"] as const) {
    for (const horizontal of [false, true]) {
        for (const numColumns of [1, 2]) {
            test(`restores unchanged measurements after ${mode} (${horizontal ? "horizontal" : "vertical"}, ${numColumns} columns)`, async () => {
                let ctx: any;
                let listProps: any;
                let listener: any;
                let revision = 0;
                let items = Array.from({ length: 20 }, (_, index) => ({ id: String(index) }));
                mock.module("@/components/ListComponent", () => ({
                    ListComponent: (props: any) => {
                        ctx = useStateContext();
                        listProps = props;
                        return null;
                    },
                }));
                const { LegendList } = await import(
                    `../../src/components/LegendList?reset-geometry-${mode}-${horizontal}-${numColumns}`
                );
                const source = {
                    getItem: (index: number) => items[index],
                    getKey: (index: number) => items[index].id,
                    getLength: () => items.length,
                    getRevision: () => revision,
                    subscribe: (callback: any) => {
                        listener = callback;
                        return () => {};
                    },
                };
                const layout = horizontal
                    ? { height: 320, width: 100, x: 0, y: 0 }
                    : { height: 100, width: 320, x: 0, y: 0 };
                const screen = render(
                    React.createElement(LegendList, {
                        dataSource: source,
                        estimatedItemSize: 50,
                        estimatedListSize: layout,
                        horizontal,
                        numColumns,
                        recycleItems: false,
                        renderItem: () => null,
                    }),
                );
                const measure = async (scheduledScope?: Set<number> | null) => {
                    const targets = new Set<number>();
                    for (const [key, containerId] of ctx.state.containerItemKeys) {
                        const index = ctx.state.indexByKey.get(key);
                        if (index >= 6) continue;
                        // Include zero and equal-to-estimate rows as well as varying heights.
                        const size = [80, 60, 0, 120, 50, 90][index];
                        targets.add(containerId);
                        ctx.viewRefs.set(containerId, {
                            current: {
                                measure: (callback: any) =>
                                    callback(0, 0, horizontal ? size : 320, horizontal ? 320 : size),
                            },
                        });
                    }
                    await act(async () =>
                        measureContainersInLayoutEffect(ctx, scheduledScope === undefined ? targets : scheduledScope),
                    );
                };
                try {
                    await act(async () => {
                        await new Promise((resolve) => setTimeout(resolve, 0));
                    });
                    await act(async () => listProps.onLayout({ nativeEvent: { layout } }));
                    await measure();
                    expect(ctx.state.layoutStoreRuntime.store.getSize(0)).toBe(80);
                    // A second recovery must behave like the first, not leave the observer reset-only.
                    for (let round = 0; round < 2; round++) {
                        getContainerLayoutEffectScope(ctx);
                        await act(async () => {
                            const previousRevision = revision++;
                            if (mode === "changed-key") items[1] = { id: `replacement-${round}` };
                            else items = items.map((item) => ({ ...item }));
                            listener({
                                length: items.length,
                                operations:
                                    mode === "reset"
                                        ? [{ type: "reset" }]
                                        : [{ count: 1, index: 1, layout: "preserve", type: "update" }],
                                previousLength: items.length,
                                previousRevision: mode === "revision-gap" ? previousRevision + 10 : previousRevision,
                                revision,
                            });
                        });
                        expect(ctx.state.sizesKnown.has("0")).toBe(false);
                        const scope = getContainerLayoutEffectScope(ctx);
                        expect(scope).toBeNull();
                        await measure(scope);
                        const store = ctx.state.layoutStoreRuntime.store;
                        expect(store.getSize(0)).toBe(80);
                        expect(store.getSize(1)).toBe(60);
                        expect(store.getSize(2)).toBe(0);
                        expect(store.getOffset(numColumns)).toBe(80);
                        expect(store.getOffset(numColumns * 2)).toBe(numColumns === 1 ? 140 : 200);
                        expect(ctx.state.sizesKnown.get("0")).toBe(80);
                        expect(store.getMeasuredCount()).toBeGreaterThanOrEqual(3);
                    }
                } finally {
                    screen.unmount();
                }
            });
        }
    }
}
