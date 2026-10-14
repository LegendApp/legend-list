import { beforeEach, describe, expect, it, mock } from "bun:test";
import "../setup";

import * as React from "react";

import { useCombinedRef } from "../../src/hooks/useCombinedRef";
import { typedForwardRef } from "../../src/types.internal";
import * as reactNativeMock from "../__mocks__/react-native";
import { registerReanimatedModuleMock } from "../__mocks__/reanimated";
import TestRenderer, { act } from "../helpers/testRenderer";

// A shared value with separate JS and UI sides: `set()` from the JS thread reaches the
// UI runtime later (when `flushUI()` runs), while a write inside a worklet lands at once.
const pendingUIWrites: Array<() => void> = [];
const flushUI = () => {
    for (const write of pendingUIWrites.splice(0)) {
        write();
    }
};
const createTwoSidedSharedValue = <T,>(initial: T) => {
    let uiValue = initial;
    return {
        addListener: () => {},
        get: () => uiValue,
        modify: () => uiValue,
        removeListener: () => {},
        set: (next: T) => {
            if (reactNativeMock.Platform.OS === "web") {
                uiValue = next;
                return;
            }
            pendingUIWrites.push(() => {
                uiValue = next;
            });
        },
        get uiValue() {
            return uiValue;
        },
        get value() {
            return uiValue;
        },
        set value(next: T) {
            uiValue = next;
        },
    };
};

const dismissCalls: boolean[] = [];
let freezeUnderTest: ReturnType<typeof createTwoSidedSharedValue<boolean>> | undefined;

mock.module("react-native-keyboard-controller", () => ({
    KeyboardChatScrollView: (props: any) => React.createElement("keyboard-chat-scroll-view", props),
    KeyboardController: {
        dismiss: () => {
            // Record what the UI runtime sees when the keyboard close starts.
            dismissCalls.push(freezeUnderTest?.uiValue ?? false);
            return Promise.resolve();
        },
    },
    useKeyboardHandler: () => {},
}));

mock.module("@legendapp/list/react-native", () => ({
    internal: {
        typedForwardRef,
        useCombinedRef,
    },
}));

mock.module("@legendapp/list/reanimated", () => ({
    AnimatedLegendList: () => null,
}));

beforeEach(() => {
    pendingUIWrites.length = 0;
    dismissCalls.length = 0;
    freezeUnderTest = undefined;
    registerReanimatedModuleMock({
        useSharedValue: (initial: boolean) => {
            freezeUnderTest ??= createTwoSidedSharedValue(initial);
            return freezeUnderTest;
        },
    });
});

type PendingScroll = {
    pending: boolean;
    reject: (error: Error) => void;
    resolve: () => void;
};

// Mirrors LegendList: starting a new imperative scroll settles the previous one.
function createList() {
    const scrolls: PendingScroll[] = [];
    const list = {
        scrollToEnd: () =>
            new Promise<void>((resolve, reject) => {
                for (const scroll of scrolls) {
                    if (scroll.pending) {
                        scroll.resolve();
                    }
                }
                const scroll: PendingScroll = {
                    pending: true,
                    reject: (error) => {
                        scroll.pending = false;
                        reject(error);
                    },
                    resolve: () => {
                        scroll.pending = false;
                        resolve();
                    },
                };
                scrolls.push(scroll);
            }),
    };
    return { list, scrolls };
}

async function renderHook() {
    const { useKeyboardScrollToEnd } = await import("../../src/integrations/keyboard?keyboard-scroll-to-end-test");
    const { list, scrolls } = createList();
    let result: ReturnType<typeof useKeyboardScrollToEnd> | undefined;

    function Probe() {
        const listRef = React.useRef(list as any);
        result = useKeyboardScrollToEnd({ listRef });
        return null;
    }

    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
        renderer = TestRenderer.create(<Probe />);
    });

    return { renderer: renderer!, result: result!, scrolls };
}

const settle = async () => {
    await Promise.resolve();
    await Promise.resolve();
    flushUI();
};

