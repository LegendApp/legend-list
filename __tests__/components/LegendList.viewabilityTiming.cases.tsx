import { expect, mock, spyOn, test } from "bun:test";
import "../setup";
import React from "react";

import { useStateContext } from "../../src/state/state";
import { act, render } from "../helpers/testingLibrary";

// Keep mounted ListComponent mocks isolated from other component suites.
test("does not publish a new row on the previous row's visibility deadline", async () => {
    let ctx: any,
        listProps: any,
        now = 0;
    mock.module("@/components/ListComponent", () => ({
        ListComponent: (props: any) => {
            ctx = useStateContext();
            listProps = props;
            return null;
        },
    }));
    const { LegendList } = await import("../../src/components/LegendList?minimum-view-time");
    const callback = mock((_info: any) => {});
    const screen = render(
        React.createElement(LegendList, {
            data: Array.from({ length: 20 }, (_, index) => ({ id: String(index) })),
            estimatedItemSize: 100,
            estimatedListSize: { height: 100, width: 320 },
            keyExtractor: (item: any) => item.id,
            onViewableItemsChanged: callback,
            recycleItems: false,
            renderItem: () => null,
            viewabilityConfig: { id: "", itemVisiblePercentThreshold: 50, minimumViewTime: 100 },
        }),
    );
    try {
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 0));
        });
        const pending: Array<{ callback: () => void; at: number }> = [];
        const timer = spyOn(ctx.state.scheduledWork, "timeout").mockImplementation(
            (fn: any, delay: number, key: string) => {
                if (key.startsWith("viewability:")) pending.push({ at: now + delay, callback: fn });
            },
        );
        const clock = spyOn(Date, "now").mockImplementation(() => now);
        try {
            await act(async () =>
                listProps.onLayout({ nativeEvent: { layout: { height: 100, width: 320, x: 0, y: 0 } } }),
            );
            await act(async () => ctx.state.triggerCalculateItemsInView({ forceFullItemPositions: true }));
            expect(pending.length).toBeGreaterThan(0);
            now = 90;
            ctx.state.scroll = 100;
            ctx.state.scrollPending = 100;
            await act(async () => ctx.state.triggerCalculateItemsInView());
            now = 100;
            await act(async () => {
                for (const task of pending.filter((entry) => entry.at <= now)) task.callback();
            });
            expect(callback).not.toHaveBeenCalled();
            now = 190;
            await act(async () => {
                for (const task of pending.filter((entry) => entry.at <= now)) task.callback();
            });
            expect(callback).toHaveBeenCalledTimes(1);
            expect(callback.mock.calls[0][0].viewableItems.map((item: any) => item.key)).toEqual(["1"]);
        } finally {
            timer.mockRestore();
            clock.mockRestore();
        }
    } finally {
        screen.unmount();
    }
});
