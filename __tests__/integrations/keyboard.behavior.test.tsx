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
        state: () => ({ height: 0 }),
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

    it("keeps the static contentInset out of the reported inset on android", async () => {
        // The controller reports effective = keyboard padding + the static
        // contentInset prop. iOS applies that whole value; Android applies only
        // the keyboard padding, so the static part must not be inherited twice.
        const { Platform } = await import("react-native");
        const previousOS = (Platform as any).OS;
        (Platform as any).OS = "android";

        try {
            await renderKeyboardAwareLegendList({ contentInset: { bottom: 100, left: 0, right: 0, top: 0 } });

            const scrollElement = lastAnimatedLegendListProps.renderScrollComponent({});
            scrollElement.props.onContentInsetChange({ bottom: 150, left: 0, right: 0, top: 0 });

            expect(reportContentInsetMock).toHaveBeenLastCalledWith({
                bottom: 50,
                left: 0,
                right: 0,
                top: 0,
            });
        } finally {
            (Platform as any).OS = previousOS;
        }
    });

    it("applies the static contentInset on ios without subtracting it", async () => {
        const { Platform } = await import("react-native");
        const previousOS = (Platform as any).OS;
        (Platform as any).OS = "ios";

        try {
            await renderKeyboardAwareLegendList({ contentInset: { bottom: 100, left: 0, right: 0, top: 0 } });

            const scrollElement = lastAnimatedLegendListProps.renderScrollComponent({});
            scrollElement.props.onContentInsetChange({ bottom: 150, left: 0, right: 0, top: 0 });

            expect(reportContentInsetMock).toHaveBeenLastCalledWith({ bottom: 150, left: 0, right: 0, top: 0 });
        } finally {
            (Platform as any).OS = previousOS;
        }
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
    for (const closeKeyboard of [false, true]) {
        it(`scrolls with a scrollToEnd-only adapter (close keyboard: ${closeKeyboard})`, async () => {
            const { useKeyboardScrollToEnd } = await import("../../src/integrations/keyboard?legacy-end-adapter");
            const scrollToEnd = mock(() => Promise.resolve());
            const listRef = { current: { scrollToEnd } };
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
                await scroll({ animated: true, closeKeyboard });
                expect(scrollToEnd).toHaveBeenCalledTimes(1);
                expect(scrollToEnd).toHaveBeenCalledWith({ animated: true });
                expect(freeze.value).toBe(false);
            } finally {
                act(() => renderer.unmount());
            }
        });
    }

    it("starts the scroll immediately and the keyboard close once the UI runtime is frozen", async () => {
        const { KeyboardController } = await import("react-native-keyboard-controller");
        const { useKeyboardScrollToEnd } = await import("../../src/integrations/keyboard?scroll-with-dismiss");
        // JS-thread set() reaches the UI runtime later; worklet writes apply immediately.
        // The mock runs UI jobs inline, so this cannot model derived values updating after the job.
        let uiFreeze = false;
        const freeze = {
            set: (value: boolean) =>
                queueMicrotask(() => {
                    uiFreeze = value;
                }),
            get value() {
                return uiFreeze;
            },
            set value(value: boolean) {
                uiFreeze = value;
            },
        };
        let dismiss!: () => void;
        const order: string[] = [];
        const dismissSpy = spyOn(KeyboardController, "dismiss").mockImplementation(() => {
            order.push(`dismiss freeze=${uiFreeze}`);
            return new Promise<void>((resolve) => {
                dismiss = resolve;
            });
        });
        const scrollToEnd = mock(() => {
            order.push(`scroll freeze=${uiFreeze}`);
            return Promise.reject(new Error("scroll canceled"));
        });
        const listRef = { current: { scrollToEnd } };
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
            await Promise.resolve();
            expect(order).toEqual(["scroll freeze=false", "dismiss freeze=true"]);
            dismiss();
            await expect(request).rejects.toThrow("scroll canceled");
            expect(uiFreeze).toBe(false);
        } finally {
            dismissSpy.mockRestore();
            act(() => renderer.unmount());
        }
    });

    it("releases freeze when the keyboard close never settles", async () => {
        const { KeyboardController } = await import("react-native-keyboard-controller");
        const { useKeyboardScrollToEnd } = await import("../../src/integrations/keyboard?dismiss-never-settles");
        const dismissSpy = spyOn(KeyboardController, "dismiss").mockImplementation(() => new Promise<void>(() => {}));
        const timers: Array<() => void> = [];
        const setTimeoutSpy = spyOn(globalThis, "setTimeout").mockImplementation(((callback: () => void) => {
            timers.push(callback);
            return 0;
        }) as any);
        const scrollToEnd = mock(() => Promise.resolve());
        const listRef = { current: { scrollToEnd } };
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
            await Promise.resolve();
            expect(freeze.value).toBe(true);
            expect(timers).toHaveLength(1);
            timers[0]!();
            await request;
            expect(freeze.value).toBe(false);
        } finally {
            setTimeoutSpy.mockRestore();
            dismissSpy.mockRestore();
            act(() => renderer.unmount());
        }
    });

    it("keeps freeze until an earlier keyboard close settles", async () => {
        const { KeyboardController } = await import("react-native-keyboard-controller");
        const { useKeyboardScrollToEnd } = await import("../../src/integrations/keyboard?freeze-until-closed");
        let dismiss!: () => void;
        const dismissSpy = spyOn(KeyboardController, "dismiss").mockImplementation(
            () =>
                new Promise<void>((resolve) => {
                    dismiss = resolve;
                }),
        );
        const listRef = { current: { scrollToEnd: mock(() => Promise.resolve()) } };
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
            const closing = scroll({ animated: true, closeKeyboard: true });
            const newer = scroll({ animated: false, closeKeyboard: false });
            await Promise.resolve();
            await Promise.resolve();
            expect(freeze.value).toBe(true);
            dismiss();
            await Promise.all([closing, newer]);
            expect(freeze.value).toBe(false);
        } finally {
            dismissSpy.mockRestore();
            act(() => renderer.unmount());
        }
    });

    for (const outcome of ["resolves", "rejects"] as const) {
        it(`dismisses once per close and releases freeze once when dismiss ${outcome}`, async () => {
            const { KeyboardController } = await import("react-native-keyboard-controller");
            const { useKeyboardScrollToEnd } = await import(`../../src/integrations/keyboard?dismiss-once-${outcome}`);
            let settle!: () => void;
            const dismissSpy = spyOn(KeyboardController, "dismiss").mockImplementation(
                () =>
                    new Promise<void>((resolve, reject) => {
                        settle = outcome === "resolves" ? resolve : () => reject(new Error("dismiss failed"));
                    }),
            );
            const timers = new Set<number>();
            const setTimeoutSpy = spyOn(globalThis, "setTimeout").mockImplementation((() => {
                timers.add(timers.size + 1);
                return timers.size;
            }) as any);
            const clearTimeoutSpy = spyOn(globalThis, "clearTimeout").mockImplementation(((id: number) => {
                timers.delete(id);
            }) as any);
            const listRef = { current: { scrollToEnd: mock(() => Promise.resolve()) } };
            let frozen = false;
            let releases = 0;
            const freeze = {
                get value() {
                    return frozen;
                },
                set value(value: boolean) {
                    if (frozen && !value) releases++;
                    frozen = value;
                },
            };
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
                const first = scroll({ animated: true, closeKeyboard: true });
                await Promise.resolve();
                const second = scroll({ animated: true, closeKeyboard: true });
                await Promise.resolve();
                await Promise.resolve();
                expect(dismissSpy).toHaveBeenCalledTimes(1);
                expect(timers.size).toBe(1);
                settle();
                await Promise.all([first, second]);
                expect(freeze.value).toBe(false);
                expect(releases).toBe(1);
                expect(timers.size).toBe(0);
                // The next close dismisses again.
                const third = scroll({ animated: true, closeKeyboard: true });
                await Promise.resolve();
                await Promise.resolve();
                expect(dismissSpy).toHaveBeenCalledTimes(2);
                settle();
                await third;
                expect(releases).toBe(2);
                expect(timers.size).toBe(0);
            } finally {
                clearTimeoutSpy.mockRestore();
                setTimeoutSpy.mockRestore();
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
