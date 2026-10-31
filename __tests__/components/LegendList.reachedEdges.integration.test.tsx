import { describe, expect, it } from "bun:test";
import "../setup";

import * as React from "react";
import { Text } from "react-native";

import { setFooterSize, setHeaderSize } from "../../src/core/updateContentMetrics";
import { updateItemSizesBatch } from "../../src/core/updateItemSizes";
import { type StateContext, useStateContext } from "../../src/state/state";
import type { LegendListRef } from "../../src/types.base";
import { act, render } from "../helpers/testingLibrary";

async function flushFrames() {
    for (let i = 0; i < 12; i++) {
        await act(async () => {
            await new Promise((resolve) => requestAnimationFrame(resolve));
        });
    }
}

describe("short content pagination", () => {
    for (const replacement of ["same objects", "all objects", "one object", "one object in the same array"] as const) {
        it(`does not re-arm when replacing ${replacement} without a length or size change`, async () => {
            const { LegendList } = await import("../../src/components/LegendList");
            let scrollProps: any;
            const ScrollSurface = React.forwardRef(function ReplacementScrollSurface(
                props: any,
                forwardedRef: React.Ref<any>,
            ) {
                scrollProps = props;
                React.useImperativeHandle(forwardedRef, () => ({ measure: () => {}, scrollTo: () => {} }));
                return <>{props.children}</>;
            });
            let data = Array.from({ length: replacement === "all objects" ? 1 : 2 }, (_, id) => ({
                id: String(id),
                value: 0,
            }));
            let calls = 0;
            const list = (version: number) => (
                <LegendList
                    data={data}
                    dataVersion={version}
                    estimatedItemSize={83}
                    getFixedItemSize={() => 83}
                    keyExtractor={(item) => item.id}
                    onEndReached={() => calls++}
                    renderItem={({ item }) => <Text>{item.value}</Text>}
                    renderScrollComponent={(props: any) => <ScrollSurface {...props} />}
                />
            );
            const rendered = render(list(0));
            await flushFrames();
            act(() => scrollProps.onLayout({ nativeEvent: { layout: { height: 800, width: 300, x: 0, y: 0 } } }));
            await flushFrames();
            expect(calls).toBe(1);

            for (let version = 1; version <= 3; version++) {
                if (replacement === "same objects") {
                    data = [...data];
                } else if (replacement === "all objects") {
                    data = data.map((item) => ({ ...item, value: version }));
                } else {
                    if (replacement === "one object") data = data.slice();
                    data[0] = { ...data[0], value: version };
                }
                // Only the same-array case needs dataVersion to notify the list.
                rendered.rerender(list(replacement === "one object in the same array" ? version : 0));
                await flushFrames();
                expect(calls).toBe(1);
            }
            rendered.unmount();
        });
    }

    it("bounds both edges while pages load and re-arms for new data arrays", async () => {
        const { LegendList } = await import("../../src/components/LegendList");
        let scrollProps: any;
        const ScrollSurface = React.forwardRef(function BothEdgesScrollSurface(
            props: any,
            forwardedRef: React.Ref<any>,
        ) {
            scrollProps = props;
            React.useImperativeHandle(forwardedRef, () => ({ measure: () => {}, scrollTo: () => {} }));
            return <>{props.children}</>;
        });
        const starts: string[][] = [];
        const ends: string[][] = [];
        function PagingList({ ids }: { ids: string[] }) {
            const [, setLoading] = React.useState(0);
            const data = React.useMemo(() => ids.map((id) => ({ id })), [ids]);
            const loadPage = (calls: string[][]) => {
                calls.push(ids);
                // Keep data stable during loading-state renders before the page arrives.
                // Cap updates so a regression fails an assertion instead of looping forever.
                if (starts.length + ends.length <= 12) {
                    void Promise.resolve().then(() => setLoading((value) => value + 1));
                }
            };
            return (
                <LegendList
                    data={data}
                    estimatedItemSize={83}
                    getFixedItemSize={() => 83}
                    keyExtractor={(item: { id: string }) => item.id}
                    onEndReached={() => loadPage(ends)}
                    onStartReached={() => loadPage(starts)}
                    renderItem={({ item }: { item: { id: string } }) => <Text>{item.id}</Text>}
                    renderScrollComponent={(props: any) => <ScrollSurface {...props} />}
                />
            );
        }
        const rendered = render(<PagingList ids={["0"]} />);
        await flushFrames();
        act(() => scrollProps.onLayout({ nativeEvent: { layout: { height: 800, width: 300, x: 0, y: 0 } } }));
        await flushFrames();
        const expected = [["0"]];
        expect(ends).toEqual(expected);
        expect(starts).toEqual(expected);

        for (const ids of [["1"], ["1", "2"], ["2", "1"], ["2"], []]) {
            rendered.rerender(<PagingList ids={ids} />);
            await flushFrames();
            // Each nonempty response with a new length re-arms; a same-size reorder does not.
            if (ids.length && ids.length !== expected[expected.length - 1].length) expected.push(ids);
            expect(ends).toEqual(expected);
            expect(starts).toEqual(expected);
        }
        rendered.unmount();
    });

    it("preserves both edge re-arm counts with a consumer onContentSizeChange", async () => {
        const { LegendList } = await import("../../src/components/LegendList");
        const counts: Array<Array<[number, number]>> = [];
        for (const withConsumer of [false, true]) {
            let ctx: StateContext;
            let scrollProps: any;
            const ScrollSurface = React.forwardRef(function ContentSizeScrollSurface(
                props: any,
                forwardedRef: React.Ref<any>,
            ) {
                ctx = useStateContext();
                scrollProps = props;
                React.useImperativeHandle(forwardedRef, () => ({ measure: () => {}, scrollTo: () => {} }));
                return <>{props.children}</>;
            });
            let starts = 0;
            let ends = 0;
            const sizes: Array<[number, number]> = [];
            const rendered = render(
                <LegendList
                    data={[{ id: "0" }]}
                    estimatedItemSize={83}
                    keyExtractor={(item: { id: string }) => item.id}
                    onContentSizeChange={withConsumer ? (width, height) => sizes.push([width, height]) : undefined}
                    onEndReached={() => ends++}
                    onStartReached={() => starts++}
                    renderItem={({ item }: { item: { id: string } }) => <Text>{item.id}</Text>}
                    renderScrollComponent={(props: any) => <ScrollSurface {...props} />}
                />,
            );
            try {
                await flushFrames();
                act(() => scrollProps.onLayout({ nativeEvent: { layout: { height: 800, width: 300, x: 0, y: 0 } } }));
                act(() => updateItemSizesBatch(ctx, [{ itemKey: "0", size: { height: 83, width: 300 } }]));
                await flushFrames();
                expect([starts, ends]).toEqual([1, 1]);
                const checkpoints: Array<[number, number]> = [];
                // Change measured content without changing data length, and repeat the
                // native notification: neither can create another page request.
                for (const height of [83, 120, 120, 180, 180]) {
                    act(() => updateItemSizesBatch(ctx, [{ itemKey: "0", size: { height, width: 300 } }]));
                    await flushFrames();
                    act(() => scrollProps.onContentSizeChange(300, height));
                    await flushFrames();
                    checkpoints.push([starts, ends]);
                }
                expect(checkpoints).toEqual([
                    [1, 1],
                    [1, 1],
                    [1, 1],
                    [1, 1],
                    [1, 1],
                ]);
                expect(sizes).toEqual(
                    withConsumer
                        ? [
                              [300, 83],
                              [300, 120],
                              [300, 120],
                              [300, 180],
                              [300, 180],
                          ]
                        : [],
                );
                counts.push(checkpoints);
            } finally {
                rendered.unmount();
            }
        }
        expect(counts[1]).toEqual(counts[0]);
    });

    for (const edge of ["end", "start"] as const) {
        for (const pageLimit of [3, 10]) {
            it(`loads ${edge} pages until ${edge === "start" || pageLimit === 3 ? "data stops" : "the end leaves the threshold"}`, async () => {
                const { LegendList } = await import("../../src/components/LegendList");
                const ref = React.createRef<LegendListRef>();
                let scrollProps: any;
                const ScrollSurface = React.forwardRef(function PagingScrollSurface(
                    props: any,
                    forwardedRef: React.Ref<any>,
                ) {
                    scrollProps = props;
                    React.useImperativeHandle(forwardedRef, () => ({ measure: () => {}, scrollTo: () => {} }));
                    return <>{props.children}</>;
                });
                const pages: string[][] = [];
                function PaginatedList() {
                    const [data, setData] = React.useState([{ id: "0" }]);
                    const loadPage = () => {
                        pages.push(data.map((item) => item.id));
                        if (data.length < pageLimit) {
                            const page = { id: String(data.length) };
                            setData(edge === "end" ? [...data, page] : [page, ...data]);
                        }
                    };
                    return (
                        <LegendList
                            data={data}
                            estimatedItemSize={100}
                            getFixedItemSize={() => 100}
                            keyExtractor={(item: { id: string }) => item.id}
                            onEndReached={edge === "end" ? loadPage : undefined}
                            onEndReachedThreshold={0.1}
                            onStartReached={edge === "start" ? loadPage : undefined}
                            onStartReachedThreshold={0.1}
                            recycleItems={false}
                            ref={ref}
                            renderItem={({ item }: { item: { id: string } }) => <Text>{item.id}</Text>}
                            renderScrollComponent={(props: any) => <ScrollSurface {...props} />}
                        />
                    );
                }
                const rendered = render(<PaginatedList />);
                await flushFrames();
                expect(pages).toEqual([]);
                const layout = () =>
                    act(() =>
                        scrollProps.onLayout({ nativeEvent: { layout: { height: 474, width: 300, x: 0, y: 0 } } }),
                    );
                layout();
                await flushFrames();
                const expectedPages = Array.from(
                    { length: edge === "start" ? pageLimit : Math.min(pageLimit, 5) },
                    (_, index) => {
                        const ids = Array.from({ length: index + 1 }, (_item, id) => String(id));
                        return edge === "end" ? ids : ids.reverse();
                    },
                );
                expect(pages).toEqual(expectedPages);
                const contentLength = (edge === "start" ? pageLimit : Math.min(pageLimit, 6)) * 100;
                expect(ref.current?.getState().contentLength).toBe(contentLength);

                // Stable data and layout/scroll checks must stop paging.
                rendered.rerender(<PaginatedList />);
                layout();
                act(() =>
                    scrollProps.onScroll({
                        nativeEvent: {
                            contentOffset: { x: 0, y: 0 },
                            contentSize: { height: contentLength, width: 300 },
                            layoutMeasurement: { height: 474, width: 300 },
                            velocity: { x: 0, y: 0 },
                        },
                        timeStamp: Date.now(),
                    }),
                );
                await flushFrames();
                expect(pages).toEqual(expectedPages);
                rendered.unmount();
            });
        }
    }
});

