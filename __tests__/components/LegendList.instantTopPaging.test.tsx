import { describe, expect, it } from "bun:test";
import "../setup";

import * as React from "react";
import { Text } from "react-native";

import { act, render } from "../helpers/testingLibrary";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
async function flushFrames() {
    for (let i = 0; i < 12; i++) {
        await act(async () => {
            await new Promise((resolve) => requestAnimationFrame(resolve));
        });
    }
}

type Row = { id: string };
const rows = (count: number, from: number) => Array.from({ length: count }, (_, i) => ({ id: String(from + i) }));

async function mountChat(pageSize: number) {
    const { LegendList } = await import("../../src/components/LegendList");
    let scrollProps: any;
    const ScrollSurface = React.forwardRef(function Surface(props: any, ref: React.Ref<any>) {
        scrollProps = props;
        React.useImperativeHandle(ref, () => ({
            getScrollableNode: () => null,
            measure: () => {},
            scrollTo: () => {},
        }));
        return <>{props.children}</>;
    });
    let data: Row[] = rows(100, 1000);
    let oldest = 1000;
    let starts = 0;
    let armed = false;
    const update = () => act(() => rendered.rerender(list()));
    // A typical async page load: show a loading row, fetch, then replace it with older rows.
    const onStartReached = async () => {
        if (!armed) return;
        starts++;
        await sleep(0);
        data = [{ id: `loader-${oldest}` }, ...data];
        update();
        await sleep(40);
        oldest -= pageSize;
        data = [...rows(pageSize, oldest), ...data.slice(1)];
        update();
    };
    const list = () => (
        <LegendList
            data={data}
            estimatedItemSize={50}
            getFixedItemSize={() => 50}
            keyExtractor={(item: Row) => item.id}
            maintainVisibleContentPosition
            onStartReached={onStartReached}
            recycleItems
            renderItem={({ item }: { item: Row }) => <Text>{item.id}</Text>}
            renderScrollComponent={(props: any) => <ScrollSurface {...props} />}
        />
    );
    const rendered = render(list());
    await flushFrames();
    act(() => scrollProps.onLayout({ nativeEvent: { layout: { height: 474, width: 300, x: 0, y: 0 } } }));
    await flushFrames();
    const event = (y: number) => ({
        nativeEvent: {
            contentOffset: { x: 0, y },
            contentSize: { height: data.length * 50, width: 300 },
            layoutMeasurement: { height: 474, width: 300 },
            velocity: { x: 0, y: 0 },
        },
        timeStamp: Date.now(),
    });
    // An instant jump to an offset between drag begin and end.
    const jump = async (from: number, to: number) => {
        act(() => scrollProps.onScrollBeginDrag(event(from)));
        act(() => scrollProps.onScroll(event(to)));
        act(() => scrollProps.onScrollEndDrag(event(to)));
        await flushFrames();
    };
    // Native MVCP reports the offset that keeps the visible rows in place, unless no event follows.
    const settle = async (y?: number) => {
        await sleep(200);
        if (y !== undefined) act(() => scrollProps.onScroll(event(y)));
        await flushFrames();
        await sleep(150);
        await flushFrames();
    };
    const arm = () => {
        armed = true;
    };
    return { arm, data: () => data, jump, rendered, settle, starts: () => starts };
}

describe("instant jump to the start of a paged chat", () => {
    it("calls onStartReached once per page while a loading row is shown", async () => {
        const chat = await mountChat(50);
        await chat.jump(0, 500);
        await sleep(150);
        chat.arm();
        let offset = 500;
        for (let page = 1; page <= 3; page++) {
            await chat.jump(offset, 0);
            await chat.settle(2500);
            offset = 2500;
            expect(chat.data().length).toBe(100 + page * 50);
            expect(chat.starts()).toBe(page);
        }
        chat.rendered.unmount();
    });

    it("keeps paging after a short page leaves the start inside the threshold", async () => {
        const chat = await mountChat(2);
        await chat.jump(0, 500);
        await sleep(150);
        chat.arm();
        await chat.jump(500, 0);
        // No scroll event follows the page, so only the recheck after the request settles can continue.
        await chat.settle();
        expect(chat.starts()).toBeGreaterThan(1);
        chat.rendered.unmount();
    });
});
