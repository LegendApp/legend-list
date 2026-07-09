import { describe, expect, it } from "bun:test";
import "../setup";

import { memo, type ReactNode, useMemo } from "react";
import { Text } from "react-native";

import {
    ContextContainer,
    type ContextContainerType,
    useAdaptiveRender,
    useAdaptiveRenderChange,
    useIsLastItem,
    useListScrollSize,
    useRecyclingEffect,
    useRecyclingState,
    useSyncLayout,
    useViewability,
    useViewabilityAmount,
} from "../../src/state/ContextContainer";
import { StateProvider, set$, useArr$, useStateContext } from "../../src/state/state";
import type { ViewAmountToken, ViewToken } from "../../src/types.base";
import { act, render } from "../helpers/testingLibrary";

type ContainerSignals = {
    containerId: number;
    index: number;
    itemKey: string;
    triggerLayout: () => void;
    value: any;
};

const noopTriggerLayout = () => {};

function createContainerSignals(overrides?: Partial<ContainerSignals>): ContainerSignals {
    return {
        containerId: 0,
        index: 0,
        itemKey: "item-0",
        triggerLayout: noopTriggerLayout,
        value: { id: 0, text: "Item 0" },
        ...overrides,
    };
}

function SignalBackedContainerProvider({ children, signals }: { children: ReactNode; signals: ContainerSignals }) {
    const ctx = useStateContext();
    const { containerId, index, itemKey, value } = signals;
    const providerValue = useMemo<ContextContainerType>(
        () => ({
            containerId,
            triggerLayout: signals.triggerLayout,
        }),
        [containerId, signals.triggerLayout],
    );

    ctx.values.set(`containerItemKey${containerId}`, itemKey);
    ctx.values.set(`containerItemData${containerId}`, value);
    ctx.values.set(`containerItemInfo${containerId}`, {
        index,
        itemKey,
        value,
    });

    return <ContextContainer.Provider value={providerValue}>{children}</ContextContainer.Provider>;
}

async function flushAsync() {
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
}

