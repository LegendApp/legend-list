import { describe, expect, it, spyOn } from "bun:test";
import "../setup";

import * as React from "react";
import { Text, type ViewStyle } from "react-native";

import { LegendList } from "../../src/components/LegendList";
import * as platformScroll from "../../src/core/doScrollTo";
import { doScrollTo as doNativeScrollTo } from "../../src/core/doScrollTo.native";
import { type StateContext, useStateContext } from "../../src/state/state";
import type { LegendListRef } from "../../src/types.base";
import { act, render } from "../helpers/testingLibrary";

async function flushFrames() {
    for (let i = 0; i < 4; i++) {
        await act(async () => {
            await new Promise((resolve) => requestAnimationFrame(resolve));
        });
    }
}

// A 300pt header plus one 50pt row in a 500pt viewport has a logical max offset of 0.
const cases: Array<{
    name: string;
    style?: ViewStyle;
    horizontal?: boolean;
    scroll?: (ref: LegendListRef) => Promise<void>;
    expected: number;
}> = [
    { expected: 300, name: "scrollToOffset reaches a numeric minHeight", style: { minHeight: 800 } },
    { expected: 300, horizontal: true, name: "scrollToOffset reaches a numeric minWidth", style: { minWidth: 800 } },
    { expected: 0, name: "scrollToOffset without a minimum clamps to the logical max" },
    { expected: 0, name: "scrollToOffset ignores a percentage minHeight", style: { minHeight: "160%" } },
    {
        expected: 0,
        name: "scrollToIndex top alignment clamps to the logical max despite minHeight",
        scroll: (ref) => ref.scrollToIndex({ animated: false, index: 0, viewPosition: 0 }),
        style: { minHeight: 800 },
    },
    {
        expected: 0,
        name: "scrollToEnd ignores minHeight",
        scroll: (ref) => ref.scrollToEnd({ animated: false }),
        style: { minHeight: 800 },
    },
];

describe("scrollToOffset content container minimum size", () => {
    it.each(cases)("$name", async ({ style, horizontal = false, scroll, expected }) => {
        spyOn(platformScroll, "doScrollTo").mockImplementation(doNativeScrollTo);
        const ref = React.createRef<LegendListRef>();
        let ctx: StateContext;
        let scrollProps: any;
        const writes: Array<{ x: number; y: number }> = [];
        function Header() {
            ctx = useStateContext();
            return <Text>Hero</Text>;
        }
        const ScrollSurface = React.forwardRef(function MinSizeScrollSurface(props: any, forwardedRef: React.Ref<any>) {
            scrollProps = props;
            React.useImperativeHandle(forwardedRef, () => ({
                measure: () => {},
                scrollTo: (options: { x: number; y: number }) => writes.push(options),
            }));
            return <>{props.children}</>;
        });
        const list = render(
            <LegendList
                contentContainerStyle={style}
                data={["a"]}
                estimatedHeaderSize={300}
                estimatedItemSize={50}
                getFixedItemSize={() => 50}
                horizontal={horizontal}
                ListHeaderComponent={Header}
                recycleItems={false}
                ref={ref}
                renderItem={({ item }) => <Text>{item}</Text>}
                renderScrollComponent={(props: any) => <ScrollSurface {...props} />}
            />,
        );
        await flushFrames();
        act(() => scrollProps.onLayout({ nativeEvent: { layout: { height: 500, width: 500, x: 0, y: 0 } } }));
        await flushFrames();
        writes.length = 0;
        act(() => {
            void (scroll ? scroll(ref.current!) : ref.current!.scrollToOffset({ animated: false, offset: 300 }));
        });
        expect(writes.at(-1)?.[horizontal ? "x" : "y"] ?? 0).toBe(expected);
        // The landing event must not be clamped back to the logical max.
        act(() =>
            scrollProps.onScroll({
                nativeEvent: {
                    contentOffset: { x: horizontal ? expected : 0, y: horizontal ? 0 : expected },
                    contentSize: { height: horizontal ? 500 : 800, width: horizontal ? 800 : 500 },
                    layoutMeasurement: { height: 500, width: 500 },
                },
            }),
        );
        await flushFrames();
        expect(writes.at(-1)?.[horizontal ? "x" : "y"] ?? 0).toBe(expected);
        expect(ctx!.state.scroll).toBe(expected);
        expect(ctx!.state.scrollingTo).toBeUndefined();
        list.unmount();
    });
});
