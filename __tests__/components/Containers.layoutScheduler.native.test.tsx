import * as React from "react";
import { Text } from "react-native";

import { beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import * as calculateItemsInViewModule from "../../src/core/calculateItemsInView";
import { getContainerLayoutEffectScope } from "../../src/core/scheduleContainerLayout";
import { Platform } from "../../src/platform/Platform";
import { StateProvider, set$, useArr$, useStateContext } from "../../src/state/state";
import { createMockState } from "../__mocks__/createMockState";
import TestRenderer, { act, type ReactTestRenderer } from "../helpers/testRenderer";
import { registerBaseModuleMocks } from "../setup";

type TestItem = { id: string; label: string };

const data: TestItem[] = [
    { id: "a", label: "Alpha" },
    { id: "b", label: "Beta" },
];
const measuredHeights = new Map([
    [0, 150],
    [1, 220],
]);
const containersWithoutMeasurement = new Set<number>();

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
                    if (!containersWithoutMeasurement.has(id)) {
                        callback(0, 0, 320, measuredHeights.get(id) ?? 100);
                    }
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

describe("Containers layout-effect measurement scheduling", () => {
    beforeEach(() => {
        mock.restore();
        registerBaseModuleMocks();
        registerPositionViewMeasureMock();
        containersWithoutMeasurement.clear();
        measuredHeights.set(0, 150);
        measuredHeights.set(1, 220);
    });

    async function renderContainers(importKey: string) {
        const { Container } = await import(`../../src/components/Container?layout-effect-scheduler-${importKey}`);
        const { measureContainersInLayoutEffect } = await import(
            "../../src/core/measureContainersInLayoutEffect.native?layout-effect-scheduler"
        );

        function LayoutCoordinator({ children }: { children: React.ReactNode }) {
            const ctx = useStateContext();
            const [containerLayoutEpoch] = useArr$(["containerLayoutEpoch"]);

            React.useLayoutEffect(() => {
                const targetContainerIds = getContainerLayoutEffectScope(ctx);
                if (targetContainerIds !== undefined) {
                    measureContainersInLayoutEffect(ctx, targetContainerIds);
                }
            }, [ctx, containerLayoutEpoch]);

            return children;
        }

        let ctxReady: ReturnType<typeof useStateContext> | undefined;

        function Harness() {
            const ctx = useStateContext();
            ctxReady = ctx;
            const didInitialize = React.useRef(false);

            if (!didInitialize.current) {
                const state = createMockState({
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
                });
                ctx.state = state;
                ctx.state.containerItemKeys.set("a", 0);
                ctx.state.containerItemKeys.set("b", 1);
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
                set$(ctx, "numContainersPooled", 2);
                set$(ctx, "otherAxisSize", 320);
                set$(ctx, "readyToRender", true);
                set$(ctx, "totalSize", 200);
                didInitialize.current = true;
            }

            return (
                <LayoutCoordinator>
                    <Container
                        getRenderedItem={(itemKey) => {
                            const index = itemKey === "a" ? 0 : 1;
                            const item = data[index];
                            return {
                                index,
                                item,
                                renderedItem: <Text>{item.label}</Text>,
                            };
                        }}
                        horizontal={false}
                        id={0}
                        itemKey="a"
                        recycleItems
                    />
                    <Container
                        getRenderedItem={(itemKey) => {
                            const index = itemKey === "a" ? 0 : 1;
                            const item = data[index];
                            return {
                                index,
                                item,
                                renderedItem: <Text>{item.label}</Text>,
                            };
                        }}
                        horizontal={false}
                        id={1}
                        itemKey="b"
                        recycleItems
                    />
                </LayoutCoordinator>
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

        return { ctx: ctxReady!, renderer: renderer! };
    }

    it("refreshes data changed before first layout without repeating stale measurements", async () => {
        const originalPlatform = Platform.OS;
        Platform.OS = "ios";
        const { LegendList } = await import("../../src/components/LegendList?prelayout-measurement-retry");
        let ctx: ReturnType<typeof useStateContext>;
        let scrollProps: any;
        let commits = 0;
        const Surface = React.forwardRef((props: any, ref: React.Ref<any>) => {
            ctx = useStateContext();
            scrollProps = props;
            React.useImperativeHandle(ref, () => ({ measure: () => {}, scrollTo: () => {} }));
            return <>{props.children}</>;
        });
        let items = Array.from({ length: 10 }, (_, index) => ({ id: String(index) }));
        const list = () => (
            <React.Profiler
                id="prelayout"
                onRender={() => {
                    if (++commits > 80) throw new Error("stale measurement retry did not settle");
                }}
            >
                <LegendList
                    data={items}
                    estimatedItemSize={100}
                    estimatedListSize={{ height: 0, width: 0 }}
                    keyExtractor={(item) => item.id}
                    recycleItems={false}
                    renderItem={({ item }) => <Text>{item.id}</Text>}
                    renderScrollComponent={(props) => <Surface {...props} />}
                />
            </React.Profiler>
        );
        let renderer: ReactTestRenderer;
        await act(async () => {
            renderer = TestRenderer.create(list());
        });
        try {
            expect(ctx!.state.scrollLength).toBe(0);
            items = [{ id: "inserted" }, ...items];
            await act(async () => renderer!.update(list()));
            items = items.slice(5);
            await act(async () => renderer!.update(list()));
            expect(ctx!.state.containerItemKeys.size).toBe(0);
            await act(async () => {
                scrollProps.onLayout({ nativeEvent: { layout: { height: 500, width: 320, x: 0, y: 0 } } });
            });
            expect([...ctx!.state.containerItemKeys.keys()].every((key) => items.some((item) => item.id === key))).toBe(
                true,
            );
            expect(ctx!.state.containerItemKeys.size).toBeGreaterThan(0);
            for (let frame = 0; frame < 4; frame++) {
                await act(async () => {
                    await new Promise((resolve) => requestAnimationFrame(resolve));
                });
            }
            const settledCommits = commits;
            await act(async () => {
                await new Promise((resolve) => requestAnimationFrame(resolve));
            });
            expect(commits).toBe(settledCommits);
        } finally {
            await act(async () => renderer!.unmount());
            Platform.OS = originalPlatform;
        }
    });

    it("applies one coherent position recalculation for all containers committed together", async () => {
        const calculateSpy = spyOn(calculateItemsInViewModule, "calculateItemsInView").mockImplementation(() => {});
        const { renderer } = await renderContainers("coherent-batch");

        expect(calculateSpy).toHaveBeenCalledTimes(1);

        await act(async () => {
            renderer.unmount();
        });
        calculateSpy.mockRestore();
    });

    it("does not let a missing measure callback hold committed size changes", async () => {
        containersWithoutMeasurement.add(1);
        const calculateSpy = spyOn(calculateItemsInViewModule, "calculateItemsInView").mockImplementation(() => {});
        const { ctx, renderer } = await renderContainers("missing-measurement");

        expect(ctx.state.sizesKnown.get("a")).toBe(150);
        expect(ctx.state.sizesKnown.get("b")).toBe(100);
        expect(calculateSpy).toHaveBeenCalledTimes(1);

        await act(async () => {
            renderer.unmount();
        });
        calculateSpy.mockRestore();
    });

    it("remeasures a container in the same commit when extraData changes row layout", async () => {
        const calculateSpy = spyOn(calculateItemsInViewModule, "calculateItemsInView").mockImplementation(() => {});
        const { ctx, renderer } = await renderContainers("row-layout-change");
        calculateSpy.mockClear();
        measuredHeights.set(0, 180);

        await act(async () => {
            set$(ctx, "extraData", { version: 1 });
        });
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 0));
        });

        expect(ctx.state.sizesKnown.get("a")).toBe(180);
        expect(calculateSpy).toHaveBeenCalledTimes(1);

        await act(async () => {
            renderer.unmount();
        });
        calculateSpy.mockRestore();
    });
});
