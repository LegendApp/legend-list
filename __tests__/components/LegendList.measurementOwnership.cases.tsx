// Runs in a fresh process so ListComponent mocks cannot leak into other mounted suites.
import { expect, mock, spyOn, test } from "bun:test";
import "../setup";
import React from "react";

import { materializeLayoutStoreRange } from "../../src/core/layoutStoreLifecycle";
import { measureContainersInLayoutEffect } from "../../src/core/measureContainersInLayoutEffect.native";
import { getContainerLayoutEffectScope } from "../../src/core/scheduleContainerLayout";
import { updateItemSizesBatch } from "../../src/core/updateItemSizes";
import { processContainerLayout } from "../../src/hooks/useContainerMeasurement";
import { peek$, type StateContext, useStateContext } from "../../src/state/state";
import type { LegendListRef } from "../../src/types.base";
import { clearWarnDevOnceForTests } from "../../src/utils/helpers";
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

for (const hideItemsUntilMeasured of [false, true]) {
    test(`keeps measured index layout and scroll after append (hide until measured: ${hideItemsUntilMeasured})`, async () => {
        let ctx!: StateContext;
        let listProps: any;
        mock.module("@/components/ListComponent", () => ({
            ListComponent: (componentProps: any) => {
                ctx = useStateContext();
                listProps = componentProps;
                return null;
            },
        }));
        const { LegendList } = await import(`../../src/components/LegendList?index-append-${hideItemsUntilMeasured}`);
        const data = Array.from({ length: 200 }, (_, index) => ({ height: index % 2 ? 160 : 40 }));
        const ref = React.createRef<LegendListRef>();
        const props = {
            data,
            estimatedItemSize: 100,
            estimatedListSize: { height: 300, width: 320 },
            experimental_hideItemsUntilMeasured: hideItemsUntilMeasured,
            ref,
            renderItem: () => null,
        };
        const screen = render(<LegendList {...props} />);
        await act(async () => {
            listProps.onLayout({ nativeEvent: { layout: { height: 300, width: 320, x: 0, y: 0 } } });
            materializeLayoutStoreRange(ctx, 0, data.length - 1);
            updateItemSizesBatch(
                ctx,
                data.map((item, index) => ({
                    itemKey: String(index),
                    size: { height: item.height, width: 320 },
                })),
            );
            listProps.onScroll({
                nativeEvent: {
                    contentOffset: { x: 0, y: 15000 },
                    contentSize: { height: 20000, width: 320 },
                    layoutMeasurement: { height: 300, width: 320 },
                },
            });
        });
        await act(async () => {
            for (const [key, containerId] of ctx.state.containerItemKeys) {
                ctx.viewRefs.set(containerId, {
                    current: { measure: (callback: any) => callback(0, 0, 320, data[Number(key)].height) },
                } as any);
            }
            measureContainersInLayoutEffect(ctx);
        });
        const previousAverage = { ...ctx.state.averageSizes[""] };
        expect(previousAverage.avg).toBeCloseTo(100);
        expect(previousAverage.num).toBe(200);
        const before = ref.current!.getState();
        expect(before.start).toBe(150);
        expect(before.scroll).toBe(15000);
        const previousOffset = before.positionAtIndex(150);
        expect(previousOffset).toBe(15000);
        const store = ctx.state.layoutStoreRuntime!.store;
        expect(store.getMeasuredCount()).toBe(200);
        const anchorContainerId = ctx.state.containerItemKeys.get("150")!;
        if (hideItemsUntilMeasured) expect(peek$(ctx, `containerLayoutReady${anchorContainerId}`)).toBe(true);
        await act(async () => {
            screen.rerender(<LegendList {...props} data={[...data, ...data.slice(0, 20)]} />);
        });
        const after = ref.current!.getState();
        expect(after.start).toBe(before.start);
        expect(after.scroll).toBe(before.scroll);
        expect(after.positionAtIndex(150)).toBe(previousOffset);
        expect(store.getMeasuredCount()).toBe(200);
        expect(ctx.state.sizes.size).toBe(0);
        expect(ctx.state.averageSizes[""]).toEqual(previousAverage);
        if (hideItemsUntilMeasured) expect(peek$(ctx, `containerLayoutReady${anchorContainerId}`)).toBe(true);
        screen.unmount();
    });
}

test("replaces content at the same index and corrects subsequent offsets on layout", async () => {
    let ctx!: StateContext;
    let listProps: any;
    mock.module("@/components/ListComponent", () => ({
        ListComponent: (componentProps: any) => {
            ctx = useStateContext();
            listProps = componentProps;
            return null;
        },
    }));
    const { LegendList } = await import("../../src/components/LegendList?index-replacement");
    const data = Array.from({ length: 10 }, () => ({ height: 40 }));
    const props = {
        data,
        estimatedItemSize: 40,
        estimatedListSize: { height: 300, width: 320 },
        renderItem: () => null,
    };
    const screen = render(<LegendList {...props} />);
    await act(async () => {
        listProps.onLayout({ nativeEvent: { layout: { height: 300, width: 320, x: 0, y: 0 } } });
        materializeLayoutStoreRange(ctx, 0, 9);
        updateItemSizesBatch(
            ctx,
            data.map((item, index) => ({ itemKey: String(index), size: { height: item.height, width: 320 } })),
        );
    });
    const store = ctx.state.layoutStoreRuntime!.store;
    expect(store.getOffset(4)).toBe(160);
    const replacement = data.map((item, index) => (index === 3 ? { height: 160 } : item));
    await act(async () => screen.rerender(<LegendList {...props} data={replacement} />));
    expect(store.getSize(3)).toBe(40);
    const containerId = ctx.state.containerItemKeys.get("3")!;
    expect(peek$(ctx, `containerItemData${containerId}`)).toBe(replacement[3]);
    await act(async () =>
        processContainerLayout({
            containerId,
            ctx,
            rectangle: { height: 160, width: 320, x: 0, y: 0 },
            ref: { current: null },
            state: { didLayout: true, horizontal: false, itemKey: "3", lastSize: { height: 40, width: 320 } },
        }),
    );
    expect(store.getSize(3)).toBe(160);
    expect(store.getOffset(4)).toBe(280);
    expect(ctx.state.sizesKnown.get("3")).toBe(160);
    screen.unmount();
});

