import { beforeEach, describe, expect, it, mock } from "bun:test";
import "../setup";

import * as React from "react";
import { Keyboard, type LayoutChangeEvent, Platform } from "react-native";

import { useCombinedRef } from "../../src/hooks/useCombinedRef";
import { typedForwardRef } from "../../src/types.internal";
import TestRenderer, { act } from "../helpers/testRenderer";

let lastAnimatedLegendListProps: any;
const reportContentInsetMock = mock(
    (_insets: Partial<{ bottom: number; left: number; right: number; top: number }>) => {},
);
const keyboardDismissMock = mock(() => Promise.resolve());
const keyboardListeners = new Map<string, Set<() => void>>();
const keyboardAddListenerMock = mock((eventName: string, listener: () => void) => {
    let listeners = keyboardListeners.get(eventName);

    if (!listeners) {
        listeners = new Set();
        keyboardListeners.set(eventName, listeners);
    }

    listeners.add(listener);

    return {
        remove: mock(() => {
            listeners?.delete(listener);
        }),
    };
});

const emitKeyboardEvent = (eventName: string) => {
    for (const listener of keyboardListeners.get(eventName) ?? []) {
        listener();
    }
};

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
        dismiss: keyboardDismissMock,
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

function ScrollToEndProbe({
    freeze,
    listRef,
    onResult,
    useKeyboardScrollToEnd,
}: {
    freeze: ReturnType<typeof createSharedValue<boolean>>;
    listRef: React.RefObject<{ scrollToEnd(params?: { animated?: boolean }): Promise<void> } | null>;
    onResult: (result: ReturnType<typeof useKeyboardScrollToEnd>) => void;
    useKeyboardScrollToEnd: typeof import("../../src/integrations/keyboard").useKeyboardScrollToEnd;
}) {
    const result = useKeyboardScrollToEnd({ freeze, listRef });

    React.useEffect(() => {
        onResult(result);
    }, [onResult, result]);

    return null;
}

