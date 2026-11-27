import { expect, it, mock, spyOn } from "bun:test";
import "../setup";

import * as React from "react";
import { type ScrollViewProps, Text } from "react-native";

import * as platformScroll from "../../src/core/doScrollTo";
import { doScrollTo as doNativeScrollTo } from "../../src/core/doScrollTo.native";
import { Platform } from "../../src/platform/Platform";
import { LegendList, type LegendListRef } from "../../src/react-native";
import { act, render } from "../helpers/testingLibrary";
import { installFakeClock } from "../helpers/webScrollHarness";

it.each([
    { name: "prepend inside the threshold", offset: 50, threshold: 100 },
    { name: "prepend at the threshold", offset: 100, threshold: 100 },
    { name: "prepend outside the threshold", offset: 150, threshold: 100 },
    { name: "hold position on prepend without a threshold", offset: 50 },
    { append: true, name: "append inside the threshold", offset: 50, threshold: 100 },
])("native MVCP: $name", async ({ append, offset, threshold }) => {
    Platform.OS = "ios";
    spyOn(platformScroll, "doScrollTo").mockImplementation(doNativeScrollTo);
    const clock = installFakeClock();
    const ref = React.createRef<LegendListRef>();
    const rows = Array.from({ length: 20 }, (_, index) => String(index));
    const scrollTo = mock();
    let scrollProps: ScrollViewProps;
    const ScrollSurface = React.forwardRef((props: ScrollViewProps, scrollRef) => {
        scrollProps = props;
        React.useImperativeHandle(scrollRef, () => ({
            getScrollableNode: () => ({}),
            measure: () => {},
            scrollTo,
        }));
        return <>{props.children}</>;
    });
    const list = (data: string[]) => (
        <LegendList
            data={data}
            getFixedItemSize={() => 60}
            keyExtractor={(item) => item}
            maintainVisibleContentPosition={
                threshold === undefined ? { data: true } : { autoscrollToTopThreshold: threshold, data: true }
            }
            ref={ref}
            renderItem={({ item }) => <Text>{item}</Text>}
            renderScrollComponent={(props) => <ScrollSurface {...props} />}
        />
    );
    const layout = { height: 250, width: 200 };
    try {
        const rendered = render(list(rows));
        act(() =>
            scrollProps.onLayout?.({ nativeEvent: { layout } } as Parameters<
                NonNullable<ScrollViewProps["onLayout"]>
            >[0]),
        );
        await act(async () => clock.advance(64));
        act(() =>
            scrollProps.onScroll?.({
                nativeEvent: {
                    contentOffset: { x: 0, y: offset },
                    contentSize: { height: 1200, width: 200 },
                    layoutMeasurement: layout,
                },
            } as Parameters<NonNullable<ScrollViewProps["onScroll"]>>[0]),
        );
        await act(async () => clock.advance(128));
        expect(ref.current!.getState().scroll).toBe(offset);
        scrollTo.mockClear();

        const added = ["new-0", "new-1", "new-2"];
        rendered.rerender(list(append ? [...rows, ...added] : [...added, ...rows]));
        await act(async () => clock.advance(32));

        expect(ref.current!.getState().scroll).toBe(append ? offset : offset + 180);
        expect(scrollProps!.maintainVisibleContentPosition).toStrictEqual(
            threshold === undefined
                ? { minIndexForVisible: 0 }
                : { autoscrollToTopThreshold: threshold, minIndexForVisible: 0 },
        );
        expect(scrollTo).not.toHaveBeenCalled();
        rendered.unmount();
    } finally {
        clock.restore();
    }
});

it("forwards and updates the threshold on the default native ScrollView", () => {
    Platform.OS = "ios";
    const data = ["row"];
    const renderItem = ({ item }: { item: string }) => <Text>{item}</Text>;
    const list = (threshold?: number) => (
        <LegendList
            data={data}
            maintainVisibleContentPosition={{ autoscrollToTopThreshold: threshold, data: true }}
            renderItem={renderItem}
        />
    );
    const rendered = render(list(0));
    expect(rendered.toJSON().type).toBe("AnimatedScrollView");
    expect(rendered.toJSON().props.maintainVisibleContentPosition).toStrictEqual({
        autoscrollToTopThreshold: 0,
        minIndexForVisible: 0,
    });

    rendered.rerender(list());
    expect(rendered.toJSON().props.maintainVisibleContentPosition).toStrictEqual({ minIndexForVisible: 0 });
});

it("holds each list's native anchor range for the lifetime of the mount", () => {
    Platform.OS = "ios";
    const rows = ["row"];
    const renderItem = ({ item }: { item: string }) => <Text>{item}</Text>;
    const list = (nativeAnchorRange: number, key = "first") => (
        <LegendList
            data={rows}
            key={key}
            maintainVisibleContentPosition={{ data: true, nativeAnchorRange }}
            renderItem={renderItem}
        />
    );
    const rendered = render(list(2_000_000));
    expect(rendered.toJSON().children[0].props.style.top).toBe(2_000_000);

    rendered.rerender(list(3_000_000));
    expect(rendered.toJSON().children[0].props.style.top).toBe(2_000_000);

    rendered.rerender(list(3_000_000, "second"));
    expect(rendered.toJSON().children[0].props.style.top).toBe(3_000_000);
    rendered.unmount();
});
