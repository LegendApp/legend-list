import * as React from "react";
import { Text } from "react-native";

import { expect, it } from "bun:test";
import type { StateContext } from "../../src/state/state";
import { useStateContext } from "../../src/state/state";
import { act, render } from "../helpers/testingLibrary";

it("keeps retained rows cached when a child lays out before a loading-row or prepend commit", async () => {
    const { LegendList } = await import("../../src/components/LegendList");
    type Row = { id: string };
    const rows: Row[] = Array.from({ length: 100 }, (_, i) => ({ id: `row-${i}` }));
    const renders: string[] = [];
    let data = rows;
    let ctx: StateContext;
    let scrollProps: any;
    let height = 200;
    let pendingLayoutPasses = 0;

    const ScrollSurface = React.forwardRef(function Surface(props: any, ref: React.Ref<any>) {
        ctx = useStateContext();
        scrollProps = props;
        React.useImperativeHandle(ref, () => ({
            getScrollableNode: () => null,
            measure: () => {},
            scrollTo: () => {},
        }));
        React.useLayoutEffect(() => {
            if (ctx.state.didDataChange && !ctx.state.isFirst) pendingLayoutPasses++;
            props.onLayout({ nativeEvent: { layout: { height, width: 300, x: 0, y: 0 } } });
        }, [data]);
        return <>{props.children}</>;
    });
    const renderItem = ({ item }: { item: Row }) => {
        renders.push(item.id);
        return <Text>{item.id}</Text>;
    };
    const list = () => (
        <LegendList
            data={data}
            drawDistance={100}
            estimatedItemSize={50}
            getFixedItemSize={() => 50}
            keyExtractor={(item: Row) => item.id}
            maintainVisibleContentPosition
            recycleItems
            renderItem={renderItem}
            renderScrollComponent={(props: any) => <ScrollSurface {...props} />}
        />
    );
    const rendered = render(list());
    await act(async () => {
        for (let i = 0; i < 4; i++) await new Promise((resolve) => requestAnimationFrame(resolve));
    });
    const scroll = (offset: number) =>
        act(() => {
            scrollProps.onScroll({
                nativeEvent: {
                    contentOffset: { x: 0, y: offset },
                    contentSize: { height: data.length * 50, width: 300 },
                    layoutMeasurement: { height, width: 300 },
                    velocity: { x: 0, y: 0 },
                },
                timeStamp: Date.now(),
            });
        });
    scroll(500);
    const slots = new Map(
        [...ctx!.state.containerItemKeys].filter(([key]) => {
            const index = ctx!.state.indexByKey.get(key)!;
            return index >= ctx!.state.startBuffered! && index <= ctx!.state.endBuffered!;
        }),
    );
    renders.length = 0;

    for (const { nextData, offset } of [
        { nextData: [{ id: "loading" }, ...rows], offset: 550 },
        { nextData: [...Array.from({ length: 50 }, (_, i) => ({ id: `older-${i}` })), ...rows], offset: 3000 },
    ]) {
        data = nextData;
        // A larger viewport triggers handleLayout's calculation in the child's effect,
        // before the parent's data-change effect has rebuilt item positions.
        height++;
        rendered.rerender(list());
        // Native MVCP then reports the offset that retains the original visible rows.
        scroll(offset);
        for (const [key, slot] of slots) {
            expect(ctx!.state.containerItemKeys.get(key)).toBe(slot);
        }
    }
    expect(pendingLayoutPasses).toBe(2);
    expect(renders.filter((id) => slots.has(id))).toEqual([]);
    expect(ctx!.state.scroll).toBe(3000);
    rendered.unmount();
});
