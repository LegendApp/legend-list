import { describe, expect, it } from "bun:test";
import "../setup";

import * as React from "react";
import { Text } from "react-native";

import type { LegendListRef } from "../../src/types";
import TestRenderer, { act } from "../helpers/testRenderer";

const layoutEvent = {
    nativeEvent: { layout: { height: 200, width: 320, x: 0, y: 0 } },
};

async function flushAsync() {
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
}

function createScrollHarness() {
    const scrollCalls: number[] = [];
    let lastProps: any;

    const ScrollHarness = React.forwardRef(function ScrollHarnessComponent(props: any, ref: React.Ref<any>) {
        const currentOffsetRef = React.useRef(0);
        lastProps = props;

        React.useImperativeHandle(
            ref,
            () => ({
                flashScrollIndicators: () => {},
                getCurrentScrollOffset: () => currentOffsetRef.current,
                getScrollableNode: () => ({}),
                getScrollEventTarget: () => null,
                getScrollResponder: () => null,
                measure: (cb: (x: number, y: number, width: number, height: number) => void) => cb(0, 0, 320, 200),
                scrollTo: ({ x = 0, y = 0 }: { x?: number; y?: number }) => {
                    const next = props.horizontal ? x : y;
                    currentOffsetRef.current = next ?? 0;
                    scrollCalls.push(currentOffsetRef.current);
                },
                scrollToEnd: () => {},
            }),
            [props.horizontal],
        );

        return <>{props.children}</>;
    });

    return {
        getLastProps: () => lastProps,
        ScrollHarness,
        scrollCalls,
    };
}

