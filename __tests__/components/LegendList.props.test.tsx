import { beforeEach, describe, expect, it, mock } from "bun:test";
import "../setup";
import { Text } from "react-native";

import { act, render } from "../helpers/testingLibrary";

let lastListProps: any;
let requestAdjustCalls: number[] = [];
let scrollToCalls: any[] = [];

import type { ScrollAdjustHandler } from "../../src/core/ScrollAdjustHandler";
import type { StateContext } from "../../src/state/state";
import { setDidLayout } from "../../src/utils/setDidLayout";

const handlerInstances: ScrollAdjustHandler[] = [];
const layoutEvent = {
    nativeEvent: { layout: { height: 200, width: 320, x: 0, y: 0 } },
};

function registerLegendListPropMocks() {
    mock.module("@/components/ListComponent", () => ({
        ListComponent: (props: any) => {
            lastListProps = props;
            return null;
        },
    }));

    mock.module("@/core/ScrollAdjustHandler", () => {
        return {
            ScrollAdjustHandler: class {
                context: StateContext;
                appliedAdjust = 0;
                pendingAdjust = 0;
                mounted = false;
                constructor(ctx: StateContext) {
                    this.context = ctx;
                    handlerInstances.push(this as any);
                }
                requestAdjust() {}
                setMounted() {
                    this.mounted = true;
                }
                getAdjust() {
                    return this.appliedAdjust;
                }
            },
        };
    });

    mock.module("@/utils/requestAdjust", () => ({
        requestAdjust: (_ctx: unknown, diff: number) => {
            requestAdjustCalls.push(diff);
        },
    }));

    mock.module("@/core/scrollTo", () => ({
        scrollTo: (_ctx: unknown, params: any) => {
            scrollToCalls.push(params);
        },
    }));
}

async function flushAsync() {
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
}

async function getStateFromRender() {
    for (let i = 0; i < 5; i++) {
        const handler = lastListProps?.scrollAdjustHandler ?? handlerInstances.at(-1);
        if (handler) {
            return (handler as any).context.state;
        }
        await flushAsync();
    }
    throw new Error("scrollAdjustHandler not found after retries");
}

async function getContextFromRender() {
    for (let i = 0; i < 5; i++) {
        const handler = lastListProps?.scrollAdjustHandler ?? handlerInstances.at(-1);
        if (handler) {
            return (handler as any).context as StateContext;
        }
        await flushAsync();
    }
    throw new Error("scrollAdjustHandler not found after retries");
}

async function waitForTailWindow(
    state: any,
    dataLength: number,
    observedRenderedIndices: Set<number>,
    getRenderedItem: ((key: string) => { index: number } | null) | undefined,
) {
    for (let i = 0; i < 20; i++) {
        for (const key of state.containerItemKeys.keys()) {
            const rendered = getRenderedItem?.(key);
            if (rendered?.index !== undefined) {
                observedRenderedIndices.add(rendered.index);
            }
        }

        if (state.startBuffered !== null && state.endBuffered === dataLength - 1 && observedRenderedIndices.size > 0) {
            return;
        }
        await flushAsync();
    }
    throw new Error("tail window did not stabilize");
}

beforeEach(() => {
    registerLegendListPropMocks();
    handlerInstances.length = 0;
    lastListProps = undefined;
    requestAdjustCalls = [];
    scrollToCalls = [];
});

