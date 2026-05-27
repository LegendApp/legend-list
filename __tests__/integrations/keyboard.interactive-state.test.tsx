import { beforeEach, describe, expect, it, mock } from "bun:test";
import "../setup";

import * as React from "react";

import TestRenderer, { act } from "../helpers/testRenderer";

let lastAnimatedLegendListProps: any;
const reportContentInsetMock = mock(
    (_insets: Partial<{ bottom: number; left: number; right: number; top: number }>) => {},
);

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

const renderKeyboardAwareLegendList = async (props: Record<string, unknown> = {}) => {
    const { KeyboardAwareLegendList } = await import("../../src/integrations/keyboard?keyboard-aware-props-test");

    act(() => {
        TestRenderer.create(<KeyboardAwareLegendList {...baseProps} {...props} />);
    });
};

describe("KeyboardAwareLegendList", () => {
    beforeEach(() => {
        lastAnimatedLegendListProps = undefined;
        reportContentInsetMock.mockClear();
    });

    it("forwards keyboard-controller behavior props into KeyboardChatScrollView", async () => {
        const freeze = createSharedValue(false);

        await renderKeyboardAwareLegendList({
            applyWorkaroundForContentInsetHitTestBug: true,
            freeze,
            keyboardLiftBehavior: "whenAtEnd",
            keyboardOffset: 18,
        });

        const scrollElement = lastAnimatedLegendListProps.renderScrollComponent({});

        expect(scrollElement.props.applyWorkaroundForContentInsetHitTestBug).toBe(true);
        expect(scrollElement.props.freeze).toBe(freeze);
        expect(scrollElement.props.keyboardLiftBehavior).toBe("whenAtEnd");
        expect(scrollElement.props.offset).toBe(18);
    });

    it("uses offset as a compatibility fallback", async () => {
        await renderKeyboardAwareLegendList({
            offset: 20,
        });

        const scrollElement = lastAnimatedLegendListProps.renderScrollComponent({});

        expect(scrollElement.props.offset).toBe(20);
    });

    it("uses safeAreaInsetBottom as a compatibility offset fallback", async () => {
        await renderKeyboardAwareLegendList({
            safeAreaInsetBottom: 24,
        });

        const scrollElement = lastAnimatedLegendListProps.renderScrollComponent({});

        expect(scrollElement.props.offset).toBe(24);
    });
});
