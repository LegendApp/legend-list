// Runs in a fresh process so ListComponent mocks cannot leak into other mounted suites.
import { expect, mock, test } from "bun:test";
import "../setup";
import React from "react";

import { measureContainersInLayoutEffect } from "../../src/core/measureContainersInLayoutEffect.native";
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
