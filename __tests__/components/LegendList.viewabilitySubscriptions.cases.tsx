// Keep mounted ListComponent mocks isolated from other component suites.
import { expect, mock, test } from "bun:test";
import "../setup";
import React from "react";

import { ContextContainer, useViewability, useViewabilityAmount } from "../../src/state/ContextContainer";
import { useStateContext } from "../../src/state/state";
import { act, render } from "../helpers/testingLibrary";

for (const kind of ["item", "amount"])
    test(`all sibling ${kind} hooks receive initial visibility`, async () => {
        let ctx: any,
            listProps: any,
            enabled = false;
        const callbacks = new Map();
        function Row({ id }: any) {
            const cb = callbacks.get(id);
            const useVisibilityHook = kind === "item" ? useViewability : useViewabilityAmount;
            useVisibilityHook(cb);
            return null;
        }
        mock.module("@/components/ListComponent", () => ({
            ListComponent: (componentProps: any) => {
                ctx = useStateContext();
                listProps = componentProps;
                if (!enabled) return null;
                return Array.from(ctx.state.containerItemKeys, ([key, id]: any) => {
                    if (!callbacks.has(id))
                        callbacks.set(
                            id,
                            mock(() => {}),
                        );
                    return React.createElement(
                        ContextContainer.Provider,
                        { key, value: { containerId: id, triggerLayout: () => {} } },
                        React.createElement(Row, { id }),
                    );
                });
            },
        }));
        const { LegendList } = await import(`../../src/components/LegendList?review-sibling-hooks-${kind}`);
        const props = {
            data: Array.from({ length: 20 }, (_, i) => ({ id: String(i) })),
            estimatedItemSize: 50,
            estimatedListSize: { height: 200, width: 320 },
            keyExtractor: (i: any) => i.id,
            recycleItems: false,
            renderItem: () => null,
            viewabilityConfig: { id: "", itemVisiblePercentThreshold: 50 },
        };
        const screen = render(React.createElement(LegendList, props));
        try {
            await act(async () => {
                await new Promise((r) => setTimeout(r, 0));
            });
            await act(async () =>
                listProps.onLayout({ nativeEvent: { layout: { height: 200, width: 320, x: 0, y: 0 } } }),
            );
            enabled = true;
            await act(async () => screen.rerender(React.createElement(LegendList, { ...props, extraData: 1 })));
            const counts = [0, 1, 2].map(
                (i) => callbacks.get(ctx.state.containerItemKeys.get(String(i)))?.mock.calls.length ?? 0,
            );
            expect(counts).toEqual([1, 1, 1]);
            const firstId = ctx.state.containerItemKeys.get("0");
            const previous = callbacks.get(firstId);
            const replacement = mock(() => {});
            callbacks.set(firstId, replacement);
            await act(async () => screen.rerender(React.createElement(LegendList, { ...props, extraData: 2 })));
            expect(replacement).not.toHaveBeenCalled();
            const token =
                kind === "item"
                    ? ctx.mapViewabilityValues.get(String(firstId))
                    : ctx.mapViewabilityAmountValues.get(firstId);
            const notify =
                kind === "item"
                    ? ctx.mapViewabilityCallbacks.get(String(firstId))
                    : ctx.mapViewabilityAmountCallbacks.get(firstId);
            await act(async () => notify(token));
            expect(replacement).toHaveBeenCalledWith(token);
            expect(previous).toHaveBeenCalledTimes(1);
        } finally {
            screen.unmount();
        }
    });
