import { describe, expect, it } from "bun:test";
import "../setup";

import * as React from "react";
import { Text } from "react-native";

import { act, render } from "../helpers/testingLibrary";

async function flushFrames(count: number) {
    for (let i = 0; i < count; i++) {
        await act(async () => {
            await new Promise((resolve) => requestAnimationFrame(resolve));
        });
    }
}

const items = [{ id: "0" }, { id: "1" }];

describe("new data arrays on every render", () => {
    for (const edge of ["end", "start"] as const) {
        for (const pattern of ["counter", "loading"] as const) {
            it(`does not loop ${edge} when the callback sets ${pattern} state without new rows`, async () => {
                const { LegendList } = await import("../../src/components/LegendList");
                let scrollProps: any;
                const ScrollSurface = React.forwardRef(function LoopScrollSurface(
                    props: any,
                    forwardedRef: React.Ref<any>,
                ) {
                    scrollProps = props;
                    React.useImperativeHandle(forwardedRef, () => ({ measure: () => {}, scrollTo: () => {} }));
                    return <>{props.children}</>;
                });
                let calls = 0;
                function App() {
                    const [, setCount] = React.useState(0);
                    const [, setLoading] = React.useState(false);
                    const onReached = () => {
                        calls++;
                        // Cap updates so a regression fails an assertion instead of looping forever.
                        if (calls > 30) return;
                        if (pattern === "counter") {
                            setCount((value) => value + 1);
                        } else {
                            setLoading(true);
                            void Promise.resolve().then(() => setLoading(false));
                        }
                    };
                    return (
                        <LegendList
                            data={items.slice()}
                            estimatedItemSize={83}
                            getFixedItemSize={() => 83}
                            keyExtractor={(item: { id: string }) => item.id}
                            onEndReached={edge === "end" ? onReached : undefined}
                            onStartReached={edge === "start" ? onReached : undefined}
                            renderItem={({ item }: { item: { id: string } }) => <Text>{item.id}</Text>}
                            renderScrollComponent={(props: any) => <ScrollSurface {...props} />}
                        />
                    );
                }
                const rendered = render(<App />);
                await flushFrames(4);
                act(() => scrollProps.onLayout({ nativeEvent: { layout: { height: 800, width: 300, x: 0, y: 0 } } }));
                await flushFrames(10);
                await flushFrames(10);
                expect(calls).toBe(1);
                rendered.unmount();
            });
        }
    }
});
