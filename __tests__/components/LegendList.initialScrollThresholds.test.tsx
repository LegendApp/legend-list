import { describe, expect, it, mock } from "bun:test";
import "../setup";

import * as React from "react";
import { Text } from "react-native";

import type { LegendListRef } from "../../src/types";
import TestRenderer, { act } from "../helpers/testRenderer";

mock.module("@/components/ListComponentScrollView", () => ({
    ListComponentScrollView: React.forwardRef(function MockListComponentScrollView(
        { children }: { children?: React.ReactNode },
        ref: React.Ref<any>,
    ) {
        React.useImperativeHandle(
            ref,
            () => ({
                flashScrollIndicators: () => {},
                getCurrentScrollOffset: () => 0,
                getScrollableNode: () => ({}),
                getScrollEventTarget: () => null,
                getScrollResponder: () => null,
                scrollTo: () => {},
                scrollToEnd: () => {},
            }),
            [],
        );

        return <>{children}</>;
    }),
}));

mock.module("@/components/ListComponent", () => import("../../src/components/ListComponent"));

const layoutEvent = {
    nativeEvent: { layout: { height: 200, width: 320, x: 0, y: 0 } },
};

const makeScrollEvent = (offset: number, contentSizeHeight: number) => ({
    nativeEvent: {
        contentOffset: { x: 0, y: offset },
        contentSize: { height: contentSizeHeight, width: 0 },
    },
});

async function flushAsync() {
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
}

describe("LegendList initial scroll thresholds", () => {
    it("defers start/end reached callbacks until the initial scroll finishes", async () => {
        const data = Array.from({ length: 10 }, (_, index) => ({ id: `item-${index}` }));
        const onStartReachedCalls: Array<{ distanceFromStart: number }> = [];
        const onEndReachedCalls: Array<{ distanceFromEnd: number }> = [];
        const ref = React.createRef<LegendListRef>();

        const { ListComponent } = await import("../../src/components/ListComponent");
        const { LegendList } = await import("../../src/components/LegendList?initial-scroll-thresholds");
        const renderer = TestRenderer.create(
            <LegendList
                data={data}
                estimatedItemSize={100}
                getFixedItemSize={() => 100}
                initialScrollAtEnd
                keyExtractor={(item: { id: string }) => item.id}
                onEndReached={(payload) => onEndReachedCalls.push(payload)}
                onEndReachedThreshold={10}
                onStartReached={(payload) => onStartReachedCalls.push(payload)}
                onStartReachedThreshold={10}
                ref={ref}
                renderItem={({ item }: { item: { id: string } }) => <Text>{item.id}</Text>}
            />,
        );

        await flushAsync();

        const listComponent = renderer.root.findByType(ListComponent);
        await act(async () => {
            listComponent.props.onLayout?.(layoutEvent as any);
        });
        await flushAsync();

        const scrollOffset = ref.current?.getState().scroll ?? 0;

        await act(async () => {
            listComponent.props.onScroll?.(makeScrollEvent(scrollOffset, data.length * 100) as any);
        });

        expect(onStartReachedCalls).toEqual([]);
        expect(onEndReachedCalls).toEqual([]);

        await act(async () => {
            listComponent.props.onMomentumScrollEnd?.(makeScrollEvent(scrollOffset, data.length * 100) as any);
        });

        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 520));
        });

        await flushAsync();

        expect(onStartReachedCalls.length).toBeGreaterThan(0);
        expect(onEndReachedCalls.length).toBeGreaterThan(0);

        renderer.unmount();
    });
});