describe("mounted grid reached callbacks", () => {
    for (const height of [1, 24, 450, 473.75, 474, 474.25, 498, 566]) {
        for (const numColumns of [1, 3]) {
            it(`mounts short content of height ${height} in ${numColumns} columns without duplicate callbacks`, async () => {
                const { LegendList } = await import("../../src/components/LegendList");
                const ref = React.createRef<LegendListRef>();
                let scrollProps: any;
                const ScrollSurface = React.forwardRef(function ShortScrollSurface(
                    props: any,
                    forwardedRef: React.Ref<any>,
                ) {
                    scrollProps = props;
                    React.useImperativeHandle(forwardedRef, () => ({ measure: () => {}, scrollTo: () => {} }));
                    return <>{props.children}</>;
                });
                const ends: number[] = [];
                const starts: number[] = [];
                const rendered = render(
                    <LegendList
                        data={Array.from({ length: numColumns }, (_, id) => ({ id: String(id) }))}
                        estimatedItemSize={height}
                        getFixedItemSize={() => height}
                        keyExtractor={(item: { id: string }) => item.id}
                        numColumns={numColumns}
                        onEndReached={({ distanceFromEnd }: { distanceFromEnd: number }) => ends.push(distanceFromEnd)}
                        onEndReachedThreshold={0.1}
                        onStartReached={({ distanceFromStart }: { distanceFromStart: number }) =>
                            starts.push(distanceFromStart)
                        }
                        onStartReachedThreshold={0.1}
                        recycleItems={false}
                        ref={ref}
                        renderItem={({ item }: { item: { id: string } }) => <Text>{item.id}</Text>}
                        renderScrollComponent={(props: any) => <ScrollSurface {...props} />}
                    />,
                );
                const layout = () =>
                    act(() =>
                        scrollProps.onLayout({ nativeEvent: { layout: { height: 474, width: 300, x: 0, y: 0 } } }),
                    );
                await flushFrames();
                expect(ends).toEqual([]);
                layout();
                await flushFrames();
                expect(ref.current?.getState().contentLength).toBeCloseTo(height);
                expect(starts).toEqual([0]);
                expect(ends).toHaveLength(height <= 521.4 ? 1 : 0);
                layout();
                await flushFrames();
                const y = Math.max(0, height - 474);
                if (height > 521.4) act(() => scrollProps.onScrollBeginDrag({ nativeEvent: {} }));
                for (let step = 1; step <= 4; step++) {
                    act(() =>
                        scrollProps.onScroll({
                            nativeEvent: {
                                contentOffset: { x: 0, y: (y * step) / 4 },
                                contentSize: { height, width: 300 },
                                layoutMeasurement: { height: 474, width: 300 },
                                velocity: { x: 0, y: y > 0 ? 1 : 0 },
                            },
                            timeStamp: Date.now(),
                        }),
                    );
                    await flushFrames();
                }
                expect(ends).toHaveLength(1);
                expect(ref.current?.getState().isAtEnd).toBe(true);
                expect(ref.current?.getState().scroll).toBeCloseTo(y);
                expect(starts).toEqual([0]);
                rendered.unmount();
            });
        }
    }
    for (const offsets of [[92], [20, 40, 60, 92]]) {
        it(`delivers end during a native grid drag with ${offsets.length} scroll events`, async () => {
            const { LegendList } = await import("../../src/components/LegendList");
            let scrollProps: any;
            const ScrollSurface = React.forwardRef(function GestureScrollSurface(
                props: any,
                forwardedRef: React.Ref<any>,
            ) {
                scrollProps = props;
                React.useImperativeHandle(forwardedRef, () => ({ measure: () => {}, scrollTo: () => {} }));
                return <>{props.children}</>;
            });
            const startCalls: number[] = [];
            const endCalls: number[] = [];
            const rendered = render(
                <LegendList
                    data={Array.from({ length: 15 }, (_, id) => ({ id: String(id) }))}
                    estimatedItemSize={113.2}
                    getFixedItemSize={() => 113.2}
                    keyExtractor={(item: { id: string }) => item.id}
                    numColumns={3}
                    onEndReached={({ distanceFromEnd }: { distanceFromEnd: number }) => endCalls.push(distanceFromEnd)}
                    onEndReachedThreshold={0.1}
                    onStartReached={({ distanceFromStart }: { distanceFromStart: number }) =>
                        startCalls.push(distanceFromStart)
                    }
                    onStartReachedThreshold={0.1}
                    recycleItems={false}
                    renderItem={({ item }: { item: { id: string } }) => <Text>{item.id}</Text>}
                    renderScrollComponent={(props: any) => <ScrollSurface {...props} />}
                />,
            );
            await flushFrames();
            act(() => scrollProps.onLayout({ nativeEvent: { layout: { height: 474, width: 300, x: 0, y: 0 } } }));
            await flushFrames();
            expect(startCalls).toEqual([0]);
            expect(endCalls).toEqual([]);
            act(() => scrollProps.onScrollBeginDrag({ nativeEvent: {} }));
            for (const y of offsets) {
                act(() =>
                    scrollProps.onScroll({
                        nativeEvent: {
                            contentOffset: { x: 0, y },
                            contentSize: { height: 566, width: 300 },
                            layoutMeasurement: { height: 474, width: 300 },
                            velocity: { x: 0, y: 1 },
                        },
                        timeStamp: Date.now(),
                    }),
                );
                await flushFrames();
            }
            expect(endCalls).toHaveLength(1);
            expect(startCalls).toEqual([0]);
            rendered.unmount();
        });
    }
    for (const threshold of [0.1, 0.5, 2]) {
        it(`delivers onEndReached through layout, scroll, and dataKey reset (threshold ${threshold})`, async () => {
            // Only replace the native scroll surface. ListComponent, layout, initial
            // placement, threshold checks, and gesture handling are real source code.
            const { LegendList } = await import("../../src/components/LegendList");
            const ref = React.createRef<LegendListRef>();
            let scrollProps: any;
            const ScrollSurface = React.forwardRef(function TestScrollSurface(
                props: any,
                forwardedRef: React.Ref<any>,
            ) {
                scrollProps = props;
                React.useImperativeHandle(forwardedRef, () => ({ measure: () => {}, scrollTo: () => {} }));
                return <>{props.children}</>;
            });
            const data = Array.from({ length: 15 }, (_, id) => ({ id: String(id) }));
            const calls: Array<{ key: string; distance: number }> = [];
            const list = (key: string, items = data) => (
                <LegendList
                    data={items}
                    dataKey={key}
                    estimatedItemSize={113.2}
                    getFixedItemSize={() => 113.2}
                    keyExtractor={(item: { id: string }) => item.id}
                    numColumns={3}
                    onEndReached={({ distanceFromEnd }: { distanceFromEnd: number }) =>
                        calls.push({ distance: distanceFromEnd, key })
                    }
                    onEndReachedThreshold={threshold}
                    recycleItems={false}
                    ref={ref}
                    renderItem={({ item }: { item: { id: string } }) => <Text>{item.id}</Text>}
                    renderScrollComponent={(props: any) => <ScrollSurface {...props} />}
                />
            );
            const rendered = render(list("first"));
            await flushFrames();
            expect(calls).toEqual([]);
            act(() => scrollProps.onLayout({ nativeEvent: { layout: { height: 474, width: 300, x: 0, y: 0 } } }));
            await flushFrames();
            expect(ref.current?.getState().contentLength).toBeCloseTo(566);
            expect(calls).toHaveLength(threshold === 0.1 ? 0 : 1);

            const scroll = () =>
                act(() =>
                    scrollProps.onScroll({
                        nativeEvent: {
                            contentOffset: { x: 0, y: 92 },
                            contentSize: { height: 566, width: 300 },
                            layoutMeasurement: { height: 474, width: 300 },
                            velocity: { x: 0, y: 1 },
                        },
                        timeStamp: Date.now(),
                    }),
                );
            scroll();
            await flushFrames();
            scroll();
            await flushFrames();
            expect(calls).toHaveLength(1);
            expect(calls[0].key).toBe("first");
            expect(calls[0].distance).toBeCloseTo(threshold === 0.1 ? 0 : 92);

            rendered.rerender(list("second"));
            await flushFrames();
            scroll();
            await flushFrames();
            expect(calls).toHaveLength(2);
            expect(calls[1].key).toBe("second");

            // Clearing notifies neither edge. Repopulating the same dataset key starts a new
            // initial placement that must not inherit the previous edge notification either.
            rendered.rerender(list("second", []));
            await flushFrames();
            expect(calls).toHaveLength(2);
            rendered.rerender(list("second"));
            await flushFrames();
            scroll();
            await flushFrames();
            expect(calls).toHaveLength(3);

            // Exercise the real data-change path, not just mutated utility state.
            rendered.rerender(list("second", [...data, { id: "15" }, { id: "16" }, { id: "17" }]));
            await flushFrames();
            expect(ref.current?.getState().contentLength).toBeCloseTo(679.2);
            expect(calls).toHaveLength(threshold === 0.1 ? 3 : 4);
            rendered.unmount();
        });
    }
});

