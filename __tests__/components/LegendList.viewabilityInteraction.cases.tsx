import { expect, mock, test } from "bun:test";
import "../setup";
import React from "react";

import { useStateContext } from "../../src/state/state";
import { act, render } from "../helpers/testingLibrary";

for (const interaction of ["record", "drag", "scroll"]) {
    test(`waits for ${interaction} interaction before publishing visibility`, async () => {
        let ctx: any, listProps: any;
        mock.module("@/components/ListComponent", () => ({
            ListComponent: (props: any) => {
                ctx = useStateContext();
                listProps = props;
                return null;
            },
        }));
        const { LegendList } = await import(`../../src/components/LegendList?viewability-interaction-${interaction}`);
        const callback = mock(() => {});
        const ungated = mock(() => {});
        const ref = React.createRef<any>();
        const screen = render(
            React.createElement(LegendList, {
                data: Array.from({ length: 20 }, (_, index) => ({ id: String(index) })),
                estimatedItemSize: 100,
                estimatedListSize: { height: 100, width: 320 },
                keyExtractor: (item: any) => item.id,
                onViewableItemsChanged: callback,
                recycleItems: false,
                ref,
                renderItem: () => null,
                viewabilityConfig: { waitForInteraction: true },
                viewabilityConfigCallbackPairs: [
                    { onViewableItemsChanged: ungated, viewabilityConfig: { id: "ungated" } },
                ],
            }),
        );
        try {
            await act(async () => {
                await new Promise((resolve) => setTimeout(resolve, 0));
            });
            await act(async () =>
                listProps.onLayout({ nativeEvent: { layout: { height: 100, width: 320, x: 0, y: 0 } } }),
            );
            expect(callback).not.toHaveBeenCalled();
            expect(ungated).toHaveBeenCalled();
            // A repeated calculation is not an interaction.
            await act(async () => ctx.state.triggerCalculateItemsInView({ forceFullItemPositions: true }));
            expect(callback).not.toHaveBeenCalled();
            await act(async () => {
                if (interaction === "record") ref.current.recordInteraction();
                else if (interaction === "drag") listProps.onInternalScrollBeginDrag({ nativeEvent: {} });
                else
                    listProps.onScroll({
                        nativeEvent: { contentOffset: { x: 0, y: 100 }, contentSize: { height: 2000, width: 320 } },
                    });
            });
            expect(callback).toHaveBeenCalled();
            const count = callback.mock.calls.length;
            await act(async () => ref.current.recordInteraction());
            expect(callback).toHaveBeenCalledTimes(count);
        } finally {
            screen.unmount();
        }
    });
}
