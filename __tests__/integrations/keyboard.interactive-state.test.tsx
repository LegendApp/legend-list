import { beforeEach, describe, expect, it, mock } from "bun:test";
import "../setup";

import * as React from "react";

import TestRenderer, { act } from "../helpers/testRenderer";

let lastAnimatedLegendListProps: any;

type KeyboardHandlerEvent = {
    duration: number;
    eventName: string;
    height: number;
    progress: number;
    target: number;
};

let lastKeyboardHandlers: Record<string, ((event: KeyboardHandlerEvent) => void) | undefined> | undefined;

const runOnJSMock = mock(
    (fn: (...args: any[]) => void) =>
        (...args: any[]) =>
            fn(...args),
);

const setScrollProcessingEnabledMock = mock((_enabled: boolean) => {});
const reportContentInsetMock = mock((_bottom: number) => {});
const getStateMock = mock(() => ({
    contentLength: 1200,
    scroll: 400,
    scrollLength: 800,
}));

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

mock.module("react-native-keyboard-controller", () => ({
    useKeyboardHandler: (handlers: Record<string, (event: KeyboardHandlerEvent) => void>) => {
        lastKeyboardHandlers = handlers;
    },
}));

const createReanimatedModuleMock = () => {
    const shared = {
        isWorkletFunction: () => false,
        runOnJS: runOnJSMock,
        useAnimatedProps: (updater: () => unknown) => updater,
        useAnimatedRef: () => ({ current: null }),
        useAnimatedScrollHandler: (handler: any) => handler,
        useAnimatedStyle: (updater: () => unknown) => updater,
        useComposedEventHandler: (handlers: any[]) => handlers[0],
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
    AnimatedLegendList: React.forwardRef(function AnimatedLegendListMock(props: any, ref: React.ForwardedRef<any>) {
        lastAnimatedLegendListProps = props;
        React.useImperativeHandle(
            ref,
            () => ({
                getState: getStateMock,
                reportContentInset: reportContentInsetMock,
                setScrollProcessingEnabled: setScrollProcessingEnabledMock,
            }),
            [],
        );
        return null;
    }),
}));

const createKeyboardEvent = (progress: number, height: number): KeyboardHandlerEvent => ({
    duration: 250,
    eventName: "test",
    height,
    progress,
    target: 1,
});

const triggerKeyboardHandler = (
    name: "onStart" | "onMove" | "onEnd" | "onInteractive",
    event: KeyboardHandlerEvent,
) => {
    const handler = lastKeyboardHandlers?.[name];
    expect(typeof handler).toBe("function");
    handler?.(event);
};

const renderKeyboardLegendList = async () => {
    const { KeyboardAvoidingLegendList } = await import(
        "../../src/integrations/keyboard?keyboard-interactive-state-test"
    );

    act(() => {
        TestRenderer.create(
            <KeyboardAvoidingLegendList
                data={[{ id: "1" }]}
                estimatedItemSize={10}
                keyExtractor={(item: { id: string }) => item.id}
                renderItem={() => null}
            />,
        );
    });
};

describe("KeyboardAvoidingLegendList interactive dismissal state", () => {
    beforeEach(() => {
        lastKeyboardHandlers = undefined;
        lastAnimatedLegendListProps = undefined;
        runOnJSMock.mockClear();
        setScrollProcessingEnabledMock.mockClear();
        reportContentInsetMock.mockClear();
        getStateMock.mockClear();
    });

    it("recovers from canceled interactive dismissal and re-enables animated close setup", async () => {
        await renderKeyboardLegendList();

        // Initial keyboard open transition to establish "keyboard is open" state.
        triggerKeyboardHandler("onStart", createKeyboardEvent(1, 300));
        triggerKeyboardHandler("onEnd", createKeyboardEvent(1, 300));

        // User starts interactive dismissal but does not finish it.
        triggerKeyboardHandler("onInteractive", createKeyboardEvent(0.6, 180));

        const callsBeforeSpuriousStart = setScrollProcessingEnabledMock.mock.calls.length;
        triggerKeyboardHandler("onStart", createKeyboardEvent(1, 300));
        expect(setScrollProcessingEnabledMock.mock.calls.length).toBe(callsBeforeSpuriousStart + 1);
        expect(setScrollProcessingEnabledMock.mock.calls.at(-1)).toEqual([true]);

        const callsBeforeCloseStart = setScrollProcessingEnabledMock.mock.calls.length;
        triggerKeyboardHandler("onStart", createKeyboardEvent(0, 0));
        expect(setScrollProcessingEnabledMock.mock.calls.length).toBe(callsBeforeCloseStart + 1);
        expect(setScrollProcessingEnabledMock.mock.calls.at(-1)).toEqual([false]);
    });

    it("does not leave animation mode running for ignored spurious start events", async () => {
        await renderKeyboardLegendList();

        triggerKeyboardHandler("onStart", createKeyboardEvent(1, 300));
        triggerKeyboardHandler("onEnd", createKeyboardEvent(1, 300));

        triggerKeyboardHandler("onStart", createKeyboardEvent(1, 300));
        const callsAfterSpuriousStart = setScrollProcessingEnabledMock.mock.calls.length;

        triggerKeyboardHandler("onEnd", createKeyboardEvent(1, 300));
        expect(setScrollProcessingEnabledMock.mock.calls.length).toBe(callsAfterSpuriousStart);
    });

    it("ignores the first observed close after mount so keyboard handling does not disturb initial scroll", async () => {
        await renderKeyboardLegendList();

        const getAnimatedProps = () => lastAnimatedLegendListProps.animatedProps();
        const callsBeforeCloseStart = setScrollProcessingEnabledMock.mock.calls.length;

        triggerKeyboardHandler("onStart", createKeyboardEvent(0, 0));
        expect(setScrollProcessingEnabledMock.mock.calls.length).toBe(callsBeforeCloseStart);

        triggerKeyboardHandler("onMove", createKeyboardEvent(0.5, 150));

        expect(getAnimatedProps().contentInset?.bottom).toBe(0);
        expect(getAnimatedProps().contentOffset).toBeUndefined();

        triggerKeyboardHandler("onEnd", createKeyboardEvent(0, 0));

        expect(getAnimatedProps().contentInset?.bottom).toBe(0);
        expect(getAnimatedProps().contentOffset).toBeUndefined();
        expect(reportContentInsetMock.mock.calls.at(-1)).toEqual([{ bottom: 0 }]);

        triggerKeyboardHandler("onStart", createKeyboardEvent(1, 300));
        triggerKeyboardHandler("onEnd", createKeyboardEvent(1, 300));

        expect(getAnimatedProps().contentInset?.bottom).toBe(300);
        expect(getAnimatedProps().contentOffset?.y).toBe(700);
    });
});
