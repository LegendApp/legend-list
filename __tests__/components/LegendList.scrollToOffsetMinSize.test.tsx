import { describe, expect, it, mock, spyOn } from "bun:test";
import "../setup";

import * as React from "react";
import { Text, type ViewStyle } from "react-native";

import { LegendList } from "../../src/components/LegendList";
import * as platformScroll from "../../src/core/doScrollTo";
import { doScrollTo as doNativeScrollTo } from "../../src/core/doScrollTo.native";
import { Platform } from "../../src/platform/Platform";
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

const insetGeometry = { bottom: 86, style: { minHeight: 861.667 }, top: 116, viewport: 874 };

// A 300pt header plus one 50pt row in a 500pt viewport has a logical max offset of 0.
const cases: Array<{
    name: string;
    style?: ViewStyle;
    horizontal?: boolean;
    scroll?: (ref: LegendListRef) => Promise<void>;
    expected: number;
    expectedScroll?: number;
    left?: number;
    rtl?: boolean;
    top?: number;
    bottom?: number;
    viewport?: number;
    offset?: number;
    initial?: number;
}> = [
    {
        bottom: 86,
        expected: 0,
        name: "raw zero remains native zero with short inset content",
        offset: 0,
        top: 116,
        viewport: 874,
    },
    {
        bottom: 86,
        expected: 0,
        initial: 0,
        name: "initial raw zero remains native zero with short inset content",
        offset: 0,
        top: 116,
        viewport: 874,
    },
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
        expected: 300,
        name: "scrollToEnd reaches minHeight",
        scroll: (ref) => ref.scrollToEnd({ animated: false }),
        style: { minHeight: 800 },
    },
    {
        ...insetGeometry,
        expected: 0,
        initial: 0,
        name: "initial raw zero remains reachable with minHeight and both insets",
        offset: 0,
    },
    {
        ...insetGeometry,
        expected: 0,
        name: "raw zero remains reachable with minHeight and both insets",
        offset: 0,
    },
    {
        ...insetGeometry,
        expected: 73.667,
        name: "raw offset clamps to minHeight plus the bottom inset",
        offset: 1000,
    },
    {
        ...insetGeometry,
        expected: 73.667,
        name: "scrollToEnd reaches minHeight plus the bottom inset",
        scroll: (ref) => ref.scrollToEnd({ animated: false }),
    },
    {
        bottom: 86,
        expected: -116,
        name: "short scrollToEnd remains at the negative top inset",
        scroll: (ref) => ref.scrollToEnd({ animated: false }),
        top: 116,
        viewport: 874,
    },
    {
        expected: 0,
        expectedScroll: 400,
        horizontal: true,
        left: 86,
        name: "native RTL minimum targets finish at their round-tripped offset",
        offset: 950,
        rtl: true,
        style: { minWidth: 1000 },
        viewport: 600,
    },
];

describe("scrollToOffset content container minimum size", () => {
    it.each(cases)("$name", async (testCase) => {
        const {
            style,
            horizontal = false,
            scroll,
            expected,
            expectedScroll = expected,
            left = 0,
            rtl,
            top = 0,
            bottom = 0,
            viewport = 500,
            offset = 300,
            initial,
        } = testCase;
        const minimum = horizontal ? style?.minWidth : style?.minHeight;
        const nativeContentSize = typeof minimum === "number" ? Math.max(350, minimum) : 350;
        Platform.OS = "ios";
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
                contentInset={{ bottom, left, right: 0, top }}
                data={["a"]}
                estimatedHeaderSize={300}
                estimatedItemSize={50}
                getFixedItemSize={() => 50}
                horizontal={horizontal}
                initialScrollOffset={initial}
                ListHeaderComponent={Header}
                recycleItems={false}
                ref={ref}
                renderItem={({ item }) => <Text>{item}</Text>}
                renderScrollComponent={(props: any) => <ScrollSurface {...props} />}
                rtl={rtl}
            />,
        );
        await flushFrames();
        act(() => scrollProps.onLayout({ nativeEvent: { layout: { height: viewport, width: viewport, x: 0, y: 0 } } }));
        await flushFrames();
        if (initial !== undefined) expect(ctx!.state.scrollPending).toBe(initial);
        writes.length = 0;
        const settled = mock(() => {});
        act(() => {
            void (scroll ? scroll(ref.current!) : ref.current!.scrollToOffset({ animated: false, offset })).then(
                settled,
            );
        });
        await Promise.resolve();
        if (expected > 0) expect(settled).not.toHaveBeenCalled();
        expect(writes.at(-1)?.[horizontal ? "x" : "y"] ?? 0).toBeCloseTo(expected, 6);
        if (rtl) expect(ctx!.state.scrollingTo?.targetOffset).toBeCloseTo(expectedScroll, 6);
        // The landing event must not be clamped back to the logical max.
        act(() =>
            scrollProps.onScroll({
                nativeEvent: {
                    contentOffset: { x: horizontal ? expected : 0, y: horizontal ? 0 : expected },
                    contentSize: {
                        height: horizontal ? viewport : nativeContentSize,
                        width: horizontal ? nativeContentSize : viewport,
                    },
                    layoutMeasurement: { height: viewport, width: viewport },
                },
            }),
        );
        await flushFrames();
        expect(writes.at(-1)?.[horizontal ? "x" : "y"] ?? 0).toBeCloseTo(expected, 6);
        expect(ctx!.state.scroll).toBeCloseTo(expectedScroll, 6);
        expect(ctx!.state.scrollingTo).toBeUndefined();
        expect(settled).toHaveBeenCalledTimes(1);
        if (rtl) {
            expect(ref.current!.getState().distanceFromEnd).toBe(0);
            expect(ref.current!.getState().isAtEnd).toBe(true);
        }
        list.unmount();
    });
});
