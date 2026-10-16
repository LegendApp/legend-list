import { beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import "../setup";

import * as React from "react";
import type { LayoutChangeEvent } from "react-native";

import { useCombinedRef } from "../../src/hooks/useCombinedRef";
import { typedForwardRef } from "../../src/types.internal";
import { registerReanimatedModuleMock } from "../__mocks__/reanimated";
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

const createReanimatedOverrides = () => {
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

    return shared;
};

beforeEach(() => registerReanimatedModuleMock(createReanimatedOverrides()));

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
        const onReady = mock(() => {});

        await renderKeyboardAwareLegendList({
            anchoredEndSpace: { anchorIndex: 0, anchorMaxSize: 44, anchorOffset: 12, onReady, onSizeChanged },
            contentInsetEndAdjustment: createSharedValue(24),
        });

        expect(lastAnimatedLegendListProps.anchoredEndSpace.anchorIndex).toBe(0);
        expect(lastAnimatedLegendListProps.anchoredEndSpace.anchorMaxSize).toBe(44);
        expect(lastAnimatedLegendListProps.anchoredEndSpace.anchorOffset).toBe(12);
        expect(lastAnimatedLegendListProps.anchoredEndSpace.includeInEndInset).toBeUndefined();
        expect(lastAnimatedLegendListProps.anchoredEndSpaceOwnerInternal).toBe("scroll");

        const scrollElement = lastAnimatedLegendListProps.renderScrollComponent({ testID: "list" });

        expect(scrollElement.props.blankSpace.value).toBe(0);
        expect(scrollElement.props.extraContentPadding.value).toBe(24);
        expect(lastAnimatedLegendListProps.contentInsetEndAdjustment).toBeUndefined();

        lastAnimatedLegendListProps.anchoredEndSpace.onSizeChanged(64);

        expect(scrollElement.props.blankSpace.value).toBe(64);
        expect(onSizeChanged).toHaveBeenCalledWith(64);

        lastAnimatedLegendListProps.anchoredEndSpace.onReady({
            anchorIndex: 0,
            anchorKey: "item_0",
            size: 64,
        });

        expect(onReady).toHaveBeenCalledWith({
            anchorIndex: 0,
            anchorKey: "item_0",
            size: 64,
        });
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

    it("updates composer padding without overwriting the controller-reported content inset", async () => {
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
        expect(reportContentInsetMock).not.toHaveBeenCalled();

        act(() => {
            hookResult?.onComposerLayout({ nativeEvent: { layout: { height: 42 } } } as LayoutChangeEvent);
        });

        expect(reportContentInsetMock).not.toHaveBeenCalled();
        expect(hookResult?.contentInsetEndAdjustment.value).toBe(42);

        act(() => {
            hookResult?.onComposerLayout({ nativeEvent: { layout: { height: 64 } } } as LayoutChangeEvent);
        });

        expect(hookResult?.contentInsetEndAdjustment.value).toBe(64);
        expect(reportContentInsetMock).not.toHaveBeenCalled();
    });

    it("keeps matching initial composer padding without reporting it as the full content inset", async () => {
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
        expect(reportContentInsetMock).not.toHaveBeenCalled();
    });
});