describe("empty list reached callbacks", () => {
    it("re-pages once when delivered rows become empty inside padded content", async () => {
        const { LegendList } = await import("../../src/components/LegendList");
        let scrollProps: any;
        const ScrollSurface = React.forwardRef(function EmptyPageScrollSurface(
            props: any,
            forwardedRef: React.Ref<any>,
        ) {
            scrollProps = props;
            React.useImperativeHandle(forwardedRef, () => ({ measure: () => {}, scrollTo: () => {} }));
            return <>{props.children}</>;
        });
        let calls = 0;
        const list = (data: { id: string }[]) => (
            <LegendList
                contentContainerStyle={{ paddingTop: 8 }}
                data={data}
                getFixedItemSize={() => 60}
                keyExtractor={(item: { id: string }) => item.id}
                onEndReached={() => calls++}
                renderItem={({ item }: { item: { id: string } }) => <Text>{item.id}</Text>}
                renderScrollComponent={(props: any) => <ScrollSurface {...props} />}
            />
        );
        const rendered = render(list([{ id: "0" }, { id: "1" }]));
        await flushFrames();
        act(() => scrollProps.onLayout({ nativeEvent: { layout: { height: 800, width: 300, x: 0, y: 0 } } }));
        await flushFrames();
        expect(calls).toBe(1);

        rendered.rerender(list([]));
        await flushFrames();
        expect(calls).toBe(2);
        for (let pass = 0; pass < 3; pass++) {
            rendered.rerender(list([]));
            await flushFrames();
            expect(calls).toBe(2);
        }
        rendered.unmount();
    });

    it("fires neither edge while empty, then delivers the start edge when rows arrive", async () => {
        const { LegendList } = await import("../../src/components/LegendList");
        let scrollProps: any;
        const ScrollSurface = React.forwardRef(function EmptyScrollSurface(props: any, forwardedRef: React.Ref<any>) {
            scrollProps = props;
            React.useImperativeHandle(forwardedRef, () => ({ measure: () => {}, scrollTo: () => {} }));
            return <>{props.children}</>;
        });
        const starts: number[] = [];
        const ends: number[] = [];
        const list = (rows: { id: string }[]) => (
            <LegendList
                data={rows}
                estimatedItemSize={50}
                getFixedItemSize={() => 50}
                keyExtractor={(item: { id: string }) => item.id}
                onEndReached={() => ends.push(1)}
                onStartReached={() => starts.push(1)}
                renderItem={({ item }: { item: { id: string } }) => <Text>{item.id}</Text>}
                renderScrollComponent={(props: any) => <ScrollSurface {...props} />}
            />
        );

        const rendered = render(list([]));
        await flushFrames();
        act(() => scrollProps.onLayout({ nativeEvent: { layout: { height: 474, width: 300, x: 0, y: 0 } } }));
        await flushFrames();
        expect(starts).toEqual([]);
        expect(ends).toEqual([]);

        rendered.rerender(list(Array.from({ length: 30 }, (_, id) => ({ id: String(id) }))));
        await flushFrames();
        expect(starts).toHaveLength(1);
        expect(ends).toEqual([]);
        rendered.unmount();
    });
});

