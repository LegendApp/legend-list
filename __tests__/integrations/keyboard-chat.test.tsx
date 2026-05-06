import { beforeEach, describe, expect, it, mock } from "bun:test";
import "../setup";

import * as React from "react";

import TestRenderer, { act } from "../helpers/testRenderer";

let lastAnimatedLegendListProps: any;
const reportContentInsetMock = mock((_insets: { bottom: number; left: number; right: number; top: number }) => {});

const createSharedValue = <T,>(initial: T) => {
    let current = initial;
    return {
        addListener: () => {},
        get: () => current,
        modify: (modifier?: (value: T) => T) => {
            if (modifier) {
                current = modifier(current);
            }
            return current;
        },
        removeListener: () => {},
        set: (nextValue: T | ((value: T) => T)) => {
            current = typeof nextValue === "function" ? (nextValue as (prev: T) => T)(current) : nextValue;
        },
        get value() {
            return current;
        },
        set value(nextValue: T) {
            current = nextValue;
        },
    };
};

mock.module("react-native-keyboard-controller", () => ({
    KeyboardChatScrollView: (props: any) => React.createElement("keyboard-chat-scroll-view", props),
    KeyboardController: {
        dismiss: () => Promise.resolve(),
    },
    useKeyboardHandler: () => {},
}));

const createReanimatedModuleMock = () => {
    const shared = {
        isWorkletFunction: () => false,
        runOnJS:
            (fn: (...args: any[]) => void) =>
            (...args: any[]) =>
                fn(...args),
        useAnimatedProps: (updater: () => unknown) => updater(),
        useAnimatedRef: () => ({ current: null }),
        useAnimatedScrollHandler: (handler: any) => handler,
        useAnimatedStyle: (updater: () => unknown) => updater(),
        useComposedEventHandler: (handlers: any[]) => handlers[0],
        useScrollViewOffset: () => {},
        useSharedValue: createSharedValue,
    };

    return {
        __esModule: true,
        ...shared,
        default: shared,
    };
};

mock.module("react-native-reanimated", createReanimatedModuleMock);
mock.module("react-native-reanimated/lib/module/index.js", createReanimatedModuleMock);

mock.module("@legendapp/list/reanimated", () => ({
    AnimatedLegendList: React.forwardRef(function AnimatedLegendListMock(props: any, ref) {
        lastAnimatedLegendListProps = props;
        React.useImperativeHandle(
            ref,
            () => ({
                getState: () => ({
                    contentLength: 0,
                    scroll: 0,
                    scrollLength: 0,
                }),
                reportContentInset: reportContentInsetMock,
                setScrollProcessingEnabled: () => {},
            }),
            [],
        );
        return null;
    }),
}));

const baseProps = {
    data: [{ id: "1" }],
    estimatedItemSize: 10,
    keyExtractor: (item: { id: string }) => item.id,
    renderItem: () => null,
};

const renderKeyboardChatLegendList = async (props: Record<string, unknown> = {}) => {
    const { KeyboardChatLegendList } = await import("../../src/integrations/keyboard-chat");

    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
        renderer = TestRenderer.create(<KeyboardChatLegendList {...baseProps} {...props} />);
    });

    return renderer!;
};

describe("KeyboardChatLegendList", () => {
    beforeEach(() => {
        lastAnimatedLegendListProps = undefined;
        reportContentInsetMock.mockClear();
    });

    it("bridges anchored end space updates into blankSpace and preserves upstream callbacks", async () => {
        const onSizeChanged = mock(() => {});

        await renderKeyboardChatLegendList({
            anchoredEndSpace: { anchorIndex: 0, anchorOffset: 12, onSizeChanged },
            extraContentPadding: 24,
        });

        expect(lastAnimatedLegendListProps.anchoredEndSpace.anchorIndex).toBe(0);
        expect(lastAnimatedLegendListProps.anchoredEndSpace.anchorOffset).toBe(12);
        expect(lastAnimatedLegendListProps.anchoredEndSpace.includeInEndInset).toBe(true);

        const scrollElement = lastAnimatedLegendListProps.renderScrollComponent({ testID: "list" });

        expect(scrollElement.props.blankSpace.value).toBe(0);
        expect(scrollElement.props.extraContentPadding).toBe(24);

        lastAnimatedLegendListProps.anchoredEndSpace.onSizeChanged(64);

        expect(scrollElement.props.blankSpace.value).toBe(64);
        expect(onSizeChanged).toHaveBeenCalledWith(64);
    });

    it("clears blankSpace when anchored end space is removed", async () => {
        const renderer = await renderKeyboardChatLegendList({
            anchoredEndSpace: { anchorIndex: 0 },
        });

        const firstScrollElement = lastAnimatedLegendListProps.renderScrollComponent({});
        lastAnimatedLegendListProps.anchoredEndSpace.onSizeChanged(48);
        expect(firstScrollElement.props.blankSpace.value).toBe(48);

        const { KeyboardChatLegendList } = await import("../../src/integrations/keyboard-chat");

        act(() => {
            renderer.update(<KeyboardChatLegendList {...baseProps} anchoredEndSpace={undefined} />);
        });

        const nextScrollElement = lastAnimatedLegendListProps.renderScrollComponent({});

        expect(lastAnimatedLegendListProps.anchoredEndSpace).toBeUndefined();
        expect(nextScrollElement.props.blankSpace.value).toBe(0);
    });

    it("reports KeyboardChatScrollView content inset changes to LegendList", async () => {
        await renderKeyboardChatLegendList();

        const scrollElement = lastAnimatedLegendListProps.renderScrollComponent({});
        const insets = { bottom: 32, left: 0, right: 0, top: 0 };

        scrollElement.props.onContentInsetChange(insets);

        expect(reportContentInsetMock).toHaveBeenCalledWith(insets);
        expect(lastAnimatedLegendListProps.onContentInsetChange).toBeUndefined();
    });
});
