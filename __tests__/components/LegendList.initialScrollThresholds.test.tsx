import { describe, expect, it } from "bun:test";
import "../setup";

import * as React from "react";
import { Animated, Text } from "react-native";

import TestRenderer, { act } from "../helpers/testRenderer";

import type { LegendListRef } from "../../src/types";

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

        const { LegendList } = await import("../../src/components/LegendList?initial-scroll-thresholds");
        const renderer = TestRenderer.create(
            <LegendList
                data={data}
                estimatedItemSize={100}
                getFixedItemSize={() => 100}
                initialScrollAtEnd
                keyExtractor={(item: { id: string }) => item.id}
                onEndReached={(payload) => onEndReachedCalls.push(payload)}
                onEndReachedThreshold={0.2}
                onStartReached={(payload) => onStartReachedCalls.push(payload)}
                onStartReachedThreshold={10}
                ref={ref}
                renderItem={({ item }: { item: { id: string } }) => <Text>{item.id}</Text>}
            />,
        );

        await flushAsync();

        const scrollView = renderer.root.findByType(Animated.ScrollView);
        await act(async () => {
            scrollView.props.onLayout?.(layoutEvent as any);
        });
        await flushAsync();

        const scrollOffset = ref.current?.getState().scroll ?? 0;

        await act(async () => {
            scrollView.props.onScroll?.(makeScrollEvent(scrollOffset, data.length * 100) as any);
        });

        expect(onStartReachedCalls).toEqual([]);
        expect(onEndReachedCalls).toEqual([]);

        await flushAsync();

        expect(onStartReachedCalls.length).toBeGreaterThan(0);
        expect(onEndReachedCalls.length).toBeGreaterThan(0);

        renderer.unmount();
    });
});