describe("LegendList props behavior", () => {
    it("does not issue a mount content offset when no initial scroll is configured", async () => {
        const data = [
            { id: "item-1", label: "Alpha" },
            { id: "item-2", label: "Beta" },
        ];
        const { LegendList } = await import("../../src/components/LegendList?props-test-no-initial-scroll");

        const rendered = render(
            <LegendList
                data={data}
                estimatedItemSize={100}
                keyExtractor={(item: { id: string }) => item.id}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
            />,
        );

        await getStateFromRender();
        expect(lastListProps.initialContentOffset).toBeUndefined();

        rendered.unmount();
    });

    it("sets readyToRender after layout when no initial scroll is configured", async () => {
        const data = [
            { id: "item-1", label: "Alpha" },
            { id: "item-2", label: "Beta" },
        ];
        const onLoadCalls: number[] = [];
        const { LegendList } = await import("../../src/components/LegendList?props-test-ready-no-initial-scroll");

        const rendered = render(
            <LegendList
                data={data}
                estimatedItemSize={100}
                keyExtractor={(item: { id: string }) => item.id}
                onLoad={({ elapsedTimeInMs }) => onLoadCalls.push(elapsedTimeInMs)}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
            />,
        );

        const ctx = await getContextFromRender();
        expect(ctx.values.get("readyToRender")).toBeUndefined();

        await act(async () => {
            setDidLayout(ctx);
        });
        await flushAsync();

        expect(ctx.values.get("readyToRender")).toBe(true);
        expect(onLoadCalls).toHaveLength(1);

        rendered.unmount();
    });

    it("clears zero-valued initial scroll targets on mount", async () => {
        const data = [
            { id: "item-1", label: "Alpha" },
            { id: "item-2", label: "Beta" },
        ];
        const { LegendList } = await import("../../src/components/LegendList?props-test-zero");

        const renderList = (props: { initialScrollIndex?: number; initialScrollOffset?: number }) =>
            render(
                <LegendList
                    data={data}
                    estimatedItemSize={100}
                    keyExtractor={(item: { id: string }) => item.id}
                    renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
                    {...props}
                />,
            );

        const indexRenderer = renderList({ initialScrollIndex: 0 });
        const indexState = await getStateFromRender();
        const indexContext = await getContextFromRender();
        expect(indexState.didFinishInitialScroll).toBe(true);
        expect(indexState.initialScroll).toBeUndefined();
        expect(indexContext.values.get("readyToRender")).toBeUndefined();
        await act(async () => {
            setDidLayout(indexContext);
        });
        await flushAsync();
        expect(indexContext.values.get("readyToRender")).toBe(true);
        indexRenderer.unmount();

        const offsetRenderer = renderList({ initialScrollOffset: 0 });
        const offsetState = await getStateFromRender();
        const offsetContext = await getContextFromRender();
        expect(offsetState.didFinishInitialScroll).toBe(true);
        expect(offsetState.initialScroll).toBeUndefined();
        expect(offsetContext.values.get("readyToRender")).toBeUndefined();
        await act(async () => {
            setDidLayout(offsetContext);
        });
        await flushAsync();
        expect(offsetContext.values.get("readyToRender")).toBe(true);
        offsetRenderer.unmount();
    });

    it("clears zero-valued object initial scroll targets on mount", async () => {
        const data = [
            { id: "item-1", label: "Alpha" },
            { id: "item-2", label: "Beta" },
        ];
        const { LegendList } = await import("../../src/components/LegendList?props-test-zero-object");

        const rendered = render(
            <LegendList
                data={data}
                estimatedItemSize={100}
                initialScrollIndex={{ index: 0, viewOffset: 0, viewPosition: 0 }}
                keyExtractor={(item: { id: string }) => item.id}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
            />,
        );

        const state = await getStateFromRender();
        expect(state.didFinishInitialScroll).toBe(true);
        expect(state.initialScroll).toBeUndefined();

        rendered.unmount();
    });

    it("finishes empty zero-valued initial scroll targets so onLoad can fire", async () => {
        const onLoadCalls: number[] = [];
        const { LegendList } = await import("../../src/components/LegendList?props-test-empty-zero");

        const renderList = (props: { initialScrollIndex?: number; initialScrollOffset?: number }) =>
            render(
                <LegendList
                    data={[]}
                    estimatedItemSize={100}
                    keyExtractor={(item: { id: string }) => item.id}
                    onLoad={({ elapsedTimeInMs }) => onLoadCalls.push(elapsedTimeInMs)}
                    renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
                    {...props}
                />,
            );

        const indexRenderer = renderList({ initialScrollIndex: 0 });
        const indexState = await getStateFromRender();
        const indexContext = await getContextFromRender();
        expect(indexState.didFinishInitialScroll).toBe(true);
        expect(indexState.initialScroll).toBeUndefined();
        await act(async () => {
            setDidLayout(indexContext);
        });
        await flushAsync();
        expect(indexContext.values.get("readyToRender")).toBe(true);
        expect(onLoadCalls).toHaveLength(1);
        indexRenderer.unmount();

        onLoadCalls.length = 0;

        const offsetRenderer = renderList({ initialScrollOffset: 0 });
        const offsetState = await getStateFromRender();
        const offsetContext = await getContextFromRender();
        expect(offsetState.didFinishInitialScroll).toBe(true);
        expect(offsetState.initialScroll).toBeUndefined();
        await act(async () => {
            setDidLayout(offsetContext);
        });
        await flushAsync();
        expect(offsetContext.values.get("readyToRender")).toBe(true);
        expect(onLoadCalls).toHaveLength(1);
        offsetRenderer.unmount();
    });

    it("initialScrollAtEnd scrolls to the last item", async () => {
        const data = [
            { id: "item-1", label: "Alpha" },
            { id: "item-2", label: "Beta" },
            { id: "item-3", label: "Gamma" },
        ];

        const { LegendList } = await import("../../src/components/LegendList?props-test");
        const rendered = render(
            <LegendList
                data={data}
                estimatedItemSize={100}
                initialScrollAtEnd
                keyExtractor={(item: { id: string }) => item.id}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
            />,
        );

        const state = await getStateFromRender();

        expect(state.initialScroll?.index).toBe(2);
        expect(state.initialScroll?.viewOffset).toBeCloseTo(0);

        rendered.unmount();
    });

    it("finishes empty initialScrollAtEnd mounts so onLoad can fire", async () => {
        const onLoadCalls: number[] = [];

        const { LegendList } = await import("../../src/components/LegendList?props-test-empty-end");
        const rendered = render(
            <LegendList
                data={[]}
                estimatedItemSize={100}
                initialScrollAtEnd
                keyExtractor={(item: { id: string }) => item.id}
                onLoad={({ elapsedTimeInMs }) => onLoadCalls.push(elapsedTimeInMs)}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
            />,
        );

        const state = await getStateFromRender();
        expect(state.didFinishInitialScroll).toBe(true);
        expect(state.initialScroll?.contentOffset).toBe(0);

        await act(async () => {
            setDidLayout((handlerInstances.at(-1) as any).context);
        });
        await flushAsync();

        expect(onLoadCalls).toHaveLength(1);

        rendered.unmount();
    });

    it("defaults bottom-aligned initialScrollIndex object viewOffset from paddingBottom", async () => {
        const data = [
            { id: "item-1", label: "Alpha" },
            { id: "item-2", label: "Beta" },
            { id: "item-3", label: "Gamma" },
        ];

        const { LegendList } = await import("../../src/components/LegendList?props-test-view-position-default");
        const rendered = render(
            <LegendList
                data={data}
                estimatedItemSize={100}
                initialScrollIndex={{ index: 2, viewPosition: 1 }}
                keyExtractor={(item: { id: string }) => item.id}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
                style={{ paddingBottom: 12 }}
            />,
        );

        const state = await getStateFromRender();
        expect(state.initialScroll?.index).toBe(2);
        expect(state.initialScroll?.viewPosition).toBe(1);
        expect(state.initialScroll?.viewOffset).toBe(-12);

        rendered.unmount();
    });

    it("does not retry a finished initial scroll after the user scrolls away", async () => {
        const data = Array.from({ length: 10 }, (_value, index) => ({
            id: `item-${index}`,
            label: `Item ${index}`,
        }));

        const { LegendList } = await import("../../src/components/LegendList?props-test-retry");
        const rendered = render(
            <LegendList
                data={data}
                estimatedItemSize={100}
                getFixedItemSize={() => 100}
                initialScrollIndex={3}
                keyExtractor={(item: { id: string }) => item.id}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
            />,
        );

        const state = await getStateFromRender();
        expect(state.initialScroll?.contentOffset).toBe(300);

        scrollToCalls = [];
        state.didFinishInitialScroll = true;
        state.initialScroll = undefined;
        state.scroll = 120;

        await act(async () => {
            lastListProps?.onLayout?.({
                nativeEvent: { layout: { height: 180, width: 320, x: 0, y: 0 } },
            } as any);
        });
        await flushAsync();

        expect(scrollToCalls).toEqual([]);

        rendered.unmount();
    });

    it("does not use the removed post-finish layout retry window for bootstrap initial scroll", async () => {
        const data = Array.from({ length: 10 }, (_value, index) => ({
            id: `item-${index}`,
            label: `Item ${index}`,
        }));

        const { LegendList } = await import("../../src/components/LegendList?props-test-retry-window");
        const rendered = render(
            <LegendList
                data={data}
                estimatedItemSize={100}
                getFixedItemSize={() => 100}
                initialScrollIndex={{ index: 3, viewPosition: 1 }}
                keyExtractor={(item: { id: string }) => item.id}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
            />,
        );

        const state = await getStateFromRender();
        const targetOffset = lastListProps.initialContentOffset ?? state.initialScroll?.contentOffset ?? 0;

        scrollToCalls = [];
        state.didFinishInitialScroll = true;
        state.initialScroll = undefined;
        state.scroll = targetOffset;

        await act(async () => {
            lastListProps?.onLayout?.({
                nativeEvent: { layout: { height: 180, width: 320, x: 0, y: 0 } },
            } as any);
        });
        await flushAsync();

        expect(scrollToCalls).toEqual([]);

        rendered.unmount();
    });

    it("does not retry a finished offset-only initial scroll after a layout change", async () => {
        const data = Array.from({ length: 10 }, (_value, index) => ({
            id: `item-${index}`,
            label: `Item ${index}`,
        }));

        const { LegendList } = await import("../../src/components/LegendList?props-test-offset-retry");
        const rendered = render(
            <LegendList
                data={data}
                estimatedItemSize={100}
                initialScrollOffset={220}
                keyExtractor={(item: { id: string }) => item.id}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
            />,
        );

        const state = await getStateFromRender();
        expect(state.initialScroll?.contentOffset).toBe(220);

        scrollToCalls = [];
        state.didFinishInitialScroll = true;
        state.initialScroll = undefined;
        state.scroll = 220;

        await act(async () => {
            lastListProps?.onLayout?.({
                nativeEvent: { layout: { height: 180, width: 320, x: 0, y: 0 } },
            } as any);
        });
        await flushAsync();

        expect(scrollToCalls).toEqual([]);

        rendered.unmount();
    });

    it("replays offset-only initialScroll with a native scroll after data arrives post-layout", async () => {
        const { LegendList } = await import("../../src/components/LegendList?props-test-offset-async");
        const renderList = (data: Array<{ id: string; label: string }>) => (
            <LegendList
                data={data}
                estimatedItemSize={100}
                getFixedItemSize={() => 100}
                initialScrollOffset={250}
                keyExtractor={(item: { id: string }) => item.id}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
            />
        );

        const rendered = render(renderList([]));
        await getStateFromRender();

        await act(async () => {
            lastListProps?.onLayout?.(layoutEvent as any);
        });
        await flushAsync();

        scrollToCalls = [];
        await act(async () => {
            rendered.rerender(
                renderList(
                    Array.from({ length: 5 }, (_value, index) => ({
                        id: `item-${index}`,
                        label: `Item ${index}`,
                    })),
                ),
            );
        });
        await flushAsync();

        expect(scrollToCalls).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    forceScroll: true,
                    isInitialScroll: true,
                    offset: 250,
                }),
            ]),
        );

        rendered.unmount();
    });

    it("does not adjust padding on mount when scroll is still at the top", async () => {
        const data = [
            { id: "item-1", label: "Alpha" },
            { id: "item-2", label: "Beta" },
        ];

        const { LegendList } = await import("../../src/components/LegendList?props-test");
        const rendered = render(
            <LegendList
                data={data}
                estimatedItemSize={100}
                keyExtractor={(item: { id: string }) => item.id}
                maintainVisibleContentPosition
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
                style={{ paddingTop: 40 }}
            />,
        );

        await flushAsync();

        expect(requestAdjustCalls).toEqual([]);

        rendered.unmount();
    });

    it("does not render early items when initialScrollAtEnd is used on a long list", async () => {
        const data = Array.from({ length: 120 }, (_value, index) => ({
            id: `item-${index}`,
            label: `Item ${index}`,
        }));
        const observedRenderedIndices = new Set<number>();
        const longListLayoutEvent = {
            nativeEvent: { layout: { height: 300, width: 320, x: 0, y: 0 } },
        };

        const { LegendList } = await import("../../src/components/LegendList?props-test");
        const rendered = render(
            <LegendList
                data={data}
                drawDistance={200}
                estimatedItemSize={100}
                getFixedItemSize={() => 100}
                initialScrollAtEnd
                keyExtractor={(item: { id: string }) => item.id}
                renderItem={({ item, index }: { item: { label: string }; index: number }) => {
                    observedRenderedIndices.add(index);
                    return <Text>{item.label}</Text>;
                }}
            />,
        );

        const state = await getStateFromRender();
        await act(async () => {
            lastListProps?.onLayout?.(longListLayoutEvent as any);
        });
        await waitForTailWindow(state, data.length, observedRenderedIndices, lastListProps?.getRenderedItem);

        const renderedIndices = Array.from(observedRenderedIndices.values());

        expect(renderedIndices).toContain(data.length - 1);
        expect(renderedIndices).toContain(data.length - 2);
        expect(renderedIndices).not.toContain(0);
        expect(renderedIndices).not.toContain(1);
        expect(state.startBuffered).toBeGreaterThan(1);
        expect(state.endBuffered).toBe(data.length - 1);

        rendered.unmount();
    });
});