for (const keyed of [false, true]) {
    test(`warns once on index-keyed data changes (keyExtractor: ${keyed})`, async () => {
        clearWarnDevOnceForTests();
        const warn = spyOn(console, "warn").mockImplementation(() => {});
        const warnings = () => warn.mock.calls.filter(([message]) => String(message).startsWith("[legend-list]"));
        mock.module("@/components/ListComponent", () => ({ ListComponent: () => null }));
        const { LegendList } = await import(`../../src/components/LegendList?index-warning-${keyed}`);
        const props = {
            data: [{ id: "a" }],
            estimatedItemSize: 40,
            estimatedListSize: { height: 300, width: 320 },
            keyExtractor: keyed ? (item: { id: string }) => item.id : undefined,
            recycleItems: false,
            renderItem: () => null,
        };
        const screen = render(<LegendList {...props} />);
        try {
            expect(warnings()).toEqual([]);
            await act(async () => screen.rerender(<LegendList {...props} data={[...props.data, { id: "b" }]} />));
            expect(warnings()).toHaveLength(keyed ? 0 : 1);
            await act(async () =>
                screen.rerender(<LegendList {...props} data={[...props.data, { id: "b" }, { id: "c" }]} />),
            );
            if (keyed) expect(warnings()).toEqual([]);
            else {
                expect(warnings()).toHaveLength(1);
                expect(warnings()[0][0]).toBe(
                    "[legend-list] Without a keyExtractor, measured sizes stay with their index. Appends keep layout, but inserts, removals, and reorders move content to rows with the wrong size. Pass a keyExtractor that returns a stable unique id.",
                );
            }
        } finally {
            screen.unmount();
            warn.mockRestore();
        }
    });
}

for (const numColumns of [1, 2]) {
    for (const invalidSize of [Number.NaN, -10, Number.POSITIVE_INFINITY]) {
        for (const input of ["estimate", "fixed", "measurement"] as const) {
            test(`does not throw for an invalid public ${input} size (${invalidSize}, ${numColumns} columns)`, async () => {
                let ctx!: StateContext;
                let listProps: any;
                clearWarnDevOnceForTests();
                const warn = spyOn(console, "warn").mockImplementation(() => {});
                mock.module("@/components/ListComponent", () => ({
                    ListComponent: (componentProps: any) => {
                        ctx = useStateContext();
                        listProps = componentProps;
                        return null;
                    },
                }));
                const { LegendList } = await import(
                    `../../src/components/LegendList?invalid-size-${input}-${invalidSize}-${numColumns}`
                );
                const ref = React.createRef<LegendListRef>();
                const screen = render(
                    <LegendList
                        data={[{ height: input === "fixed" ? invalidSize : 40 }, { height: 40 }, { height: 40 }]}
                        estimatedItemSize={input === "estimate" ? invalidSize : 40}
                        estimatedListSize={{ height: 300, width: 320 }}
                        getFixedItemSize={input === "fixed" ? (item: { height: number }) => item.height : undefined}
                        numColumns={numColumns}
                        recycleItems={false}
                        ref={ref}
                        renderItem={() => null}
                    />,
                );
                try {
                    await act(async () =>
                        listProps.onLayout({ nativeEvent: { layout: { height: 300, width: 320, x: 0, y: 0 } } }),
                    );
                    const store = ctx.state.layoutStoreRuntime!.store;
                    materializeLayoutStoreRange(ctx, 0, 2);
                    if (input === "measurement")
                        await act(async () => ref.current!.setItemSize("0", { height: invalidSize, width: 320 }));
                    expect(store.getSize(0)).toBe(0);
                    if (input === "estimate") expect(ctx.state.props.estimatedItemSize).toBe(0);
                    else expect(ctx.state.sizesKnown.get("0")).toBe(0);
                    expect(Number.isFinite(store.getTotalSize())).toBe(true);
                    const sizeWarnings = warn.mock.calls.filter(([message]) =>
                        String(message).includes("Item sizes must be finite non-negative numbers"),
                    );
                    expect(sizeWarnings).toHaveLength(1);
                    // A subsequent valid public measurement still corrects geometry.
                    await act(async () => ref.current!.setItemSize("0", { height: 60, width: 320 }));
                    expect(store.getSize(0)).toBe(60);
                    expect(ctx.state.sizesKnown.get("0")).toBe(60);
                } finally {
                    screen.unmount();
                    warn.mockRestore();
                }
            });
        }
    }
}
