import * as React from "react";
import { Text } from "react-native";

import { beforeEach, describe, expect, it, mock } from "bun:test";
import { type StateContext, StateProvider, set$, useStateContext } from "../../src/state/state";
import { createImperativeHandle } from "../../src/utils/createImperativeHandle";
import { createMockState } from "../__mocks__/createMockState";
import TestRenderer, { act } from "../helpers/testRenderer";
import { registerBaseModuleMocks } from "../setup";

type TestItem = { id: string; label: string };

let measuredHeight = 80;
const measuredHeights = new Map<number, number>();

function registerPositionViewMeasureMock() {
    mock.module("@/components/PositionView", () => {
        const PositionView = ({
            children,
            id,
            refView,
        }: {
            children: React.ReactNode;
            id: number;
            refView: React.RefObject<any>;
        }) => {
            refView.current = {
                measure: (callback: (x: number, y: number, width: number, height: number) => void) => {
                    callback(0, 0, 320, measuredHeights.get(id) ?? measuredHeight);
                },
            };

            return <>{children}</>;
        };

        return {
            PositionView,
            PositionViewSticky: PositionView,
        };
    });
}

async function flushAsync() {
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
}

beforeEach(() => {
    mock.restore();
    registerBaseModuleMocks();
    registerPositionViewMeasureMock();
    measuredHeight = 80;
    measuredHeights.clear();
});

