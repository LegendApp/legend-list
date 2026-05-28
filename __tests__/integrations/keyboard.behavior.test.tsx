import { beforeEach, describe, expect, it, mock } from "bun:test";
import "../setup";

import * as React from "react";
import type { LayoutChangeEvent } from "react-native";

import { useCombinedRef } from "../../src/hooks/useCombinedRef";
import { typedForwardRef } from "../../src/types.internal";
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

mock.module("@legendapp/list/react-native", () => ({
    internal: {
        typedForwardRef,
        useCombinedRef,
    },
}));

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
    const { KeyboardAwareLegendList } = await import("../../src/integrations/keyboard?keyboard-behavior-test");

    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
        renderer = TestRenderer.create(<KeyboardAwareLegendList {...baseProps} {...props} />);
    });

    return renderer!;
};

function ComposerInsetProbe({
    initialHeight,
    measureHeight,
    onResult,
    useKeyboardChatComposerInset,
}: {
    initialHeight?: number;
    measureHeight: number;
    onResult: (result: ReturnType<typeof useKeyboardChatComposerInset>) => void;
    useKeyboardChatComposerInset: typeof import("../../src/integrations/keyboard").useKeyboardChatComposerInset;
}) {
    const listRef = React.useRef({ reportContentInset: reportContentInsetMock });
    const composerRef = React.useRef({
        measure: (callback: (x: number, y: number, width: number, height: number) => void) => {
            callback(0, 0, 320, measureHeight);
        },
    });
    const result = useKeyboardChatComposerInset(listRef, composerRef, initialHeight);

    React.useEffect(() => {
        onResult(result);
    }, [onResult, result]);

    return null;
}

describe("KeyboardAwareLegendList", () => {
    beforeEach(() => {
        lastAnimatedLegendListProps = undefined;
        reportContentInsetMock.mockClear();
    });

    it("bridges anchored end space updates into blankSpace and preserves upstream callbacks", async () => {
        const onSizeChanged = mock(() => {});
        const onCommit = mock(() => {});

        await renderKeyboardAwareLegendList({
            anchoredEndSpace: { anchorIndex: 0, anchorOffset: 12, onCommit, onSizeChanged },
            contentInsetEndAdjustment: createSharedValue(24),
        });

        expect(lastAnimatedLegendListProps.anchoredEndSpace.anchorIndex).toBe(0);
        expect(lastAnimatedLegendListProps.anchoredEndSpace.anchorOffset).toBe(12);
        expect(lastAnimatedLegendListProps.anchoredEndSpace.includeInEndInset).toBe(true);

        const scrollElement = lastAnimatedLegendListProps.renderScrollComponent({ testID: "list" });

        expect(scrollElement.props.blankSpace.value).toBe(0);
        expect(scrollElement.props.extraContentPadding.value).toBe(24);
        expect(lastAnimatedLegendListProps.contentInsetEndAdjustment).toBeUndefined();

        lastAnimatedLegendListProps.anchoredEndSpace.onSizeChanged(64);

        expect(scrollElement.props.blankSpace.value).toBe(64);
        expect(onSizeChanged).toHaveBeenCalledWith(64);

        lastAnimatedLegendListProps.anchoredEndSpace.onCommit(64);

        expect(onCommit).toHaveBeenCalledWith(64);
    });

    it("clears blankSpace when anchored end space is removed", async () => {
        const renderer = await renderKeyboardAwareLegendList({
            anchoredEndSpace: { anchorIndex: 0 },
        });

        const firstScrollElement = lastAnimatedLegendListProps.renderScrollComponent({});
        lastAnimatedLegendListProps.anchoredEndSpace.onSizeChanged(48);
        expect(firstScrollElement.props.blankSpace.value).toBe(48);

        const { KeyboardAwareLegendList } = await import(
            "../../src/integrations/keyboard?keyboard-behavior-update-test"
        );

        act(() => {
            renderer.update(<KeyboardAwareLegendList {...baseProps} anchoredEndSpace={undefined} />);
        });

        const nextScrollElement = lastAnimatedLegendListProps.renderScrollComponent({});

        expect(lastAnimatedLegendListProps.anchoredEndSpace).toBeUndefined();
        expect(nextScrollElement.props.blankSpace.value).toBe(0);
    });

    it("reports KeyboardChatScrollView content inset changes to LegendList", async () => {
        await renderKeyboardAwareLegendList();

        const scrollElement = lastAnimatedLegendListProps.renderScrollComponent({});
        const insets = { bottom: 32, left: 0, right: 0, top: 0 };

        scrollElement.props.onContentInsetChange(insets);

        expect(reportContentInsetMock).toHaveBeenCalledWith(insets);
        expect(lastAnimatedLegendListProps.onContentInsetChange).toBeUndefined();
    });

    it("reports measured composer height as bottom content inset", async () => {
        const { useKeyboardChatComposerInset } = await import("../../src/integrations/keyboard?composer-inset-test");
        let hookResult: ReturnType<typeof useKeyboardChatComposerInset> | undefined;

        act(() => {
            TestRenderer.create(
                <ComposerInsetProbe
                    initialHeight={12}
                    measureHeight={42}
                    onResult={(result) => {
                        hookResult = result;
                    }}
                    useKeyboardChatComposerInset={useKeyboardChatComposerInset}
                />,
            );
        });

        expect(hookResult?.contentInsetEndAdjustment.value).toBe(42);
        expect(reportContentInsetMock).toHaveBeenCalledTimes(1);
        expect(reportContentInsetMock).toHaveBeenNthCalledWith(1, { bottom: 42 });

        act(() => {
            hookResult?.onComposerLayout({ nativeEvent: { layout: { height: 42 } } } as LayoutChangeEvent);
        });

        expect(reportContentInsetMock).toHaveBeenCalledTimes(1);
        expect(hookResult?.contentInsetEndAdjustment.value).toBe(42);

        act(() => {
            hookResult?.onComposerLayout({ nativeEvent: { layout: { height: 64 } } } as LayoutChangeEvent);
        });

        expect(hookResult?.contentInsetEndAdjustment.value).toBe(64);
        expect(reportContentInsetMock).toHaveBeenCalledTimes(2);
        expect(reportContentInsetMock).toHaveBeenNthCalledWith(2, { bottom: 64 });
    });

    it("reports the initial composer inset when measurement matches the initial height", async () => {
        const { useKeyboardChatComposerInset } = await import(
            "../../src/integrations/keyboard?composer-inset-initial-test"
        );
        let hookResult: ReturnType<typeof useKeyboardChatComposerInset> | undefined;

        act(() => {
            TestRenderer.create(
                <ComposerInsetProbe
                    initialHeight={42}
                    measureHeight={42}
                    onResult={(result) => {
                        hookResult = result;
                    }}
                    useKeyboardChatComposerInset={useKeyboardChatComposerInset}
                />,
            );
        });

        expect(hookResult?.contentInsetEndAdjustment.value).toBe(42);
        expect(reportContentInsetMock).toHaveBeenCalledTimes(1);
        expect(reportContentInsetMock).toHaveBeenNthCalledWith(1, { bottom: 42 });
    });
});
