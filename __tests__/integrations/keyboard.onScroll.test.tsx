import { beforeEach, describe, expect, it, mock } from "bun:test";
import "../setup";

import * as React from "react";

import TestRenderer, { act } from "../helpers/testRenderer";

let lastAnimatedLegendListProps: any;

const runOnJSMock = mock(
    (fn: (...args: any[]) => void) =>
        (...args: any[]) =>
            fn(...args),
);
const isWorkletFunctionMock = mock((value: unknown) => Boolean((value as { __isWorklet?: boolean })?.__isWorklet));

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
        value: current,
    };
};

const useAnimatedScrollHandlerMock = mock((handlers: any) => {
    if (typeof handlers === "function") {
        return (event: unknown) => handlers(event);
    }

    return {
        __invoke: (event: unknown) => handlers?.onScroll?.(event),
        workletEventHandler: {},
    };
});

const useComposedEventHandlerMock = mock((handlers: any[]) => (event: unknown) => {
    for (const handler of handlers) {
        if (!handler) {
            continue;
        }

        if (typeof handler === "function") {
            handler(event);
            continue;
        }

        if (typeof handler.__invoke === "function") {
            handler.__invoke(event);
        }
    }
});

mock.module("react-native-keyboard-controller", () => ({
    useKeyboardHandler: () => {},
}));

mock.module("react-native-reanimated", () => ({
    isWorkletFunction: isWorkletFunctionMock,
    runOnJS: runOnJSMock,
    useAnimatedProps: (updater: () => unknown) => updater(),
    useAnimatedRef: () => ({ current: null }),
    useAnimatedScrollHandler: useAnimatedScrollHandlerMock,
    useAnimatedStyle: (updater: () => unknown) => updater(),
    useComposedEventHandler: useComposedEventHandlerMock,
    useSharedValue: createSharedValue,
}));

mock.module("@legendapp/list/reanimated", () => ({
    AnimatedLegendList: React.forwardRef(function AnimatedLegendListMock(props: any, _ref) {
        lastAnimatedLegendListProps = props;
        return null;
    }),
}));

const renderKeyboardLegendList = async (onScroll?: any) => {
    const { KeyboardAvoidingLegendList } = await import("../../src/integrations/keyboard?keyboard-onscroll-test");

    act(() => {
        TestRenderer.create(
            <KeyboardAvoidingLegendList
                data={[{ id: "1" }]}
                estimatedItemSize={10}
                keyExtractor={(item: { id: string }) => item.id}
                onScroll={onScroll}
                renderItem={() => null}
            />,
        );
    });

    expect(lastAnimatedLegendListProps).toBeDefined();
    expect(typeof lastAnimatedLegendListProps.onScroll).toBe("function");

    return lastAnimatedLegendListProps.onScroll as (event: any) => void;
};

describe("KeyboardAvoidingLegendList onScroll", () => {
    beforeEach(() => {
        lastAnimatedLegendListProps = undefined;
        runOnJSMock.mockClear();
        isWorkletFunctionMock.mockClear();
        useAnimatedScrollHandlerMock.mockClear();
        useComposedEventHandlerMock.mockClear();
    });

    it("uses runOnJS for regular JS callbacks", async () => {
        const onScrollCallback = mock(() => {});
        const onScroll = await renderKeyboardLegendList(onScrollCallback);
        const event = { contentOffset: { x: 0, y: 123 } };

        onScroll(event);

        expect(runOnJSMock).toHaveBeenCalledTimes(1);
        expect(runOnJSMock).toHaveBeenCalledWith(onScrollCallback);
        expect(onScrollCallback).toHaveBeenCalledWith(event);
    });

    it("calls worklet callbacks directly on the UI handler path", async () => {
        const onScrollWorklet = mock(() => {});
        (onScrollWorklet as any).__isWorklet = true;
        (onScrollWorklet as any).__workletHash = true;
        const onScroll = await renderKeyboardLegendList(onScrollWorklet);
        const event = { contentOffset: { x: 0, y: 44 } };

        onScroll(event);

        expect(isWorkletFunctionMock).toHaveBeenCalledWith(onScrollWorklet);
        expect(runOnJSMock).not.toHaveBeenCalled();
        expect(onScrollWorklet).toHaveBeenCalledWith(event);
    });

    it("supports handlers returned by useAnimatedScrollHandler", async () => {
        const { useAnimatedScrollHandler } = await import("react-native-reanimated");
        const onScrollFromHookCallback = mock(() => {});
        const onScrollFromHook = useAnimatedScrollHandler({
            onScroll: onScrollFromHookCallback,
        });
        const onScroll = await renderKeyboardLegendList(onScrollFromHook);
        const event = { contentOffset: { x: 0, y: 88 } };

        onScroll(event);

        expect(onScrollFromHookCallback).toHaveBeenCalledWith(event);
        expect(runOnJSMock).not.toHaveBeenCalled();
    });
});