describe("Container clearCaches measurement", () => {
    it("remeasures mounted containers from the layout effect after clearCaches", async () => {
        const data: TestItem[] = [{ id: "a", label: "Alpha" }];
        const sizesAtRecalculate: Array<number | undefined> = [];
        let ctxReady: StateContext | undefined;
        let handleReady: ReturnType<typeof createImperativeHandle> | undefined;
        const { Container } = await import("../../src/components/Container?clear-caches-sync-measure");

        function Harness() {
            const ctx = useStateContext();
            const didInitialize = React.useRef(false);

            if (!didInitialize.current) {
                ctx.state = createMockState({
                    averageSizes: { "": { avg: 80, num: 1 } },
                    didContainersLayout: true,
                    endBuffered: 0,
                    idCache: ["a"],
                    indexByKey: new Map([["a", 0]]),
                    positions: [0],
                    props: {
                        data,
                        estimatedItemSize: 100,
                        keyExtractor: (item: TestItem) => item.id,
                    },
                    sizes: new Map([["a", 80]]),
                    sizesKnown: new Map([["a", 80]]),
                    startBuffered: 0,
                    totalSize: 80,
                    triggerCalculateItemsInView: () => {
                        sizesAtRecalculate.push(ctx.state.sizesKnown.get("a"));
                    },
                });
                set$(ctx, "containerColumn0", 1);
                set$(ctx, "containerSpan0", 1);
                set$(ctx, "containerItemData0", data[0]);
                set$(ctx, "containerItemKey0", "a");
                set$(ctx, "containerPosition0", 0);
                set$(ctx, "numColumns", 1);
                set$(ctx, "numContainers", 1);
                set$(ctx, "totalSize", 80);
                didInitialize.current = true;
            }

            React.useLayoutEffect(() => {
                ctxReady = ctx;
                handleReady = createImperativeHandle(ctx);
            }, [ctx]);

            return (
                <Container
                    getRenderedItem={() => ({
                        index: 0,
                        item: data[0],
                        renderedItem: <Text>{data[0].label}</Text>,
                    })}
                    horizontal={false}
                    id={0}
                    itemKey="a"
                    recycleItems={false}
                />
            );
        }

        let renderer: TestRenderer.ReactTestRenderer;
        await act(async () => {
            renderer = TestRenderer.create(
                <StateProvider>
                    <Harness />
                </StateProvider>,
            );
        });
        await flushAsync();

        expect(ctxReady?.state.sizesKnown.get("a")).toBe(80);

        sizesAtRecalculate.length = 0;
        measuredHeight = 140;

        await act(async () => {
            handleReady?.clearCaches();
        });

        expect(sizesAtRecalculate).toEqual([undefined]);
        expect(ctxReady?.state.sizesKnown.get("a")).toBe(140);

        await act(async () => {
            renderer!.unmount();
        });
    });

    it("removes the mounted container layout trigger when the container unmounts", async () => {
        const data: TestItem[] = [{ id: "a", label: "Alpha" }];
        let ctxReady: StateContext | undefined;
        const { Container } = await import("../../src/components/Container?clear-caches-trigger-cleanup");

        function Harness() {
            const ctx = useStateContext();
            const didInitialize = React.useRef(false);

            if (!didInitialize.current) {
                ctx.state = createMockState({
                    didContainersLayout: true,
                    endBuffered: 0,
                    idCache: ["a"],
                    indexByKey: new Map([["a", 0]]),
                    positions: [0],
                    props: {
                        data,
                        keyExtractor: (item: TestItem) => item.id,
                    },
                    sizes: new Map([["a", 80]]),
                    sizesKnown: new Map([["a", 80]]),
                    startBuffered: 0,
                    totalSize: 80,
                });
                set$(ctx, "containerColumn0", 1);
                set$(ctx, "containerSpan0", 1);
                set$(ctx, "containerItemData0", data[0]);
                set$(ctx, "containerItemKey0", "a");
                set$(ctx, "containerPosition0", 0);
                set$(ctx, "numColumns", 1);
                set$(ctx, "totalSize", 80);
                didInitialize.current = true;
            }

            React.useLayoutEffect(() => {
                ctxReady = ctx;
            }, [ctx]);

            return (
                <Container
                    getRenderedItem={() => ({
                        index: 0,
                        item: data[0],
                        renderedItem: <Text>{data[0].label}</Text>,
                    })}
                    horizontal={false}
                    id={0}
                    itemKey="a"
                    recycleItems={false}
                />
            );
        }

        let renderer: TestRenderer.ReactTestRenderer;
        await act(async () => {
            renderer = TestRenderer.create(
                <StateProvider>
                    <Harness />
                </StateProvider>,
            );
        });

        expect(ctxReady?.containerLayoutTriggers.size).toBe(1);

        await act(async () => {
            renderer!.unmount();
        });

        expect(ctxReady?.containerLayoutTriggers.size).toBe(0);
    });

    it("updates a non-pending layout-effect measurement while batching pending containers", async () => {
        const data: TestItem[] = [
            { id: "a", label: "Alpha" },
            { id: "b", label: "Beta" },
        ];
        let ctxReady: StateContext | undefined;
        measuredHeights.set(0, 175);
        measuredHeights.set(1, 220);
        const { Container } = await import("../../src/components/Container?non-pending-seed-batch");

        function Harness() {
            const ctx = useStateContext();
            const didInitialize = React.useRef(false);

            if (!didInitialize.current) {
                ctx.state = createMockState({
                    averageSizes: { "": { avg: 100, num: 2 } },
                    didContainersLayout: true,
                    endBuffered: 1,
                    idCache: ["a", "b"],
                    indexByKey: new Map([
                        ["a", 0],
                        ["b", 1],
                    ]),
                    positions: [0, 100],
                    props: {
                        data,
                        estimatedItemSize: 100,
                        keyExtractor: (item: TestItem) => item.id,
                    },
                    sizes: new Map([
                        ["a", 100],
                        ["b", 100],
                    ]),
                    sizesKnown: new Map([
                        ["a", 100],
                        ["b", 100],
                    ]),
                    startBuffered: 0,
                    totalSize: 200,
                    userScrollAnchorReset: { keys: new Set(["b"]) },
                });
                set$(ctx, "containerColumn0", 1);
                set$(ctx, "containerColumn1", 1);
                set$(ctx, "containerSpan0", 1);
                set$(ctx, "containerSpan1", 1);
                set$(ctx, "containerItemData0", data[0]);
                set$(ctx, "containerItemData1", data[1]);
                set$(ctx, "containerItemKey0", "a");
                set$(ctx, "containerItemKey1", "b");
                set$(ctx, "containerPosition0", 0);
                set$(ctx, "containerPosition1", 100);
                set$(ctx, "numColumns", 1);
                set$(ctx, "numContainers", 2);
                set$(ctx, "totalSize", 200);
                didInitialize.current = true;
            }

            React.useLayoutEffect(() => {
                ctxReady = ctx;
            }, [ctx]);

            const getRenderedItem = (itemKey: string) => {
                const index = itemKey === "a" ? 0 : 1;
                const item = data[index];
                return {
                    index,
                    item,
                    renderedItem: <Text>{item.label}</Text>,
                };
            };

            return (
                <>
                    <Container
                        getRenderedItem={getRenderedItem}
                        horizontal={false}
                        id={0}
                        itemKey="a"
                        recycleItems={false}
                    />
                    <Container
                        getRenderedItem={getRenderedItem}
                        horizontal={false}
                        id={1}
                        itemKey="b"
                        recycleItems={false}
                    />
                </>
            );
        }

        let renderer: TestRenderer.ReactTestRenderer;
        await act(async () => {
            renderer = TestRenderer.create(
                <StateProvider>
                    <Harness />
                </StateProvider>,
            );
        });

        expect(ctxReady?.state.sizesKnown.get("a")).toBe(175);
        expect(ctxReady?.state.sizesKnown.get("b")).toBe(220);
        expect(ctxReady?.state.userScrollAnchorReset?.keys.has("b") ?? false).toBe(false);

        await act(async () => {
            renderer!.unmount();
        });
    });
});