describe("ContextContainer hooks", () => {
    describe("useArr$", () => {
        it("should keep inline signal arrays stable when signal names do not change", async () => {
            let capturedCtx: ReturnType<typeof useStateContext> | undefined;
            let renders = 0;

            const TestComponent = ({ label }: { label: string }) => {
                const ctx = useStateContext();
                const [mode] = useArr$(["adaptiveRender"]);
                capturedCtx = ctx;
                renders++;
                return <Text>{`${label}:${mode}`}</Text>;
            };

            const screen = render(
                <StateProvider>
                    <TestComponent label="first" />
                </StateProvider>,
            );
            await flushAsync();

            const listeners = capturedCtx!.listeners.get("adaptiveRender");
            const listener = listeners ? [...listeners][0] : undefined;
            expect(listener).toBeDefined();

            screen.rerender(
                <StateProvider>
                    <TestComponent label="second" />
                </StateProvider>,
            );
            await flushAsync();

            expect(renders).toBe(2);
            expect(capturedCtx!.listeners.get("adaptiveRender")?.size).toBe(1);
            expect([...(capturedCtx!.listeners.get("adaptiveRender") ?? [])][0]).toBe(listener);
        });

        it("should resubscribe inline signal arrays when signal names change", async () => {
            let capturedCtx: ReturnType<typeof useStateContext> | undefined;

            const TestComponent = ({ id }: { id: number }) => {
                const ctx = useStateContext();
                const [itemKey] = useArr$([`containerItemKey${id}`]);
                capturedCtx = ctx;
                return <Text>{itemKey}</Text>;
            };

            const screen = render(
                <StateProvider>
                    <TestComponent id={0} />
                </StateProvider>,
            );
            await flushAsync();

            expect(capturedCtx!.listeners.get("containerItemKey0")?.size).toBe(1);

            screen.rerender(
                <StateProvider>
                    <TestComponent id={1} />
                </StateProvider>,
            );
            await flushAsync();

            expect(capturedCtx!.listeners.get("containerItemKey0")?.size).toBe(0);
            expect(capturedCtx!.listeners.get("containerItemKey1")?.size).toBe(1);
        });
    });

    describe("useAdaptiveRender", () => {
        it("should re-render when the adaptive render changes", async () => {
            let capturedCtx: ReturnType<typeof useStateContext> | undefined;
            let renders = 0;
            const modes: string[] = [];

            const TestComponent = () => {
                const ctx = useStateContext();
                const mode = useAdaptiveRender();
                capturedCtx = ctx;
                renders++;
                modes.push(mode);
                return <Text>{mode}</Text>;
            };

            render(
                <StateProvider>
                    <TestComponent />
                </StateProvider>,
            );

            await act(async () => {
                set$(capturedCtx!, "adaptiveRender", "light");
            });

            expect(renders).toBe(2);
            expect(modes).toEqual(["normal", "light"]);
        });
    });

    describe("useAdaptiveRenderChange", () => {
        it("should call onChange without forcing a component re-render", async () => {
            let capturedCtx: ReturnType<typeof useStateContext> | undefined;
            let renders = 0;
            const modes: string[] = [];

            const TestComponent = () => {
                const ctx = useStateContext();
                capturedCtx = ctx;
                renders++;
                useAdaptiveRenderChange((mode) => modes.push(mode));
                return <Text>Test</Text>;
            };

            render(
                <StateProvider>
                    <TestComponent />
                </StateProvider>,
            );

            await flushAsync();
            await act(async () => {
                set$(capturedCtx!, "adaptiveRender", "light");
            });

            expect(renders).toBe(1);
            expect(modes).toEqual(["light"]);
        });
    });

    describe("useViewability", () => {
        it("should register callback when used inside context", async () => {
            const callback = (token: ViewToken) => {
                expect(token).toBeDefined();
            };

            const signals = createContainerSignals();
            let capturedCtx: any;

            const TestComponent = () => {
                const ctx = useStateContext();
                capturedCtx = ctx;
                useViewability(callback);
                return <Text>Test</Text>;
            };

            const { unmount } = render(
                <StateProvider>
                    <SignalBackedContainerProvider signals={signals}>
                        <TestComponent />
                    </SignalBackedContainerProvider>
                </StateProvider>,
            );

            await flushAsync();

            // Verify callback was registered
            const key = `${signals.containerId}`;
            expect(capturedCtx.mapViewabilityCallbacks.has(key)).toBe(true);
            expect(capturedCtx.mapViewabilityCallbacks.get(key)).toBe(callback);

            unmount();
        });

        it("should fail gracefully when used outside context", () => {
            const callback = () => {
                throw new Error("Should not be called");
            };

            const TestComponent = () => {
                useViewability(callback);
                return <Text>Test</Text>;
            };

            // Should not throw
            expect(() => {
                const { unmount } = render(
                    <StateProvider>
                        <TestComponent />
                    </StateProvider>,
                );
                unmount();
            }).not.toThrow();
        });

        it("should handle configId parameter", async () => {
            const callback = () => {};
            const configId = "custom-config";
            const signals = createContainerSignals();
            let capturedCtx: any;

            const TestComponent = () => {
                const ctx = useStateContext();
                capturedCtx = ctx;
                useViewability(callback, configId);
                return <Text>Test</Text>;
            };

            const { unmount } = render(
                <StateProvider>
                    <SignalBackedContainerProvider signals={signals}>
                        <TestComponent />
                    </SignalBackedContainerProvider>
                </StateProvider>,
            );

            await flushAsync();

            const key = signals.containerId + configId;
            expect(capturedCtx.mapViewabilityCallbacks.has(key)).toBe(true);

            unmount();
        });

        it("should call callback with initial value if available", async () => {
            const signals = createContainerSignals();
            const mockToken: ViewToken = {
                index: 0,
                isViewable: true,
                item: { id: 0, text: "Item 0" },
                key: "item-0",
            };
            let callbackCalled = false;
            let receivedToken: ViewToken | undefined;

            const callback = (token: ViewToken) => {
                callbackCalled = true;
                receivedToken = token;
            };

            let _capturedCtx: any;

            const TestComponent = () => {
                const ctx = useStateContext();
                _capturedCtx = ctx;
                // Set initial value before hook runs
                ctx.mapViewabilityValues.set(`${signals.containerId}`, mockToken);
                useViewability(callback);
                return <Text>Test</Text>;
            };

            const { unmount } = render(
                <StateProvider>
                    <SignalBackedContainerProvider signals={signals}>
                        <TestComponent />
                    </SignalBackedContainerProvider>
                </StateProvider>,
            );

            await flushAsync();

            // Callback should be called with initial value
            expect(callbackCalled).toBe(true);
            expect(receivedToken).toEqual(mockToken);

            unmount();
        });
    });

    describe("useViewabilityAmount", () => {
        it("should register callback when used inside context", async () => {
            const callback = (token: ViewAmountToken) => {
                expect(token).toBeDefined();
            };

            const signals = createContainerSignals();
            let capturedCtx: any;

            const TestComponent = () => {
                const ctx = useStateContext();
                capturedCtx = ctx;
                useViewabilityAmount(callback);
                return <Text>Test</Text>;
            };

            const { unmount } = render(
                <StateProvider>
                    <SignalBackedContainerProvider signals={signals}>
                        <TestComponent />
                    </SignalBackedContainerProvider>
                </StateProvider>,
            );

            await flushAsync();

            // Verify callback was registered
            expect(capturedCtx.mapViewabilityAmountCallbacks.has(signals.containerId)).toBe(true);
            expect(capturedCtx.mapViewabilityAmountCallbacks.get(signals.containerId)).toBe(callback);

            unmount();
        });

        it("should fail gracefully when used outside context", () => {
            const callback = () => {
                throw new Error("Should not be called");
            };

            const TestComponent = () => {
                useViewabilityAmount(callback);
                return <Text>Test</Text>;
            };

            // Should not throw
            expect(() => {
                const { unmount } = render(
                    <StateProvider>
                        <TestComponent />
                    </StateProvider>,
                );
                unmount();
            }).not.toThrow();
        });

        it("should call callback with initial value if available", async () => {
            const signals = createContainerSignals();
            const mockToken: ViewAmountToken = {
                containerId: 0,
                index: 0,
                isViewable: true,
                item: { id: 0, text: "Item 0" },
                key: "item-0",
                percentOfScroller: 50,
                percentVisible: 100,
                scrollSize: 1000,
                size: 100,
                sizeVisible: 100,
            };
            let callbackCalled = false;
            let receivedToken: ViewAmountToken | undefined;

            const callback = (token: ViewAmountToken) => {
                callbackCalled = true;
                receivedToken = token;
            };

            let _capturedCtx: any;

            const TestComponent = () => {
                const ctx = useStateContext();
                _capturedCtx = ctx;
                // Set initial value before hook runs
                ctx.mapViewabilityAmountValues.set(signals.containerId, mockToken);
                useViewabilityAmount(callback);
                return <Text>Test</Text>;
            };

            const { unmount } = render(
                <StateProvider>
                    <SignalBackedContainerProvider signals={signals}>
                        <TestComponent />
                    </SignalBackedContainerProvider>
                </StateProvider>,
            );

            await flushAsync();

            // Callback should be called with initial value
            expect(callbackCalled).toBe(true);
            expect(receivedToken).toEqual(mockToken);

            unmount();
        });
    });

    describe("useRecyclingEffect", () => {
        it("should work when used inside context", async () => {
            const effectCalls: any[] = [];

            const effect = (info: any) => {
                effectCalls.push(info);
            };

            const signals = createContainerSignals({
                index: 0,
                itemKey: "item-0",
                value: { id: 0, text: "Item 0" },
            });

            const TestComponent = () => {
                useRecyclingEffect(effect);
                return <Text>Test</Text>;
            };

            const { unmount } = render(
                <StateProvider>
                    <SignalBackedContainerProvider signals={signals}>
                        <TestComponent />
                    </SignalBackedContainerProvider>
                </StateProvider>,
            );

            await flushAsync();

            // First render - no effect should run (no previous value)
            expect(effectCalls).toHaveLength(0);

            unmount();
        });

        it("should run from container signal changes without changing context value", async () => {
            const signals = createContainerSignals();
            const effectCalls: any[] = [];
            let capturedCtx: ReturnType<typeof useStateContext> | undefined;
            let syncLayoutRenders = 0;

            const SyncLayoutConsumer = memo(() => {
                syncLayoutRenders++;
                useSyncLayout();
                return <Text>Sync layout</Text>;
            });

            const TestComponent = () => {
                const ctx = useStateContext();
                capturedCtx = ctx;
                useRecyclingEffect((info) => {
                    effectCalls.push(info);
                });
                return <Text>Test</Text>;
            };

            const StableProvider = () => {
                const ctx = useStateContext();
                const providerValue = useMemo<ContextContainerType>(
                    () => ({
                        containerId: signals.containerId,
                        triggerLayout: signals.triggerLayout,
                    }),
                    [],
                );

                ctx.values.set(`containerItemKey${signals.containerId}`, signals.itemKey);
                ctx.values.set(`containerItemData${signals.containerId}`, signals.value);
                ctx.values.set(`containerItemInfo${signals.containerId}`, {
                    index: signals.index,
                    itemKey: signals.itemKey,
                    value: signals.value,
                });

                return (
                    <ContextContainer.Provider value={providerValue}>
                        <SyncLayoutConsumer />
                        <TestComponent />
                    </ContextContainer.Provider>
                );
            };

            const { unmount } = render(
                <StateProvider>
                    <StableProvider />
                </StateProvider>,
            );

            await flushAsync();

            expect(effectCalls).toEqual([]);
            expect(syncLayoutRenders).toBe(1);

            await act(async () => {
                set$(capturedCtx!, `containerItemKey${signals.containerId}`, "item-1");
                set$(capturedCtx!, `containerItemData${signals.containerId}`, { id: 1, text: "Item 1" });
                set$(capturedCtx!, `containerItemInfo${signals.containerId}`, {
                    index: 1,
                    itemKey: "item-1",
                    value: { id: 1, text: "Item 1" },
                });
            });
            await flushAsync();

            expect(effectCalls).toEqual([
                {
                    index: 1,
                    item: { id: 1, text: "Item 1" },
                    prevIndex: 0,
                    prevItem: { id: 0, text: "Item 0" },
                },
            ]);
            expect(syncLayoutRenders).toBe(1);

            unmount();
        });

        it("should fail gracefully when used outside context", () => {
            const effect = () => {
                throw new Error("Should not be called");
            };

            const TestComponent = () => {
                useRecyclingEffect(effect);
                return <Text>Test</Text>;
            };

            // Should not throw
            expect(() => {
                const { unmount } = render(
                    <StateProvider>
                        <TestComponent />
                    </StateProvider>,
                );
                unmount();
            }).not.toThrow();
        });
    });

    describe("useRecyclingState", () => {
        it("should initialize state with value when used inside context", () => {
            const signals = createContainerSignals({
                index: 0,
                itemKey: "item-0",
                value: { id: 0, text: "Item 0" },
            });

            let capturedState: any;

            const TestComponent = () => {
                const [state] = useRecyclingState("initial");
                capturedState = state;
                return <Text>{String(state)}</Text>;
            };

            const { unmount } = render(
                <StateProvider>
                    <SignalBackedContainerProvider signals={signals}>
                        <TestComponent />
                    </SignalBackedContainerProvider>
                </StateProvider>,
            );

            expect(capturedState).toBe("initial");

            unmount();
        });

        it("should initialize state with function when used inside context", () => {
            const signals = createContainerSignals({
                index: 0,
                itemKey: "item-0",
                value: { id: 0, text: "Item 0" },
            });

            let capturedState: any;

            const TestComponent = () => {
                const [state] = useRecyclingState((info) => `computed-${info.index}`);
                capturedState = state;
                return <Text>{String(state)}</Text>;
            };

            const { unmount } = render(
                <StateProvider>
                    <SignalBackedContainerProvider signals={signals}>
                        <TestComponent />
                    </SignalBackedContainerProvider>
                </StateProvider>,
            );

            expect(capturedState).toBe("computed-0");

            unmount();
        });

        it("should update state when setState is called inside context", () => {
            const signals = createContainerSignals({
                index: 0,
                itemKey: "item-0",
                value: { id: 0, text: "Item 0" },
            });

            let capturedState: any;
            let setStateFn: any;
            let triggerLayoutCalled = false;

            signals.triggerLayout = () => {
                triggerLayoutCalled = true;
            };

            const TestComponent = () => {
                const [state, setState] = useRecyclingState("initial");
                capturedState = state;
                setStateFn = setState;
                return <Text>{String(state)}</Text>;
            };

            const { unmount } = render(
                <StateProvider>
                    <SignalBackedContainerProvider signals={signals}>
                        <TestComponent />
                    </SignalBackedContainerProvider>
                </StateProvider>,
            );

            expect(capturedState).toBe("initial");

            act(() => {
                setStateFn("updated");
            });

            // State should be updated
            expect(capturedState).toBe("updated");
            // triggerLayout should be called
            expect(triggerLayoutCalled).toBe(true);

            unmount();
        });

        it("should reset state when itemKey changes", () => {
            const signals1 = createContainerSignals({
                index: 0,
                itemKey: "item-0",
                value: { id: 0, text: "Item 0" },
            });

            let capturedState: any;
            let setStateFn: any;

            const TestComponent = () => {
                const [state, setState] = useRecyclingState("initial");
                capturedState = state;
                setStateFn = setState;
                return <Text>{String(state)}</Text>;
            };

            const { rerender, unmount } = render(
                <StateProvider>
                    <SignalBackedContainerProvider signals={signals1}>
                        <TestComponent />
                    </SignalBackedContainerProvider>
                </StateProvider>,
            );

            // Update state
            act(() => {
                setStateFn("updated");
            });
            expect(capturedState).toBe("updated");

            // Change itemKey
            const signals2 = createContainerSignals({
                index: 1,
                itemKey: "item-1",
                value: { id: 1, text: "Item 1" },
            });

            act(() => {
                rerender(
                    <StateProvider>
                        <SignalBackedContainerProvider signals={signals2}>
                            <TestComponent />
                        </SignalBackedContainerProvider>
                    </StateProvider>,
                );
            });

            // State should reset to initial value
            expect(capturedState).toBe("initial");

            unmount();
        });

        it("should reset state from container signals without changing context value", () => {
            const signals = createContainerSignals();
            let capturedCtx: ReturnType<typeof useStateContext> | undefined;
            let capturedState: any;
            let setStateFn: any;
            let recyclingRenders = 0;
            let syncLayoutRenders = 0;

            const SyncLayoutConsumer = memo(() => {
                syncLayoutRenders++;
                useSyncLayout();
                return <Text>Sync layout</Text>;
            });

            const RecyclingStateConsumer = () => {
                recyclingRenders++;
                const [state, setState] = useRecyclingState((info) => `computed-${info.index}-${info.item.id}`);
                capturedState = state;
                setStateFn = setState;
                return <Text>{String(state)}</Text>;
            };

            const StableProvider = () => {
                const ctx = useStateContext();
                capturedCtx = ctx;
                const providerValue = useMemo<ContextContainerType>(
                    () => ({
                        containerId: signals.containerId,
                        triggerLayout: signals.triggerLayout,
                    }),
                    [],
                );

                ctx.values.set(`containerItemKey${signals.containerId}`, signals.itemKey);
                ctx.values.set(`containerItemData${signals.containerId}`, signals.value);
                ctx.values.set(`containerItemInfo${signals.containerId}`, {
                    index: signals.index,
                    itemKey: signals.itemKey,
                    value: signals.value,
                });

                return (
                    <ContextContainer.Provider value={providerValue}>
                        <SyncLayoutConsumer />
                        <RecyclingStateConsumer />
                    </ContextContainer.Provider>
                );
            };

            const { unmount } = render(
                <StateProvider>
                    <StableProvider />
                </StateProvider>,
            );

            expect(capturedState).toBe("computed-0-0");
            expect(recyclingRenders).toBe(1);
            expect(syncLayoutRenders).toBe(1);

            act(() => {
                setStateFn("updated");
            });

            expect(capturedState).toBe("updated");

            act(() => {
                set$(capturedCtx!, `containerItemKey${signals.containerId}`, "item-1");
                set$(capturedCtx!, `containerItemData${signals.containerId}`, { id: 1, text: "Item 1" });
                set$(capturedCtx!, `containerItemInfo${signals.containerId}`, {
                    index: 1,
                    itemKey: "item-1",
                    value: { id: 1, text: "Item 1" },
                });
            });

            expect(capturedState).toBe("computed-1-1");
            expect(recyclingRenders).toBeGreaterThan(1);
            expect(syncLayoutRenders).toBe(1);

            unmount();
        });

        it("should not reset state when index and data change for the same itemKey", () => {
            const signals = createContainerSignals();
            let capturedCtx: ReturnType<typeof useStateContext> | undefined;
            let capturedState: any;
            let setStateFn: any;

            const TestComponent = () => {
                const ctx = useStateContext();
                capturedCtx = ctx;
                const [state, setState] = useRecyclingState((info) => `computed-${info.index}-${info.item.id}`);
                capturedState = state;
                setStateFn = setState;
                return <Text>{String(state)}</Text>;
            };

            const { unmount } = render(
                <StateProvider>
                    <SignalBackedContainerProvider signals={signals}>
                        <TestComponent />
                    </SignalBackedContainerProvider>
                </StateProvider>,
            );

            expect(capturedState).toBe("computed-0-0");

            act(() => {
                setStateFn("updated");
            });

            expect(capturedState).toBe("updated");

            act(() => {
                set$(capturedCtx!, `containerItemData${signals.containerId}`, { id: 1, text: "Item 1" });
                set$(capturedCtx!, `containerItemInfo${signals.containerId}`, {
                    index: 1,
                    itemKey: signals.itemKey,
                    value: { id: 1, text: "Item 1" },
                });
            });

            expect(capturedState).toBe("updated");

            unmount();
        });

        it("should fail gracefully when used outside context", () => {
            let capturedState: any;
            let setStateFn: any;

            const TestComponent = () => {
                const [state, setState] = useRecyclingState("initial");
                capturedState = state;
                setStateFn = setState;
                return <Text>{String(state)}</Text>;
            };

            const { unmount } = render(
                <StateProvider>
                    <TestComponent />
                </StateProvider>,
            );

            // Should return initial value
            expect(capturedState).toBe("initial");

            // setState should be a no-op
            act(() => {
                setStateFn("updated");
            });

            // State should remain unchanged (no-op)
            expect(capturedState).toBe("initial");

            unmount();
        });

        it("should handle function initializer when used outside context", () => {
            let capturedState: any;

            const TestComponent = () => {
                const [state] = useRecyclingState(() => "computed");
                capturedState = state;
                return <Text>{String(state)}</Text>;
            };

            const { unmount } = render(
                <StateProvider>
                    <TestComponent />
                </StateProvider>,
            );

            // Should compute initial value
            expect(capturedState).toBe("computed");

            unmount();
        });

        it("should not subscribe outside context to real container item signals", () => {
            let capturedCtx: ReturnType<typeof useStateContext> | undefined;
            let renders = 0;

            const TestComponent = () => {
                const ctx = useStateContext();
                capturedCtx = ctx;
                renders++;
                const [state] = useRecyclingState(() => "outside");
                const isLast = useIsLastItem();
                return <Text>{`${state}-${isLast}`}</Text>;
            };

            const { unmount } = render(
                <StateProvider>
                    <TestComponent />
                </StateProvider>,
            );

            expect(renders).toBe(1);

            act(() => {
                set$(capturedCtx!, "containerItemKey0", "item-1");
                set$(capturedCtx!, "containerItemData0", { id: 1, text: "Item 1" });
                set$(capturedCtx!, "containerItemInfo0", {
                    index: 1,
                    itemKey: "item-1",
                    value: { id: 1, text: "Item 1" },
                });
            });

            expect(renders).toBe(1);

            unmount();
        });
    });

    describe("useIsLastItem", () => {
        it("should return true when item is last inside context", async () => {
            const signals = createContainerSignals({
                itemKey: "item-2",
            });

            let _capturedCtx: any;
            let capturedIsLast: boolean;

            const TestComponent = () => {
                const ctx = useStateContext();
                _capturedCtx = ctx;
                // Set lastItemKeys before hook runs
                ctx.values.set("lastItemKeys", ["item-2"]);
                const isLast = useIsLastItem();
                capturedIsLast = isLast;
                return <Text>{String(isLast)}</Text>;
            };

            const { unmount } = render(
                <StateProvider>
                    <SignalBackedContainerProvider signals={signals}>
                        <TestComponent />
                    </SignalBackedContainerProvider>
                </StateProvider>,
            );

            await flushAsync();

            expect(capturedIsLast).toBe(true);

            unmount();
        });

        it("should return false when item is not last inside context", async () => {
            const signals = createContainerSignals({
                itemKey: "item-0",
            });

            let _capturedCtx: any;
            let capturedIsLast: boolean;

            const TestComponent = () => {
                const ctx = useStateContext();
                _capturedCtx = ctx;
                // Set lastItemKeys before hook runs
                ctx.values.set("lastItemKeys", ["item-2"]);
                const isLast = useIsLastItem();
                capturedIsLast = isLast;
                return <Text>{String(isLast)}</Text>;
            };

            const { unmount } = render(
                <StateProvider>
                    <SignalBackedContainerProvider signals={signals}>
                        <TestComponent />
                    </SignalBackedContainerProvider>
                </StateProvider>,
            );

            await flushAsync();

            expect(capturedIsLast).toBe(false);

            unmount();
        });

        it("should update only for itemKey and lastItemKeys changes", () => {
            const signals = createContainerSignals({
                itemKey: "item-0",
            });
            let capturedCtx: ReturnType<typeof useStateContext> | undefined;
            let capturedIsLast: boolean | undefined;
            let renders = 0;

            const LastItemKeysProvider = ({ children }: { children: ReactNode }) => {
                const ctx = useStateContext();
                capturedCtx = ctx;
                ctx.values.set("lastItemKeys", ["item-2"]);
                return children;
            };

            const TestComponent = () => {
                renders++;
                capturedIsLast = useIsLastItem();
                return <Text>{String(capturedIsLast)}</Text>;
            };

            const { unmount } = render(
                <StateProvider>
                    <LastItemKeysProvider>
                        <SignalBackedContainerProvider signals={signals}>
                            <TestComponent />
                        </SignalBackedContainerProvider>
                    </LastItemKeysProvider>
                </StateProvider>,
            );

            expect(capturedIsLast).toBe(false);
            expect(renders).toBe(1);

            act(() => {
                set$(capturedCtx!, `containerItemData${signals.containerId}`, { id: 1, text: "Item 1" });
                set$(capturedCtx!, `containerItemInfo${signals.containerId}`, {
                    index: 1,
                    itemKey: signals.itemKey,
                    value: { id: 1, text: "Item 1" },
                });
            });

            expect(capturedIsLast).toBe(false);
            expect(renders).toBe(1);

            act(() => {
                set$(capturedCtx!, `containerItemKey${signals.containerId}`, "item-2");
            });

            expect(capturedIsLast).toBe(true);
            expect(renders).toBe(2);

            act(() => {
                set$(capturedCtx!, "lastItemKeys", ["item-3"]);
            });

            expect(capturedIsLast).toBe(false);
            expect(renders).toBe(3);

            unmount();
        });

        it("should fail gracefully when used outside context", () => {
            let capturedIsLast: boolean;

            const TestComponent = () => {
                const isLast = useIsLastItem();
                capturedIsLast = isLast;
                return <Text>{String(isLast)}</Text>;
            };

            const { unmount } = render(
                <StateProvider>
                    <TestComponent />
                </StateProvider>,
            );

            // Should return false when outside context
            expect(capturedIsLast).toBe(false);

            unmount();
        });
    });

    describe("useListScrollSize", () => {
        it("should return scroll size when used inside LegendList", async () => {
            let capturedSize: any;

            const TestComponent = () => {
                const ctx = useStateContext();
                // Set scrollSize before hook runs
                ctx.values.set("scrollSize", { height: 800, width: 400 });
                const size = useListScrollSize();
                capturedSize = size;
                return <Text>{String(size.width)}</Text>;
            };

            const { unmount } = render(
                <StateProvider>
                    <TestComponent />
                </StateProvider>,
            );

            await flushAsync();

            expect(capturedSize).toEqual({ height: 800, width: 400 });

            unmount();
        });

        it("should work when used outside LegendList (no context dependency)", async () => {
            // This hook doesn't depend on ContextContainer, so it should work fine
            let capturedSize: any;

            const TestComponent = () => {
                const ctx = useStateContext();
                // Set scrollSize before hook runs
                ctx.values.set("scrollSize", { height: 600, width: 300 });
                const size = useListScrollSize();
                capturedSize = size;
                return <Text>{String(size.width)}</Text>;
            };

            const { unmount } = render(
                <StateProvider>
                    <TestComponent />
                </StateProvider>,
            );

            await flushAsync();

            expect(capturedSize).toEqual({ height: 600, width: 300 });

            unmount();
        });
    });

    describe("useSyncLayout", () => {
        it("should return triggerLayout function when used inside context (new architecture)", async () => {
            // IsNewArchitecture is set to true in setup.ts via global.nativeFabricUIManager
            let triggerLayoutCalled = false;
            const signals = createContainerSignals({
                triggerLayout: () => {
                    triggerLayoutCalled = true;
                },
            });

            let capturedSyncLayout: any;

            const TestComponent = () => {
                const syncLayout = useSyncLayout();
                capturedSyncLayout = syncLayout;
                return <Text>Test</Text>;
            };

            const { unmount } = render(
                <StateProvider>
                    <SignalBackedContainerProvider signals={signals}>
                        <TestComponent />
                    </SignalBackedContainerProvider>
                </StateProvider>,
            );

            await flushAsync();

            expect(capturedSyncLayout).toBe(signals.triggerLayout);

            // Call it
            act(() => {
                capturedSyncLayout();
            });

            expect(triggerLayoutCalled).toBe(true);

            unmount();
        });

        it("should return noop when used outside context (new architecture)", async () => {
            // IsNewArchitecture is set to true in setup.ts
            let capturedSyncLayout: any;

            const TestComponent = () => {
                const syncLayout = useSyncLayout();
                capturedSyncLayout = syncLayout;
                return <Text>Test</Text>;
            };

            const { unmount } = render(
                <StateProvider>
                    <TestComponent />
                </StateProvider>,
            );

            await flushAsync();

            // Should return noop function
            expect(typeof capturedSyncLayout).toBe("function");

            // Calling it should not throw
            act(() => {
                capturedSyncLayout();
            });

            unmount();
        });
    });
});