describe("consumer patterns inside the threshold", () => {
    type Row = { id: string };
    const rows = (count: number, from = 0) => Array.from({ length: count }, (_, id) => ({ id: String(from + id) }));

    async function mount(baseProps: { data: Row[] } & Record<string, unknown>, horizontal = false) {
        const { LegendList } = await import("../../src/components/LegendList");
        let ctx!: StateContext;
        let scrollProps: any;
        const ScrollSurface = React.forwardRef(function PatternScrollSurface(props: any, forwardedRef: React.Ref<any>) {
            ctx = useStateContext();
            scrollProps = props;
            React.useImperativeHandle(forwardedRef, () => ({
                getScrollableNode: () => null,
                measure: () => {},
                scrollTo: () => {},
            }));
            return <>{props.children}</>;
        });
        const starts: number[] = [];
        const ends: number[] = [];
        const list = (extra: Record<string, unknown>) => (
            <LegendList
                estimatedItemSize={50}
                horizontal={horizontal}
                keyExtractor={(item: Row) => item.id}
                onEndReached={() => ends.push(1)}
                onStartReached={() => starts.push(1)}
                recycleItems={false}
                renderItem={({ item }: { item: Row }) => <Text>{item.id}</Text>}
                renderScrollComponent={(scroll: any) => <ScrollSurface {...scroll} />}
                {...baseProps}
                {...extra}
            />
        );
        const rendered = render(list({}));
        await flushFrames();
        act(() => scrollProps.onLayout({ nativeEvent: { layout: { height: 474, width: 474, x: 0, y: 0 } } }));
        await flushFrames();
        const counts = () => [starts.length, ends.length];
        const update = async (extra: Record<string, unknown>) => {
            rendered.rerender(list(extra));
            await flushFrames();
        };
        const run = async (fn: () => void) => {
            act(fn);
            await flushFrames();
        };
        // A user drag to the offset, so the shared edge gate lets the other edge through.
        const scrollTo = (offset: number, contentLength: number) =>
            run(() => {
                const event = {
                    nativeEvent: {
                        contentOffset: { x: horizontal ? offset : 0, y: horizontal ? 0 : offset },
                        contentSize: { height: contentLength, width: contentLength },
                        layoutMeasurement: { height: 474, width: 474 },
                        velocity: { x: 0, y: 0 },
                    },
                    timeStamp: Date.now(),
                };
                scrollProps.onScrollBeginDrag({ nativeEvent: {} });
                scrollProps.onScroll(event);
                scrollProps.onScrollEndDrag(event);
            });
        return { counts, ctx: () => ctx, rendered, run, scrollTo, update };
    }

    for (const horizontal of [false, true]) {
        for (const count of [3, 40]) {
            const name = `${count === 3 ? "short" : "long"} ${horizontal ? "horizontal" : "vertical"} list`;

            it(`does not loop a loading footer that appears and disappears near the end of a ${name}`, async () => {
                const data = rows(count);
                const list = await mount({ data, getFixedItemSize: () => 50 }, horizontal);
                if (count > 3) await list.scrollTo(count * 50 - 474, count * 50);
                expect(list.counts()).toEqual([1, 1]);

                // Each page request shows a footer spinner; the request returns no rows.
                for (let i = 0; i < 3; i++) {
                    await list.update({ ListFooterComponent: () => <Text>loading</Text> });
                    await list.run(() => setFooterSize(list.ctx(), 60));
                    await list.update({ ListFooterComponent: undefined });
                    if (count > 3) await list.scrollTo(count * 50 - 474, count * 50);
                }
                expect(list.counts()).toEqual([1, 1]);

                // New rows still re-arm the end while it stays inside the threshold.
                await list.update({ data: [...data, ...rows(2, count)] });
                if (count > 3) await list.scrollTo((count + 2) * 50 - 474, (count + 2) * 50);
                expect(list.counts()[1]).toBe(2);
                list.rendered.unmount();
            });

            it(`does not re-fire for header toggles in a ${name}`, async () => {
                const list = await mount({ data: rows(count), getFixedItemSize: () => 50 }, horizontal);
                const before = list.counts();
                expect(before[0]).toBe(1);
                for (const size of [80, 0, 120, 0]) {
                    await list.update({ ListHeaderComponent: size ? () => <Text>header</Text> : undefined });
                    if (size) await list.run(() => setHeaderSize(list.ctx(), size));
                }
                expect(list.counts()).toEqual(before);
                list.rendered.unmount();
            });
        }

        it(`fires neither edge when ${horizontal ? "horizontal" : "vertical"} data is cleared, then re-arms on refill`, async () => {
            const list = await mount({ data: rows(3), getFixedItemSize: () => 50 }, horizontal);
            expect(list.counts()).toEqual([1, 1]);
            await list.update({ data: [] });
            expect(list.counts()).toEqual([1, 1]);
            await list.update({ data: rows(3, 10) });
            expect(list.counts()).toEqual([2, 2]);
            await list.update({ data: [] });
            await list.update({ data: rows(40, 20) });
            expect(list.counts()).toEqual([3, 2]);
            list.rendered.unmount();
        });
    }

    const measureAll = (list: Awaited<ReturnType<typeof mount>>, count: number, height: number) =>
        list.run(() =>
            updateItemSizesBatch(
                list.ctx(),
                rows(count).map(({ id }) => ({ itemKey: id, size: { height, width: 474 } })),
            ),
        );

    it("does not re-fire either edge when rows of a short list re-measure", async () => {
        const list = await mount({ data: rows(3) });
        await measureAll(list, 3, 50);
        expect(list.counts()).toEqual([1, 1]);
        for (const height of [60, 45, 80, 80]) await measureAll(list, 3, height);
        expect(list.counts()).toEqual([1, 1]);
        list.rendered.unmount();
    });

    it("fires the end once when a re-measure first brings it inside the threshold", async () => {
        const list = await mount({ data: rows(20), onStartReached: undefined });
        // 20 rows of 50 put the end 526 from a 237 threshold; rows measured at 30 bring it to 126.
        await measureAll(list, 20, 50);
        expect(list.counts()).toEqual([0, 0]);
        await measureAll(list, 20, 30);
        expect(list.counts()).toEqual([0, 1]);
        for (const height of [31, 33, 29, 35]) {
            await list.run(() => updateItemSizesBatch(list.ctx(), [{ itemKey: "0", size: { height, width: 474 } }]));
        }
        expect(list.counts()).toEqual([0, 1]);
        list.rendered.unmount();
    });

    it("does not loop a chat loading header at the start with maintainVisibleContentPosition", async () => {
        const data = rows(3);
        const list = await mount({
            alignItemsAtEnd: true,
            data,
            getFixedItemSize: () => 50,
            maintainVisibleContentPosition: true,
        });
        expect(list.counts()[0]).toBe(1);
        for (let i = 0; i < 3; i++) {
            await list.update({ ListHeaderComponent: () => <Text>loading older</Text> });
            await list.run(() => setHeaderSize(list.ctx(), 60));
            await list.update({ ListHeaderComponent: undefined });
        }
        expect(list.counts()[0]).toBe(1);
        await list.update({ data: [...rows(2, 100), ...data] });
        expect(list.counts()[0]).toBe(2);
        list.rendered.unmount();
    });
});