// Holds back long timers (the freeze release timeout) until the test runs them; short
// timers pass through. The shared setup restores the real timers after each test.
function captureLongTimers() {
    const originalSetTimeout = globalThis.setTimeout;
    const originalClearTimeout = globalThis.clearTimeout;
    const pending = new Map<number, { callback: () => void; delay: number }>();
    let nextId = 1;

    globalThis.setTimeout = ((callback: () => void, delay?: number, ...args: unknown[]) => {
        if ((delay ?? 0) < 1000) {
            return originalSetTimeout(callback, delay, ...args);
        }
        const id = -nextId++;
        pending.set(id, { callback, delay: delay ?? 0 });
        return id;
    }) as typeof setTimeout;
    globalThis.clearTimeout = ((id?: ReturnType<typeof setTimeout>) => {
        if (typeof id === "number" && pending.delete(id)) {
            return;
        }
        originalClearTimeout(id);
    }) as typeof clearTimeout;

    return {
        pending,
        runAll: () => {
            for (const [id, timer] of [...pending]) {
                pending.delete(id);
                timer.callback();
            }
        },
    };
}

describe("useKeyboardScrollToEnd", () => {
    it("freezes on the UI runtime before it closes the keyboard", async () => {
        const { result, scrolls } = await renderHook();

        const call = result.scrollMessageToEnd({
            animated: true,
            closeKeyboard: true,
        });

        expect(dismissCalls).toEqual([true]);

        scrolls[0].resolve();
        await call;
        await settle();

        expect(freezeUnderTest!.uiValue).toBe(false);
    });

    it("keeps the freeze until the last overlapping call settles", async () => {
        const { result, scrolls } = await renderHook();

        const first = result.scrollMessageToEnd({
            animated: true,
            closeKeyboard: true,
        });
        // The second call supersedes the first scroll, which settles it.
        const second = result.scrollMessageToEnd({
            animated: true,
            closeKeyboard: true,
        });
        await first;
        await settle();

        expect(scrolls[1].pending).toBe(true);
        expect(freezeUnderTest!.uiValue).toBe(true);

        scrolls[1].resolve();
        await second;
        await settle();

        expect(freezeUnderTest!.uiValue).toBe(false);
    });

    it("releases the freeze when the scroll rejects, and closes the keyboard only once", async () => {
        const { result, scrolls } = await renderHook();

        const call = result.scrollMessageToEnd({
            animated: true,
            closeKeyboard: true,
        });
        const closesBeforeRejection = dismissCalls.length;
        scrolls[0].reject(new Error("scroll failed"));
        await call.catch(() => {});
        await settle();

        expect(freezeUnderTest!.uiValue).toBe(false);
        expect(dismissCalls.length).toBe(closesBeforeRejection);
    });

    it("releases the freeze on unmount and ignores calls after it", async () => {
        const { renderer, result, scrolls } = await renderHook();

        const call = result.scrollMessageToEnd({
            animated: true,
            closeKeyboard: true,
        });
        const closesBeforeUnmount = dismissCalls.length;
        act(() => {
            renderer.unmount();
        });
        await settle();

        expect(freezeUnderTest!.uiValue).toBe(false);

        scrolls[0].resolve();
        await call;
        void result.scrollMessageToEnd({ animated: true, closeKeyboard: true });
        await settle();

        expect(freezeUnderTest!.uiValue).toBe(false);
        expect(dismissCalls.length).toBe(closesBeforeUnmount);
        expect(scrolls.length).toBe(1);
    });

    it("keeps a newer effect lifetime's freeze when an older call settles after an effect replay", async () => {
        const { useKeyboardScrollToEnd } = await import(
            "../../src/integrations/keyboard?keyboard-scroll-to-end-replay"
        );
        const { list, scrolls } = createList();
        const calls: Promise<void>[] = [];

        function Probe() {
            const listRef = React.useRef(list as any);
            const { scrollMessageToEnd } = useKeyboardScrollToEnd({ listRef });
            React.useLayoutEffect(() => {
                calls.push(scrollMessageToEnd({ animated: true, closeKeyboard: false }));
            }, [scrollMessageToEnd]);
            return null;
        }

        act(() => {
            TestRenderer.create(
                <React.StrictMode>
                    <Probe />
                </React.StrictMode>,
                { unstable_isConcurrent: true },
            );
        });

        // StrictMode replayed the effects; the first call belongs to the retired lifetime.
        expect(calls.length).toBe(2);

        await calls[0];
        await settle();

        expect(scrolls[1].pending).toBe(true);
        expect(freezeUnderTest!.uiValue).toBe(true);

        scrolls[1].resolve();
        await calls[1];
        await settle();

        expect(freezeUnderTest!.uiValue).toBe(false);
    });

    it("releases a replaced freeze prop and leaves the new one to its own calls", async () => {
        const { useKeyboardScrollToEnd } = await import(
            "../../src/integrations/keyboard?keyboard-scroll-to-end-replace"
        );
        const { list, scrolls } = createList();
        const first = createTwoSidedSharedValue(false);
        const second = createTwoSidedSharedValue(false);
        let result: ReturnType<typeof useKeyboardScrollToEnd> | undefined;

        function Probe({ freeze }: { freeze: typeof first }) {
            const listRef = React.useRef(list as any);
            result = useKeyboardScrollToEnd({ freeze: freeze as any, listRef });
            return null;
        }

        let renderer: TestRenderer.ReactTestRenderer;
        act(() => {
            renderer = TestRenderer.create(<Probe freeze={first} />);
        });
        const callA = result!.scrollMessageToEnd({ animated: true, closeKeyboard: false });

        act(() => {
            renderer.update(<Probe freeze={second} />);
        });
        const callB = result!.scrollMessageToEnd({ animated: true, closeKeyboard: false });
        await callA;
        await settle();

        expect(first.uiValue).toBe(false);
        expect(second.uiValue).toBe(true);

        scrolls[1].resolve();
        await callB;
        await settle();

        expect(second.uiValue).toBe(false);
    });

    it("releases the freeze after a timeout when the scroll never settles, and ignores the late settlement", async () => {
        const timers = captureLongTimers();
        const { result, scrolls } = await renderHook();

        const stalled = result.scrollMessageToEnd({
            animated: true,
            closeKeyboard: true,
        });
        await settle();

        expect(freezeUnderTest!.uiValue).toBe(true);
        const delays = [...timers.pending.values()].map((timer) => timer.delay);

        timers.runAll();
        await settle();

        expect(freezeUnderTest!.uiValue).toBe(false);
        expect(delays).toEqual([2000]);

        // A newer call supersedes the stalled scroll, which settles it late. That must
        // neither release the newer call's freeze nor release twice.
        const next = result.scrollMessageToEnd({
            animated: true,
            closeKeyboard: true,
        });
        await stalled;
        await settle();

        expect(scrolls[0].pending).toBe(false);
        expect(freezeUnderTest!.uiValue).toBe(true);

        scrolls[1].resolve();
        await next;
        await settle();

        expect(freezeUnderTest!.uiValue).toBe(false);
        expect(timers.pending.size).toBe(0);
    });

    it("clears the release timeout when a call settles and when the owner retires", async () => {
        const timers = captureLongTimers();
        const { renderer, result, scrolls } = await renderHook();

        const settled = result.scrollMessageToEnd({ animated: true, closeKeyboard: false });
        scrolls[0].resolve();
        await settled;
        await settle();

        expect(timers.pending.size).toBe(0);

        void result.scrollMessageToEnd({ animated: true, closeKeyboard: false });
        expect(timers.pending.size).toBe(1);
        act(() => {
            renderer.unmount();
        });

        expect(timers.pending.size).toBe(0);
        expect(freezeUnderTest!.uiValue).toBe(false);
    });

    it("never closes the keyboard when closeKeyboard is false", async () => {
        const { result, scrolls } = await renderHook();

        const call = result.scrollMessageToEnd({
            animated: true,
            closeKeyboard: false,
        });
        scrolls[0].resolve();
        await call;
        await settle();

        expect(dismissCalls).toEqual([]);
        expect(freezeUnderTest!.uiValue).toBe(false);
    });

    it("sets the freeze with a plain shared-value write on web", async () => {
        reactNativeMock.Platform.OS = "web";
        const { result, scrolls } = await renderHook();

        const call = result.scrollMessageToEnd({
            animated: true,
            closeKeyboard: true,
        });

        expect(dismissCalls).toEqual([true]);

        scrolls[0].resolve();
        await call;
        await settle();

        expect(freezeUnderTest!.uiValue).toBe(false);
    });
});
