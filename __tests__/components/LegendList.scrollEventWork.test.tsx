import { afterAll, afterEach, beforeAll, describe, expect, it, mock, spyOn } from "bun:test";
import "../setup";

import * as React from "react";
import { Animated, Text } from "react-native";

import * as updateItemPositionsModule from "../../src/core/updateItemPositions";
import { type StateContext, useStateContext } from "../../src/state/state";
import * as checkAtBottomModule from "../../src/utils/checkAtBottom";
import { act, render } from "../helpers/testingLibrary";

const VIEWPORT = 800;
const sizeOf = (index: number) => (index % 10 === 0 ? 40 : index % 2 === 0 ? 72 : 64);

async function flushFrames() {
    for (let i = 0; i < 12; i++) {
        await act(async () => {
            await new Promise((resolve) => requestAnimationFrame(resolve));
        });
    }
}

// A recycled MVCP list with fixed sizes, two item types and sticky section rows.
async function mountList() {
    const { LegendList } = await import("../../src/components/LegendList");
    let ctx: StateContext | undefined;
    let scrollProps: any;
    const ScrollSurface = React.forwardRef(function Surface(props: any, ref: React.Ref<any>) {
        ctx = useStateContext();
        scrollProps = props;
        React.useImperativeHandle(ref, () => ({
            getScrollableNode: () => ({}),
            getScrollResponder() {
                return this;
            },
            measure: () => {},
            scrollTo: () => {},
        }));
        return <>{props.children}</>;
    });
    const data = Array.from({ length: 100 }, (_, id) => ({ id: String(id) }));
    const rendered = render(
        <LegendList
            data={data}
            estimatedItemSize={64}
            getFixedItemSize={(_item: unknown, index: number) => sizeOf(index)}
            getItemType={(_item: unknown, index: number) => (index % 10 === 0 ? "header" : "row")}
            keyExtractor={(item: { id: string }) => item.id}
            maintainVisibleContentPosition
            recycleItems
            renderItem={({ item }: { item: { id: string } }) => <Text>{item.id}</Text>}
            renderScrollComponent={(props: any) => <ScrollSurface {...props} />}
            stickyHeaderIndices={[0, 10, 20, 30]}
        />,
    );
    await flushFrames();
    act(() => scrollProps.onLayout({ nativeEvent: { layout: { height: VIEWPORT, width: 400, x: 0, y: 0 } } }));
    await flushFrames();
    const contentLength = data.reduce((sum, _item, index) => sum + sizeOf(index), 0);
    const event = (offset: number) => ({
        nativeEvent: {
            contentOffset: { x: 0, y: offset },
            contentSize: { height: contentLength, width: 400 },
            layoutMeasurement: { height: VIEWPORT, width: 400 },
            velocity: { x: 0, y: 0 },
        },
        timeStamp: Date.now(),
    });
    return { ctx: ctx!, event, scrollProps, unmount: rendered.unmount };
}

describe("scroll events that keep the render range", () => {
    // The shared Animated.Value mock lacks what sticky positioning needs; add it for this file only.
    const proto = Animated.Value.prototype as any;
    const added: string[] = [];
    beforeAll(() => {
        const members: Record<string, unknown> = {
            addListener: () => "listener",
            interpolate() {
                return this;
            },
        };
        for (const [name, fn] of Object.entries(members)) {
            if (!(name in proto)) {
                proto[name] = fn;
                added.push(name);
            }
        }
    });
    afterAll(() => {
        for (const name of added) delete proto[name];
    });
    afterEach(() => {
        mock.restore();
    });

    it("does range and edge work only when it can change something during a slow drag", async () => {
        const list = await mountList();
        const { ctx } = list;
        const state = ctx.state;
        let counting = false;
        let notifications = 0;
        const valuesSet = ctx.values.set.bind(ctx.values);
        ctx.values.set = (name: any, value: any) => {
            if (counting) notifications += ctx.listeners.get(name)?.size ?? 0;
            return valuesSet(name, value);
        };
        const rangePasses = spyOn(updateItemPositionsModule, "updateItemPositions");
        const edgeChecks = spyOn(checkAtBottomModule, "checkAtBottom");
        let clock = Date.now();
        spyOn(Date, "now").mockImplementation(() => clock);
        spyOn(performance, "now").mockImplementation(() => clock);
        let rangeChanges = 0;
        let hitNotifications = 0;
        let midListEdgeChecks = 0;
        try {
            act(() => list.scrollProps.onScrollBeginDrag(list.event(0)));
            // ~4 pt per 16 ms event, like a slow drag.
            for (let i = 1; i <= 300; i++) {
                clock += 16;
                const range = `${state.startBuffered}-${state.endBuffered}`;
                const passesBefore = rangePasses.mock.calls.length;
                const edgeChecksBefore = edgeChecks.mock.calls.length;
                const notificationsBefore = notifications;
                counting = true;
                list.scrollProps.onScroll(list.event(i * 4));
                counting = false;
                if (range !== `${state.startBuffered}-${state.endBuffered}`) rangeChanges++;
                if (rangePasses.mock.calls.length === passesBefore) {
                    hitNotifications += notifications - notificationsBefore;
                }
                // Past the start threshold (half a viewport) and far from the end.
                if (i * 4 > VIEWPORT) midListEdgeChecks += edgeChecks.mock.calls.length - edgeChecksBefore;
            }
        } finally {
            list.unmount();
        }
        // The range-window cache answers every event whose buffered range is unchanged, without signal writes.
        expect(rangeChanges).toBeGreaterThan(0);
        expect(rangePasses.mock.calls.length).toBe(rangeChanges);
        expect(hitNotifications).toBe(0);
        // A drag interrupts end following; mid-list that must not force the edge checks.
        expect(midListEdgeChecks).toBe(0);
    });
});