describe("LegendList initial scroll integration", () => {
    it("treats initialScrollOffset as an absolute content offset", async () => {
        const { ScrollHarness, getLastProps, scrollCalls } = createScrollHarness();
        const { LegendList } = await import("../../src/components/LegendList?initial-scroll-integration-offset");
        const ref = React.createRef<LegendListRef>();
        const data = Array.from({ length: 20 }, (_, index) => ({ id: `item-${index}` }));

        let renderer: any;
        await act(async () => {
            renderer = TestRenderer.create(
                <LegendList
                    data={data}
                    estimatedItemSize={100}
                    getFixedItemSize={() => 100}
                    initialScrollOffset={250}
                    keyExtractor={(item: { id: string }) => item.id}
                    ref={ref}
                    renderItem={({ item }: { item: { id: string } }) => <Text>{item.id}</Text>}
                    renderScrollComponent={(props) => <ScrollHarness {...props} />}
                />,
            );
        });

        await flushAsync();

        expect(getLastProps()?.contentOffset?.y).toBe(250);

        await act(async () => {
            getLastProps()?.onLayout?.(layoutEvent as any);
        });
        await flushAsync();

        expect(scrollCalls.some((value) => Math.abs(value - 250) <= 1)).toBe(true);
        expect(ref.current?.getState().scroll).toBe(250);

        renderer.unmount();
    });

    it("re-targets initialScrollAtEnd when data arrives after mount", async () => {
        const { ScrollHarness, getLastProps, scrollCalls } = createScrollHarness();
        const { LegendList } = await import("../../src/components/LegendList?initial-scroll-integration-end");
        const ref = React.createRef<LegendListRef>();

        const renderList = (data: Array<{ id: string }>) => (
            <LegendList
                data={data}
                estimatedItemSize={100}
                getFixedItemSize={() => 100}
                initialScrollAtEnd
                keyExtractor={(item: { id: string }) => item.id}
                ref={ref}
                renderItem={({ item }: { item: { id: string } }) => <Text>{item.id}</Text>}
                renderScrollComponent={(props) => <ScrollHarness {...props} />}
            />
        );

        let renderer: any;
        await act(async () => {
            renderer = TestRenderer.create(renderList([]));
        });
        await flushAsync();

        await act(async () => {
            getLastProps()?.onLayout?.(layoutEvent as any);
        });
        await flushAsync();

        const items = Array.from({ length: 5 }, (_, index) => ({ id: `item-${index}` }));
        await act(async () => {
            renderer.update(renderList(items));
        });
        await flushAsync();

        await act(async () => {
            getLastProps()?.onLayout?.(layoutEvent as any);
        });
        await flushAsync();

        expect(scrollCalls.some((value) => value > 200)).toBe(true);
        expect((ref.current?.getState().scroll ?? 0) > 200).toBe(true);

        renderer.unmount();
    });

    it("re-targets initialScrollAtEnd when multiple items arrive after mount without another layout", async () => {
        const { ScrollHarness, getLastProps, scrollCalls } = createScrollHarness();
        const { LegendList } = await import("../../src/components/LegendList?initial-scroll-integration-end-no-layout");
        const ref = React.createRef<LegendListRef>();

        const renderList = (data: Array<{ id: string }>) => (
            <LegendList
                data={data}
                estimatedItemSize={100}
                getFixedItemSize={() => 100}
                initialScrollAtEnd
                keyExtractor={(item: { id: string }) => item.id}
                ref={ref}
                renderItem={({ item }: { item: { id: string } }) => <Text>{item.id}</Text>}
                renderScrollComponent={(props) => <ScrollHarness {...props} />}
            />
        );

        let renderer: any;
        await act(async () => {
            renderer = TestRenderer.create(renderList([]));
        });
        await flushAsync();

        await act(async () => {
            getLastProps()?.onLayout?.(layoutEvent as any);
        });
        await flushAsync();

        const items = Array.from({ length: 5 }, (_, index) => ({ id: `item-${index}` }));
        await act(async () => {
            renderer.update(renderList(items));
        });
        await flushAsync();

        expect(scrollCalls.some((value) => value > 200)).toBe(true);
        expect((ref.current?.getState().scroll ?? 0) > 200).toBe(true);

        renderer.unmount();
    });

    it("re-targets initialScrollAtEnd when a single oversized item arrives after mount without another layout", async () => {
        const { ScrollHarness, getLastProps, scrollCalls } = createScrollHarness();
        const { LegendList } = await import("../../src/components/LegendList?initial-scroll-integration-end-single");
        const ref = React.createRef<LegendListRef>();

        const renderList = (data: Array<{ id: string }>) => (
            <LegendList
                data={data}
                estimatedItemSize={300}
                getFixedItemSize={() => 300}
                initialScrollAtEnd
                keyExtractor={(item: { id: string }) => item.id}
                ref={ref}
                renderItem={({ item }: { item: { id: string } }) => <Text>{item.id}</Text>}
                renderScrollComponent={(props) => <ScrollHarness {...props} />}
            />
        );

        let renderer: any;
        await act(async () => {
            renderer = TestRenderer.create(renderList([]));
        });
        await flushAsync();

        await act(async () => {
            getLastProps()?.onLayout?.(layoutEvent as any);
        });
        await flushAsync();

        await act(async () => {
            renderer.update(renderList([{ id: "item-0" }]));
        });
        await flushAsync();

        expect(scrollCalls.some((value) => value > 80)).toBe(true);
        expect((ref.current?.getState().scroll ?? 0) > 80).toBe(true);

        renderer.unmount();
    });

    it("re-targets initialScrollIndex when data arrives after mount", async () => {
        const { ScrollHarness, getLastProps, scrollCalls } = createScrollHarness();
        const { LegendList } = await import("../../src/components/LegendList?initial-scroll-integration-index-async");
        const ref = React.createRef<LegendListRef>();

        const renderList = (data: Array<{ id: string }>) => (
            <LegendList
                data={data}
                estimatedItemSize={100}
                getFixedItemSize={() => 100}
                initialScrollIndex={3}
                keyExtractor={(item: { id: string }) => item.id}
                ref={ref}
                renderItem={({ item }: { item: { id: string } }) => <Text>{item.id}</Text>}
                renderScrollComponent={(props) => <ScrollHarness {...props} />}
            />
        );

        let renderer: any;
        await act(async () => {
            renderer = TestRenderer.create(renderList([]));
        });
        await flushAsync();

        await act(async () => {
            getLastProps()?.onLayout?.(layoutEvent as any);
        });
        await flushAsync();

        const items = Array.from({ length: 5 }, (_, index) => ({ id: `item-${index}` }));
        await act(async () => {
            renderer.update(renderList(items));
        });
        await flushAsync();

        expect(scrollCalls.some((value) => Math.abs(value - 300) <= 1)).toBe(true);
        expect(Math.abs((ref.current?.getState().scroll ?? 0) - 300) <= 1).toBe(true);

        renderer.unmount();
    });

    it("uses getEstimatedItemSize to land at the correct initialScrollIndex offset", async () => {
        const { ScrollHarness, getLastProps, scrollCalls } = createScrollHarness();
        const { LegendList } = await import(
            "../../src/components/LegendList?initial-scroll-integration-estimated-index"
        );
        const ref = React.createRef<LegendListRef>();
        const data = Array.from({ length: 10 }, (_, index) => ({ id: `item-${index}` }));

        let renderer: any;
        await act(async () => {
            renderer = TestRenderer.create(
                <LegendList
                    data={data}
                    getEstimatedItemSize={(_item, index) => 40 + index * 10}
                    initialScrollIndex={3}
                    keyExtractor={(item: { id: string }) => item.id}
                    ref={ref}
                    renderItem={({ item }: { item: { id: string } }) => <Text>{item.id}</Text>}
                    renderScrollComponent={(props) => <ScrollHarness {...props} />}
                />,
            );
        });
        await flushAsync();

        expect(getLastProps()?.contentOffset?.y).toBe(150);

        await act(async () => {
            getLastProps()?.onLayout?.(layoutEvent as any);
        });
        await flushAsync();

        expect(scrollCalls.some((value) => Math.abs(value - 150) <= 1)).toBe(true);
        expect(ref.current?.getState().scroll).toBe(150);

        renderer.unmount();
    });

    it("re-targets offset-only initialScroll when data arrives after mount", async () => {
        const { ScrollHarness, getLastProps } = createScrollHarness();
        const { LegendList } = await import("../../src/components/LegendList?initial-scroll-integration-offset-async");
        const ref = React.createRef<LegendListRef>();

        const renderList = (data: Array<{ id: string }>) => (
            <LegendList
                data={data}
                estimatedItemSize={100}
                getFixedItemSize={() => 100}
                initialScrollOffset={250}
                keyExtractor={(item: { id: string }) => item.id}
                ref={ref}
                renderItem={({ item }: { item: { id: string } }) => <Text>{item.id}</Text>}
                renderScrollComponent={(props) => <ScrollHarness {...props} />}
            />
        );

        let renderer: any;
        await act(async () => {
            renderer = TestRenderer.create(renderList([]));
        });
        await flushAsync();

        await act(async () => {
            getLastProps()?.onLayout?.(layoutEvent as any);
        });
        await flushAsync();

        const items = Array.from({ length: 5 }, (_, index) => ({ id: `item-${index}` }));
        await act(async () => {
            renderer.update(renderList(items));
        });
        await flushAsync();

        expect(Math.abs((ref.current?.getState().scroll ?? 0) - 250) <= 1).toBe(true);

        renderer.unmount();
    });
});
