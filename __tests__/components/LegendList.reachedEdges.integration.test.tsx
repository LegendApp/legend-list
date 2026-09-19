import { describe, expect, it } from "bun:test";
import "../setup";

import * as React from "react";
import { Text } from "react-native";

import type { LegendListRef } from "../../src/types.base";
import { act, render } from "../helpers/testingLibrary";

async function flushFrames() {
    for (let i = 0; i < 12; i++) {
        await act(async () => {
            await new Promise((resolve) => requestAnimationFrame(resolve));
        });
    }
}

describe("mounted grid reached callbacks", () => {
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

            // Clear and repopulate the same dataset key: its new initial placement
            // must not inherit the previous edge notification either.
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
            expect(calls).toHaveLength(3);
            rendered.unmount();
        });
    }
});
