// Isolated process: mock only the native view boundary, not list orchestration,
// scroll adjustment, measurement batching, layout, or recycled row assignment.
import { expect, mock, test } from "bun:test";
import "../setup";
import React from "react";

import { measureContainersInLayoutEffect } from "../../src/core/measureContainersInLayoutEffect.native";
import { Platform } from "../../src/platform/Platform";
import { type StateContext, useStateContext } from "../../src/state/state";
import { act, render } from "../helpers/testingLibrary";

for (const sourceMode of [false, true]) {
    test(`scrollbar jumps with delayed variable-height measurements (${sourceMode ? "indexed source" : "array"})`, async () => {
        const previousPlatform = Platform.OS;
        Platform.OS = "macos";
        let ctx!: StateContext;
        let listProps: any;
        mock.module("@/components/ListComponent", () => ({
            ListComponent: (props: any) => {
                ctx = useStateContext();
                listProps = props;
                return null;
            },
        }));
        const { LegendList } = await import(`../../src/components/LegendList?scrollbar-measurements-${sourceMode}`);
        const count = 86016; // Comparable to the reported 10 MB Markdown file.
        const items = Array.from({ length: count }, (_, index) => ({ id: `row-${index}` }));
        const source = {
            getItem: (index: number) => items[index],
            getKey: (index: number) => items[index].id,
            getLength: () => count,
            getRevision: () => 0,
            subscribe: () => () => {},
        };
        const rendered = render(
            React.createElement(LegendList, {
                ...(sourceMode ? { dataSource: source } : { data: items }),
                estimatedItemSize: 100,
                estimatedListSize: { height: 668, width: 900 },
                keyExtractor: (item: { id: string }) => item.id,
                maintainVisibleContentPosition: { data: false, size: true },
                recycleItems: true,
                renderItem: () => null,
            }),
        );
        const scroll = async (offset: number) => {
            await act(async () =>
                listProps.onScroll({
                    nativeEvent: {
                        contentOffset: { x: 0, y: offset },
                        contentSize: { height: ctx.state.totalSize, width: 900 },
                    },
                }),
            );
        };
        const measure = async (index: number, height: number) => {
            const key = items[index].id;
            const container = ctx.state.containerItemKeys.get(key)!;
            expect(container).toBeDefined();
            let callback!: (x: number, y: number, width: number, measuredHeight: number) => void;
            ctx.viewRefs.set(container, {
                current: {
                    measure: (next: typeof callback) => {
                        callback = next;
                    },
                },
            } as any);
            measureContainersInLayoutEffect(ctx, new Set([container]));
            expect(callback).toBeDefined();
            await act(async () => callback(0, 0, 900, height));
        };
        const assertViewport = (offset: number) => {
            expect(ctx.state.lastNativeScroll).toBe(offset);
            expect(ctx.state.scroll).toBe(offset);
            expect(ctx.state.endNoBuffer).toBeGreaterThanOrEqual(ctx.state.startNoBuffer);
            for (let index = ctx.state.startNoBuffer; index <= ctx.state.endNoBuffer; index++) {
                const container = ctx.state.containerItemKeys.get(items[index].id);
                expect(container).toBeDefined();
                expect(ctx.values.get(`containerItemIndex${container}`)).toBe(index);
            }
        };
        try {
            await act(async () =>
                listProps.onLayout({
                    nativeEvent: {
                        layout: { height: 668, width: 900, x: 0, y: 0 },
                    },
                }),
            );
            // Finish initial native layout using the same delayed measure callback path.
            for (const key of [...ctx.state.containerItemKeys.keys()]) {
                await measure(Number(key.slice(4)), 100);
            }
            let scenario = 0;
            for (const height of [40, 220]) {
                for (const destination of [72000, 1000, 43000, 84000, 2000]) {
                    await scroll(3000000 + scenario++ * 10000);
                    await act(async () => {
                        await new Promise((resolve) => requestAnimationFrame(resolve));
                    });
                    const anchor = ctx.state.startNoBuffer;
                    // Materialize the preceding buffered row before moving its anchor.
                    const before = ctx.state.scroll;
                    await measure(anchor - 1, height);
                    expect(ctx.state.scroll).not.toBe(before);
                    const offset = ctx.state.layoutStoreRuntime!.store.getOffset(destination);
                    await scroll(offset);
                    assertViewport(offset);
                    expect(ctx.state.startNoBuffer).toBe(destination);
                    expect(ctx.state.ignoreScrollFromMVCP).toBeUndefined();
                    // The original bug also persisted after the 100 ms suppression timer.
                    await act(async () => {
                        await new Promise((resolve) => setTimeout(resolve, 120));
                    });
                    assertViewport(offset);
                }
            }
        } finally {
            rendered.unmount();
            Platform.OS = previousPlatform;
        }
    });
}
