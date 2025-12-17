import { describe, expect, it } from "bun:test";
import "../setup";

import { Text } from "react-native";

import {
    ContextContainer,
    type ContextContainerType,
    useIsLastItem,
    useListScrollSize,
    useRecyclingEffect,
    useRecyclingState,
    useSyncLayout,
    useViewability,
    useViewabilityAmount,
} from "../../src/state/ContextContainer";
import { StateProvider, useStateContext } from "../../src/state/state";
import type { ViewAmountToken, ViewToken } from "../../src/types";
import TestRenderer, { act } from "../helpers/testRenderer";

// Helper to create a mock context value
function createMockContextValue(overrides?: Partial<ContextContainerType>): ContextContainerType {
    return {
        containerId: 0,
        index: 0,
        itemKey: "item-0",
        triggerLayout: () => {},
        value: { id: 0, text: "Item 0" },
        ...overrides,
    };
}

async function flushAsync() {
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
}

describe("ContextContainer hooks", () => {
    describe("useViewability", () => {
        it("should register callback when used inside context", async () => {
            const callback = (token: ViewToken) => {
                expect(token).toBeDefined();
            };

            const contextValue = createMockContextValue();
            let capturedCtx: any;

            const TestComponent = () => {
                const ctx = useStateContext();
                capturedCtx = ctx;
                useViewability(callback);
                return <Text>Test</Text>;
            };

            const renderer = TestRenderer.create(
                <StateProvider>
                    <ContextContainer.Provider value={contextValue}>
                        <TestComponent />
                    </ContextContainer.Provider>
                </StateProvider>,
            );

            await flushAsync();

            // Verify callback was registered
            const key = `${contextValue.containerId}`;
            expect(capturedCtx.mapViewabilityCallbacks.has(key)).toBe(true);
            expect(capturedCtx.mapViewabilityCallbacks.get(key)).toBe(callback);

            renderer.unmount();
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
                const renderer = TestRenderer.create(
                    <StateProvider>
                        <TestComponent />
                    </StateProvider>,
                );
                renderer.unmount();
            }).not.toThrow();
        });

        it("should handle configId parameter", async () => {
            const callback = () => {};
            const configId = "custom-config";
            const contextValue = createMockContextValue();
            let capturedCtx: any;

            const TestComponent = () => {
                const ctx = useStateContext();
                capturedCtx = ctx;
                useViewability(callback, configId);
                return <Text>Test</Text>;
            };

            const renderer = TestRenderer.create(
                <StateProvider>
                    <ContextContainer.Provider value={contextValue}>
                        <TestComponent />
                    </ContextContainer.Provider>
                </StateProvider>,
            );

            await flushAsync();

            const key = contextValue.containerId + configId;
            expect(capturedCtx.mapViewabilityCallbacks.has(key)).toBe(true);

            renderer.unmount();
        });

        it("should call callback with initial value if available", async () => {
            const contextValue = createMockContextValue();
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
                ctx.mapViewabilityValues.set(`${contextValue.containerId}`, mockToken);
                useViewability(callback);
                return <Text>Test</Text>;
            };

            const renderer = TestRenderer.create(
                <StateProvider>
                    <ContextContainer.Provider value={contextValue}>
                        <TestComponent />
                    </ContextContainer.Provider>
                </StateProvider>,
            );

            await flushAsync();

            // Callback should be called with initial value
            expect(callbackCalled).toBe(true);
            expect(receivedToken).toEqual(mockToken);

            renderer.unmount();
        });
    });

    describe("useViewabilityAmount", () => {
        it("should register callback when used inside context", async () => {
            const callback = (token: ViewAmountToken) => {
                expect(token).toBeDefined();
            };

            const contextValue = createMockContextValue();
            let capturedCtx: any;

            const TestComponent = () => {
                const ctx = useStateContext();
                capturedCtx = ctx;
                useViewabilityAmount(callback);
                return <Text>Test</Text>;
            };

            const renderer = TestRenderer.create(
                <StateProvider>
                    <ContextContainer.Provider value={contextValue}>
                        <TestComponent />
                    </ContextContainer.Provider>
                </StateProvider>,
            );

            await flushAsync();

            // Verify callback was registered
            expect(capturedCtx.mapViewabilityAmountCallbacks.has(contextValue.containerId)).toBe(true);
            expect(capturedCtx.mapViewabilityAmountCallbacks.get(contextValue.containerId)).toBe(callback);

            renderer.unmount();
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
                const renderer = TestRenderer.create(
                    <StateProvider>
                        <TestComponent />
                    </StateProvider>,
                );
                renderer.unmount();
            }).not.toThrow();
        });

        it("should call callback with initial value if available", async () => {
            const contextValue = createMockContextValue();
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
                ctx.mapViewabilityAmountValues.set(contextValue.containerId, mockToken);
                useViewabilityAmount(callback);
                return <Text>Test</Text>;
            };

            const renderer = TestRenderer.create(
                <StateProvider>
                    <ContextContainer.Provider value={contextValue}>
                        <TestComponent />
                    </ContextContainer.Provider>
                </StateProvider>,
            );

            await flushAsync();

            // Callback should be called with initial value
            expect(callbackCalled).toBe(true);
            expect(receivedToken).toEqual(mockToken);

            renderer.unmount();
        });
    });

    describe("useRecyclingEffect", () => {
        it("should work when used inside context", async () => {
            const effectCalls: any[] = [];

            const effect = (info: any) => {
                effectCalls.push(info);
            };

            const contextValue = createMockContextValue({
                index: 0,
                itemKey: "item-0",
                value: { id: 0, text: "Item 0" },
            });

            const TestComponent = () => {
                useRecyclingEffect(effect);
                return <Text>Test</Text>;
            };

            const renderer = TestRenderer.create(
                <StateProvider>
                    <ContextContainer.Provider value={contextValue}>
                        <TestComponent />
                    </ContextContainer.Provider>
                </StateProvider>,
            );

            await flushAsync();

            // First render - no effect should run (no previous value)
            expect(effectCalls).toHaveLength(0);

            // Verify hook doesn't crash and can be used
            expect(renderer.root).toBeDefined();

            renderer.unmount();
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
                const renderer = TestRenderer.create(
                    <StateProvider>
                        <TestComponent />
                    </StateProvider>,
                );
                renderer.unmount();
            }).not.toThrow();
        });
    });

    describe("useRecyclingState", () => {
        it("should initialize state with value when used inside context", () => {
            const contextValue = createMockContextValue({
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

            const renderer = TestRenderer.create(
                <StateProvider>
                    <ContextContainer.Provider value={contextValue}>
                        <TestComponent />
                    </ContextContainer.Provider>
                </StateProvider>,
            );

            expect(capturedState).toBe("initial");

            renderer.unmount();
        });

        it("should initialize state with function when used inside context", () => {
            const contextValue = createMockContextValue({
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

            const renderer = TestRenderer.create(
                <StateProvider>
                    <ContextContainer.Provider value={contextValue}>
                        <TestComponent />
                    </ContextContainer.Provider>
                </StateProvider>,
            );

            expect(capturedState).toBe("computed-0");

            renderer.unmount();
        });

        it("should update state when setState is called inside context", () => {
            const contextValue = createMockContextValue({
                index: 0,
                itemKey: "item-0",
                value: { id: 0, text: "Item 0" },
            });

            let capturedState: any;
            let setStateFn: any;
            let triggerLayoutCalled = false;

            contextValue.triggerLayout = () => {
                triggerLayoutCalled = true;
            };

            const TestComponent = () => {
                const [state, setState] = useRecyclingState("initial");
                capturedState = state;
                setStateFn = setState;
                return <Text>{String(state)}</Text>;
            };

            const renderer = TestRenderer.create(
                <StateProvider>
                    <ContextContainer.Provider value={contextValue}>
                        <TestComponent />
                    </ContextContainer.Provider>
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

            renderer.unmount();
        });

        it("should reset state when itemKey changes", () => {
            const contextValue1 = createMockContextValue({
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

            const renderer = TestRenderer.create(
                <StateProvider>
                    <ContextContainer.Provider value={contextValue1}>
                        <TestComponent contextValue={contextValue1} />
                    </ContextContainer.Provider>
                </StateProvider>,
            );

            // Update state
            act(() => {
                setStateFn("updated");
            });
            expect(capturedState).toBe("updated");

            // Change itemKey
            const contextValue2 = createMockContextValue({
                index: 1,
                itemKey: "item-1",
                value: { id: 1, text: "Item 1" },
            });

            act(() => {
                renderer.update(
                    <StateProvider>
                        <ContextContainer.Provider value={contextValue2}>
                            <TestComponent contextValue={contextValue2} />
                        </ContextContainer.Provider>
                    </StateProvider>,
                );
            });

            // State should reset to initial value
            expect(capturedState).toBe("initial");

            renderer.unmount();
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

            const renderer = TestRenderer.create(
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

            renderer.unmount();
        });

        it("should handle function initializer when used outside context", () => {
            let capturedState: any;

            const TestComponent = () => {
                const [state] = useRecyclingState(() => "computed");
                capturedState = state;
                return <Text>{String(state)}</Text>;
            };

            const renderer = TestRenderer.create(
                <StateProvider>
                    <TestComponent />
                </StateProvider>,
            );

            // Should compute initial value
            expect(capturedState).toBe("computed");

            renderer.unmount();
        });
    });

    describe("useIsLastItem", () => {
        it("should return true when item is last inside context", async () => {
            const contextValue = createMockContextValue({
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

            const renderer = TestRenderer.create(
                <StateProvider>
                    <ContextContainer.Provider value={contextValue}>
                        <TestComponent />
                    </ContextContainer.Provider>
                </StateProvider>,
            );

            await flushAsync();

            expect(capturedIsLast).toBe(true);

            renderer.unmount();
        });

        it("should return false when item is not last inside context", async () => {
            const contextValue = createMockContextValue({
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

            const renderer = TestRenderer.create(
                <StateProvider>
                    <ContextContainer.Provider value={contextValue}>
                        <TestComponent />
                    </ContextContainer.Provider>
                </StateProvider>,
            );

            await flushAsync();

            expect(capturedIsLast).toBe(false);

            renderer.unmount();
        });

        it("should fail gracefully when used outside context", () => {
            let capturedIsLast: boolean;

            const TestComponent = () => {
                const isLast = useIsLastItem();
                capturedIsLast = isLast;
                return <Text>{String(isLast)}</Text>;
            };

            const renderer = TestRenderer.create(
                <StateProvider>
                    <TestComponent />
                </StateProvider>,
            );

            // Should return false when outside context
            expect(capturedIsLast).toBe(false);

            renderer.unmount();
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

            const renderer = TestRenderer.create(
                <StateProvider>
                    <TestComponent />
                </StateProvider>,
            );

            await flushAsync();

            expect(capturedSize).toEqual({ height: 800, width: 400 });

            renderer.unmount();
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

            const renderer = TestRenderer.create(
                <StateProvider>
                    <TestComponent />
                </StateProvider>,
            );

            await flushAsync();

            expect(capturedSize).toEqual({ height: 600, width: 300 });

            renderer.unmount();
        });
    });

    describe("useSyncLayout", () => {
        it("should return triggerLayout function when used inside context (new architecture)", async () => {
            // IsNewArchitecture is set to true in setup.ts via global.nativeFabricUIManager
            let triggerLayoutCalled = false;
            const contextValue = createMockContextValue({
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

            const renderer = TestRenderer.create(
                <StateProvider>
                    <ContextContainer.Provider value={contextValue}>
                        <TestComponent />
                    </ContextContainer.Provider>
                </StateProvider>,
            );

            await flushAsync();

            expect(capturedSyncLayout).toBe(contextValue.triggerLayout);

            // Call it
            act(() => {
                capturedSyncLayout();
            });

            expect(triggerLayoutCalled).toBe(true);

            renderer.unmount();
        });

        it("should return noop when used outside context (new architecture)", async () => {
            // IsNewArchitecture is set to true in setup.ts
            let capturedSyncLayout: any;

            const TestComponent = () => {
                const syncLayout = useSyncLayout();
                capturedSyncLayout = syncLayout;
                return <Text>Test</Text>;
            };

            const renderer = TestRenderer.create(
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

            renderer.unmount();
        });
    });
});
