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
            const list = (key: string) => (
                <LegendList
                    data={data}
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
            rendered.unmount();
        });
    }
});