describe("KeyboardAwareLegendList", () => {
    const originalPlatform = Platform.OS;

    beforeEach(() => {
        Platform.OS = originalPlatform;
        Keyboard.addListener = keyboardAddListenerMock as typeof Keyboard.addListener;
        keyboardAddListenerMock.mockClear();
        keyboardDismissMock.mockClear();
        keyboardListeners.clear();
        lastAnimatedLegendListProps = undefined;
        reportContentInsetMock.mockClear();
    });

    it("bridges anchored end space updates into blankSpace and preserves upstream callbacks", async () => {
        const onSizeChanged = mock(() => {});

        await renderKeyboardAwareLegendList({
            anchoredEndSpace: { anchorIndex: 0, anchorOffset: 12, onSizeChanged },
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

    it("keeps non-Android keyboard dismissal and scroll in the existing parallel path", async () => {
        const { useKeyboardScrollToEnd } = await import("../../src/integrations/keyboard?ios-scroll-to-end-test");
        const freeze = createSharedValue(false);
        const scrollToEnd = mock(async (_params?: { animated?: boolean }) => {});
        let hookResult: ReturnType<typeof useKeyboardScrollToEnd> | undefined;

        Platform.OS = "ios";

        act(() => {
            TestRenderer.create(
                <ScrollToEndProbe
                    freeze={freeze}
                    listRef={{ current: { scrollToEnd } }}
                    onResult={(result) => {
                        hookResult = result;
                    }}
                    useKeyboardScrollToEnd={useKeyboardScrollToEnd}
                />,
            );
        });

        await act(async () => {
            await hookResult?.scrollMessageToEnd({ animated: true, closeKeyboard: true });
        });

        expect(keyboardDismissMock).toHaveBeenCalledTimes(1);
        expect(keyboardAddListenerMock).not.toHaveBeenCalled();
        expect(scrollToEnd).toHaveBeenCalledTimes(1);
        expect(scrollToEnd).toHaveBeenNthCalledWith(1, { animated: true });
        expect(freeze.value).toBe(false);
    });

    it("runs Android scroll after keyboard hide and layout settle", async () => {
        const { useKeyboardScrollToEnd } = await import("../../src/integrations/keyboard?android-scroll-to-end-test");
        const freeze = createSharedValue(false);
        const scrollToEnd = mock(async (_params?: { animated?: boolean }) => {});
        let hookResult: ReturnType<typeof useKeyboardScrollToEnd> | undefined;

        Platform.OS = "android";

        act(() => {
            TestRenderer.create(
                <ScrollToEndProbe
                    freeze={freeze}
                    listRef={{ current: { scrollToEnd } }}
                    onResult={(result) => {
                        hookResult = result;
                    }}
                    useKeyboardScrollToEnd={useKeyboardScrollToEnd}
                />,
            );
        });

        const scrollPromise = hookResult!.scrollMessageToEnd({ animated: true, closeKeyboard: true });

        await Promise.resolve();

        expect(keyboardDismissMock).toHaveBeenCalledTimes(1);
        expect(keyboardAddListenerMock).toHaveBeenCalledWith("keyboardDidHide", expect.any(Function));
        expect(scrollToEnd).not.toHaveBeenCalled();

        emitKeyboardEvent("keyboardDidHide");

        await act(async () => {
            await scrollPromise;
        });

        expect(scrollToEnd).toHaveBeenCalledTimes(1);
        expect(scrollToEnd).toHaveBeenNthCalledWith(1, { animated: true });
        expect(freeze.value).toBe(false);
    });

    it("uses the Android keyboard hide fallback before the post-dismiss scroll", async () => {
        const { useKeyboardScrollToEnd } = await import("../../src/integrations/keyboard?android-fallback-scroll-test");
        const freeze = createSharedValue(false);
        const scrollToEnd = mock(async (_params?: { animated?: boolean }) => {});
        let hookResult: ReturnType<typeof useKeyboardScrollToEnd> | undefined;

        Platform.OS = "android";

        act(() => {
            TestRenderer.create(
                <ScrollToEndProbe
                    freeze={freeze}
                    listRef={{ current: { scrollToEnd } }}
                    onResult={(result) => {
                        hookResult = result;
                    }}
                    useKeyboardScrollToEnd={useKeyboardScrollToEnd}
                />,
            );
        });

        await act(async () => {
            await hookResult?.scrollMessageToEnd({ animated: true, closeKeyboard: true });
        });

        expect(keyboardDismissMock).toHaveBeenCalledTimes(1);
        expect(keyboardAddListenerMock).toHaveBeenCalledWith("keyboardDidHide", expect.any(Function));
        expect(scrollToEnd).toHaveBeenCalledTimes(1);
        expect(scrollToEnd).toHaveBeenNthCalledWith(1, { animated: true });
        expect(freeze.value).toBe(false);
    });

    it("ignores stale Android scrolls when a newer send starts", async () => {
        const { useKeyboardScrollToEnd } = await import("../../src/integrations/keyboard?stale-android-scroll-test");
        const freeze = createSharedValue(false);
        const scrollToEnd = mock(async (_params?: { animated?: boolean }) => {});
        let hookResult: ReturnType<typeof useKeyboardScrollToEnd> | undefined;

        Platform.OS = "android";

        act(() => {
            TestRenderer.create(
                <ScrollToEndProbe
                    freeze={freeze}
                    listRef={{ current: { scrollToEnd } }}
                    onResult={(result) => {
                        hookResult = result;
                    }}
                    useKeyboardScrollToEnd={useKeyboardScrollToEnd}
                />,
            );
        });

        const firstScrollPromise = hookResult!.scrollMessageToEnd({ animated: true, closeKeyboard: true });

        await Promise.resolve();

        const secondScrollPromise = hookResult!.scrollMessageToEnd({ animated: true, closeKeyboard: true });

        await Promise.resolve();
        emitKeyboardEvent("keyboardDidHide");

        await act(async () => {
            await Promise.all([firstScrollPromise, secondScrollPromise]);
        });

        expect(scrollToEnd).toHaveBeenCalledTimes(1);
        expect(scrollToEnd).toHaveBeenNthCalledWith(1, { animated: true });
        expect(freeze.value).toBe(false);
    });

    it("keeps Android closeKeyboard false on the direct scroll path", async () => {
        const { useKeyboardScrollToEnd } = await import("../../src/integrations/keyboard?android-no-close-scroll-test");
        const freeze = createSharedValue(false);
        const scrollToEnd = mock(async (_params?: { animated?: boolean }) => {});
        let hookResult: ReturnType<typeof useKeyboardScrollToEnd> | undefined;

        Platform.OS = "android";

        act(() => {
            TestRenderer.create(
                <ScrollToEndProbe
                    freeze={freeze}
                    listRef={{ current: { scrollToEnd } }}
                    onResult={(result) => {
                        hookResult = result;
                    }}
                    useKeyboardScrollToEnd={useKeyboardScrollToEnd}
                />,
            );
        });

        await act(async () => {
            await hookResult?.scrollMessageToEnd({ animated: true, closeKeyboard: false });
        });

        expect(keyboardDismissMock).not.toHaveBeenCalled();
        expect(keyboardAddListenerMock).not.toHaveBeenCalled();
        expect(scrollToEnd).toHaveBeenCalledTimes(1);
        expect(scrollToEnd).toHaveBeenNthCalledWith(1, { animated: true });
        expect(freeze.value).toBe(false);
    });
});