describe("useKeyboardScrollToEnd", () => {
    it("waits for keyboard dismissal before targeting the end and releases freeze after rejection", async () => {
        const { KeyboardController } = await import("react-native-keyboard-controller");
        const { useKeyboardScrollToEnd } = await import("../../src/integrations/keyboard?dismiss-before-end");
        let dismiss!: () => void;
        let bottomInset = 300;
        const observedInsets: number[] = [];
        const dismissSpy = spyOn(KeyboardController, "dismiss").mockImplementation(
            () =>
                new Promise<void>((resolve) => {
                    dismiss = () => {
                        if (!freeze.value) bottomInset = 0;
                        resolve();
                    };
                }),
        );
        const scrollToEnd = mock(() => {
            observedInsets.push(bottomInset);
            return Promise.reject(new Error("scroll canceled"));
        });
        const listRef = { current: { getState: () => ({ dataKey: "a" }), scrollToEnd } } as any;
        const freeze = createSharedValue(false);
        let scroll!: ReturnType<typeof useKeyboardScrollToEnd>["scrollMessageToEnd"];
        function Probe() {
            scroll = useKeyboardScrollToEnd({ freeze: freeze as any, listRef }).scrollMessageToEnd;
            return null;
        }
        let renderer!: TestRenderer.ReactTestRenderer;
        try {
            act(() => {
                renderer = TestRenderer.create(<Probe />);
            });
            const request = scroll({ animated: true, closeKeyboard: true });
            expect(freeze.value).toBe(false);
            expect(scrollToEnd).not.toHaveBeenCalled();
            dismiss();
            await expect(request).rejects.toThrow("scroll canceled");
            expect(scrollToEnd).toHaveBeenCalledTimes(1);
            expect(observedInsets).toEqual([0]);
            expect(freeze.value).toBe(false);
        } finally {
            dismissSpy.mockRestore();
            act(() => renderer.unmount());
        }
    });
    for (const returnsToOriginalKey of [false, true]) {
        it(`does not target a replacement dataset after keyboard dismissal (returns to original key: ${returnsToOriginalKey})`, async () => {
            const { KeyboardController } = await import("react-native-keyboard-controller");
            const { useKeyboardScrollToEnd } = await import("../../src/integrations/keyboard?dismiss-dataset-race");
            let dismiss!: () => void;
            const dismissSpy = spyOn(KeyboardController, "dismiss").mockImplementation(
                () =>
                    new Promise<void>((resolve) => {
                        dismiss = resolve;
                    }),
            );
            const scrollToEnd = mock(() => Promise.resolve());
            let dataKey = "a";
            let dataEpoch = 0;
            const listRef = { current: { getState: () => ({ dataEpoch, dataKey }), scrollToEnd } } as any;
            const freeze = createSharedValue(false);
            let scroll!: ReturnType<typeof useKeyboardScrollToEnd>["scrollMessageToEnd"];
            function Probe() {
                scroll = useKeyboardScrollToEnd({ freeze: freeze as any, listRef }).scrollMessageToEnd;
                return null;
            }
            let renderer!: TestRenderer.ReactTestRenderer;
            try {
                act(() => {
                    renderer = TestRenderer.create(<Probe />);
                });
                const request = scroll({ animated: false, closeKeyboard: true });
                expect(freeze.value).toBe(false);
                dataKey = "b";
                dataEpoch++;
                if (returnsToOriginalKey) {
                    dataKey = "a";
                    dataEpoch++;
                }
                dismiss();
                await request;
                expect(scrollToEnd).not.toHaveBeenCalled();
                expect(freeze.value).toBe(false);
            } finally {
                dismissSpy.mockRestore();
                act(() => renderer.unmount());
            }
        });
    }

    for (const race of ["replaced list", "superseded request"] as const) {
        it(`abandons a dismissal scroll after a ${race} during keyboard dismissal`, async () => {
            const { KeyboardController } = await import("react-native-keyboard-controller");
            const { useKeyboardScrollToEnd } = await import("../../src/integrations/keyboard?dismiss-owner-race");
            let dismiss!: () => void;
            const dismissSpy = spyOn(KeyboardController, "dismiss").mockImplementation(
                () =>
                    new Promise<void>((resolve) => {
                        dismiss = resolve;
                    }),
            );
            const createList = () => ({
                getState: () => ({ dataEpoch: 0 }),
                scrollToEnd: mock(() => Promise.resolve()),
            });
            const original = createList();
            const replacement = createList();
            const listRef = { current: original } as any;
            const freeze = createSharedValue(false);
            let scroll!: ReturnType<typeof useKeyboardScrollToEnd>["scrollMessageToEnd"];
            function Probe() {
                scroll = useKeyboardScrollToEnd({ freeze: freeze as any, listRef }).scrollMessageToEnd;
                return null;
            }
            let renderer!: TestRenderer.ReactTestRenderer;
            try {
                act(() => {
                    renderer = TestRenderer.create(<Probe />);
                });
                const request = scroll({ animated: false, closeKeyboard: true });
                if (race === "replaced list") listRef.current = replacement;
                else await scroll({ animated: false, closeKeyboard: false });
                const callsBeforeDismiss = original.scrollToEnd.mock.calls.length;
                dismiss();
                await request;
                expect(original.scrollToEnd).toHaveBeenCalledTimes(callsBeforeDismiss);
                expect(replacement.scrollToEnd).not.toHaveBeenCalled();
                expect(freeze.value).toBe(false);
            } finally {
                dismissSpy.mockRestore();
                act(() => renderer.unmount());
            }
        });
    }

    it("keeps the newer scroll frozen when an older superseded promise settles", async () => {
        const { useKeyboardScrollToEnd } = await import("../../src/integrations/keyboard?freeze-request-owner");
        const completions: Array<() => void> = [];
        const scrollToEnd = mock(
            () =>
                new Promise<void>((resolve) => {
                    completions.push(resolve);
                }),
        );
        const listRef = { current: { getState: () => ({ dataKey: "a" }), scrollToEnd } } as any;
        const freeze = createSharedValue(false);
        let scroll!: ReturnType<typeof useKeyboardScrollToEnd>["scrollMessageToEnd"];
        function Probe() {
            scroll = useKeyboardScrollToEnd({ freeze: freeze as any, listRef }).scrollMessageToEnd;
            return null;
        }
        let renderer!: TestRenderer.ReactTestRenderer;
        act(() => {
            renderer = TestRenderer.create(<Probe />);
        });
        try {
            const old = scroll({ animated: true, closeKeyboard: false });
            const newer = scroll({ animated: true, closeKeyboard: false });
            completions[0]?.();
            await old;
            expect(freeze.value).toBe(true);
            completions[1]?.();
            await newer;
            expect(freeze.value).toBe(false);
        } finally {
            act(() => renderer.unmount());
        }
    });
});
