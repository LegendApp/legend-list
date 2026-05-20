import * as React from "react";
import { StyleSheet, Text, View } from "react-native";

import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { useArr$ } from "../../src/state/state";
import type { LegendListRef } from "../../src/types.base";
import TestRenderer, { act } from "../helpers/testRenderer";
import { registerBaseModuleMocks } from "../setup";

const layoutEvent = {
    nativeEvent: { layout: { height: 200, width: 320, x: 0, y: 0 } },
};

type RenderedItemInfo = { renderedItem: React.ReactNode };
type TreeNode = ReturnType<ReturnType<typeof TestRenderer.create>["toJSON"]> | string;

function TestContainer({
    getRenderedItem,
    id,
}: {
    getRenderedItem: (key: string) => RenderedItemInfo | null;
    id: number;
}) {
    const [data, itemKey, extraData] = useArr$([
        `containerItemData${id}` as const,
        `containerItemKey${id}` as const,
        "extraData",
    ]);
    const renderedItemInfo = React.useMemo(
        () => (itemKey !== undefined ? getRenderedItem(itemKey) : null),
        [data, extraData, getRenderedItem, itemKey],
    );

    return <>{renderedItemInfo?.renderedItem ?? null}</>;
}

function TestContainers({ getRenderedItem }: { getRenderedItem: (key: string) => RenderedItemInfo | null }) {
    const [numContainersPooled = 0, readyToRender] = useArr$(["numContainersPooled", "readyToRender"]);

    return (
        <View style={{ opacity: readyToRender ? 1 : 0 }} testID="mock-containers-layer">
            {Array.from({ length: numContainersPooled }, (_, id) => (
                <TestContainer getRenderedItem={getRenderedItem} id={id} key={id} />
            ))}
        </View>
    );
}

function registerDatasetsMocks() {
    mock.module("@/components/Containers", () => ({
        Containers: TestContainers,
    }));
}

function collectTextFromTree(node: TreeNode, values: string[] = []) {
    if (node == null) {
        return values;
    }

    if (typeof node === "string") {
        values.push(node);
        return values;
    }

    if (Array.isArray(node)) {
        for (const child of node) {
            collectTextFromTree(child, values);
        }
        return values;
    }

    if (node.children) {
        collectTextFromTree(node.children, values);
    }

    return values;
}

function getRenderedLabels(renderer: TestRenderer.ReactTestRenderer) {
    return Array.from(new Set(collectTextFromTree(renderer.toJSON())));
}

function getDatasetLayerOpacityValues(renderer: TestRenderer.ReactTestRenderer) {
    return renderer.root
        .findAllByType(View)
        .map((node) => StyleSheet.flatten(node.props.style) as { flex?: number; opacity?: number } | undefined)
        .filter(
            (style): style is { flex?: number; opacity: number } => style?.flex === 1 && style.opacity !== undefined,
        )
        .map((style) => style.opacity);
}

function getContainerLayerOpacityValues(renderer: TestRenderer.ReactTestRenderer) {
    return renderer.root.findAllByProps({ testID: "mock-containers-layer" }).map((node) => {
        const style = StyleSheet.flatten(node.props.style) as { opacity: number };
        return style.opacity;
    });
}

async function flushAsync() {
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
}

async function flushFrames(count = 4) {
    for (let i = 0; i < count; i++) {
        await flushAsync();
    }
}

async function createRenderer(element: React.ReactElement) {
    let renderer: ReturnType<typeof TestRenderer.create>;
    await act(async () => {
        renderer = TestRenderer.create(element);
    });
    return renderer!;
}

async function layoutDefaultScrollView(renderer: ReturnType<typeof TestRenderer.create>) {
    await act(async () => {
        const props = renderer.root.findByType("AnimatedScrollView").props as {
            onLayout?: (event: typeof layoutEvent) => void;
        };
        props.onLayout?.(layoutEvent);
    });
}

async function cleanupRenderer(renderer: ReturnType<typeof TestRenderer.create>) {
    await act(async () => {
        renderer.unmount();
    });
}

beforeEach(() => {
    mock.restore();
    registerBaseModuleMocks();
    registerDatasetsMocks();
});

afterEach(() => {
    mock.restore();
    registerBaseModuleMocks();
});

describe("LegendListDatasets", () => {
    it("keeps hidden dataset rows mounted when switching active keys with visibility hiding", async () => {
        const events: string[] = [];
        const Row = ({ id, label }: { id: string; label: string }) => {
            React.useEffect(() => {
                events.push(`mount:${id}`);
                return () => {
                    events.push(`unmount:${id}`);
                };
            }, [id]);

            return <Text>{label}</Text>;
        };

        const datasets = [
            {
                data: [{ id: "spot-1", label: "Spot" }],
                key: "spot",
            },
            {
                data: [{ id: "futures-1", label: "Futures" }],
                key: "futures",
            },
        ];

        const { LegendListDatasets } = await import("../../src/components/LegendListDatasets?stable-shell");
        const renderer = await createRenderer(
            <LegendListDatasets
                activeDatasetKey="spot"
                datasets={datasets}
                estimatedItemSize={50}
                getFixedItemSize={() => 50}
                inactiveDatasetBehavior="hide"
                keyExtractor={(item, _index, datasetKey) => `${datasetKey}:${item.id}`}
                recycleItems={false}
                renderItem={({ item }) => <Row id={item.id} label={item.label} />}
                staggerMountMs={0}
            />,
        );

        await flushFrames();
        await layoutDefaultScrollView(renderer);
        await flushFrames(8);

        expect(getDatasetLayerOpacityValues(renderer)).toContain(1);
        expect(getDatasetLayerOpacityValues(renderer)).toContain(0);
        expect(getRenderedLabels(renderer)).toContain("Spot");
        expect(getRenderedLabels(renderer)).toContain("Futures");
        expect(events).toEqual(["mount:spot-1", "mount:futures-1"]);

        await act(async () => {
            renderer.update(
                <LegendListDatasets
                    activeDatasetKey="futures"
                    datasets={datasets}
                    estimatedItemSize={50}
                    getFixedItemSize={() => 50}
                    inactiveDatasetBehavior="hide"
                    keyExtractor={(item, _index, datasetKey) => `${datasetKey}:${item.id}`}
                    recycleItems={false}
                    renderItem={({ item }) => <Row id={item.id} label={item.label} />}
                    staggerMountMs={0}
                />,
            );
        });
        await flushFrames(4);

        expect(getDatasetLayerOpacityValues(renderer)).toContain(1);
        expect(getDatasetLayerOpacityValues(renderer)).toContain(0);
        expect(events).toEqual(["mount:spot-1", "mount:futures-1"]);
        expect(getContainerLayerOpacityValues(renderer).every((opacity) => opacity === 1)).toBe(true);

        await cleanupRenderer(renderer);
    });

    it("pauses inactive dataset layers with React Activity", async () => {
        const datasets = [
            {
                data: [{ id: "spot-1", label: "Spot" }],
                key: "spot",
            },
            {
                data: [{ id: "futures-1", label: "Futures" }],
                key: "futures",
            },
        ];

        const { LegendListDatasets } = await import("../../src/components/LegendListDatasets?pause-activity");
        const renderer = await createRenderer(
            <LegendListDatasets
                activeDatasetKey="spot"
                datasets={datasets}
                estimatedItemSize={50}
                getFixedItemSize={() => 50}
                keyExtractor={(item, _index, datasetKey) => `${datasetKey}:${item.id}`}
                recycleItems={false}
                renderItem={({ datasetKey, item }) => <Text>{`${datasetKey}:${item.label}`}</Text>}
                staggerMountMs={0}
            />,
        );

        await flushFrames();
        await layoutDefaultScrollView(renderer);
        await flushFrames(8);

        expect(getRenderedLabels(renderer)).toContain("spot:Spot");
        expect(getRenderedLabels(renderer)).not.toContain("futures:Futures");

        await act(async () => {
            renderer.update(
                <LegendListDatasets
                    activeDatasetKey="futures"
                    datasets={datasets}
                    estimatedItemSize={50}
                    getFixedItemSize={() => 50}
                    keyExtractor={(item, _index, datasetKey) => `${datasetKey}:${item.id}`}
                    recycleItems={false}
                    renderItem={({ datasetKey, item }) => <Text>{`${datasetKey}:${item.label}`}</Text>}
                    staggerMountMs={0}
                />,
            );
        });
        await flushFrames(4);

        expect(getRenderedLabels(renderer)).toContain("futures:Futures");
        expect(getRenderedLabels(renderer)).not.toContain("spot:Spot");

        await cleanupRenderer(renderer);
    });

    it("renders ListEmptyComponent for the active dataset only", async () => {
        const datasets = [
            {
                data: [] as Array<{ id: string; label: string }>,
                key: "empty",
            },
            {
                data: [{ id: "spot-1", label: "Spot" }],
                key: "spot",
            },
        ];

        const { LegendListDatasets } = await import("../../src/components/LegendListDatasets?active-empty");
        const renderer = await createRenderer(
            <LegendListDatasets
                activeDatasetKey="empty"
                datasets={datasets}
                estimatedItemSize={50}
                inactiveDatasetBehavior="hide"
                keyExtractor={(item) => item.id}
                ListEmptyComponent={<Text>Empty active dataset</Text>}
                recycleItems={false}
                renderItem={({ item }) => <Text>{item.label}</Text>}
                staggerMountMs={0}
            />,
        );

        expect(getRenderedLabels(renderer)).toContain("Empty active dataset");

        await act(async () => {
            renderer.update(
                <LegendListDatasets
                    activeDatasetKey="spot"
                    datasets={datasets}
                    estimatedItemSize={50}
                    inactiveDatasetBehavior="hide"
                    keyExtractor={(item) => item.id}
                    ListEmptyComponent={<Text>Empty active dataset</Text>}
                    recycleItems={false}
                    renderItem={({ item }) => <Text>{item.label}</Text>}
                    staggerMountMs={0}
                />,
            );
        });

        expect(getRenderedLabels(renderer)).not.toContain("Empty active dataset");

        await cleanupRenderer(renderer);
    });

    it("renders ListEmptyComponent when there are no datasets", async () => {
        const { LegendListDatasets } = await import("../../src/components/LegendListDatasets?no-datasets");
        const renderer = await createRenderer(
            <LegendListDatasets
                activeDatasetKey=""
                datasets={[]}
                estimatedItemSize={50}
                ListEmptyComponent={<Text>No datasets</Text>}
                recycleItems={false}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
                staggerMountMs={0}
            />,
        );

        expect(getRenderedLabels(renderer)).toContain("No datasets");

        await cleanupRenderer(renderer);
    });

    it("passes dataset keys to shared item callbacks", async () => {
        const callbackEvents = new Set<string>();
        const datasets = [
            {
                data: [{ id: "spot-1", label: "Spot" }],
                key: "spot",
            },
            {
                data: [{ id: "futures-1", label: "Futures" }],
                key: "futures",
            },
        ];

        const { LegendListDatasets } = await import("../../src/components/LegendListDatasets?dataset-callbacks");
        const renderer = await createRenderer(
            <LegendListDatasets
                activeDatasetKey="spot"
                datasets={datasets}
                getEstimatedItemSize={(item, index, type, datasetKey) => {
                    callbackEvents.add(`estimated:${datasetKey}:${type}:${item.id}:${index}`);
                    return 50;
                }}
                getFixedItemSize={(item, index, type, datasetKey) => {
                    callbackEvents.add(`fixed:${datasetKey}:${type}:${item.id}:${index}`);
                    return undefined;
                }}
                getItemType={(item, index, datasetKey) => {
                    callbackEvents.add(`type:${datasetKey}:${item.id}:${index}`);
                    return datasetKey === "spot" ? "spot-row" : "futures-row";
                }}
                inactiveDatasetBehavior="hide"
                keyExtractor={(item, index, datasetKey) => {
                    callbackEvents.add(`key:${datasetKey}:${item.id}:${index}`);
                    return `${datasetKey}:${item.id}`;
                }}
                recycleItems={false}
                renderItem={({ datasetKey, item, type }) => {
                    callbackEvents.add(`render:${datasetKey}:${type}:${item.id}`);
                    return <Text>{`${datasetKey}:${type}:${item.label}`}</Text>;
                }}
                staggerMountMs={0}
            />,
        );

        await flushFrames();
        await layoutDefaultScrollView(renderer);
        await flushFrames(8);

        expect(callbackEvents.has("key:spot:spot-1:0")).toBe(true);
        expect(callbackEvents.has("key:futures:futures-1:0")).toBe(true);
        expect(callbackEvents.has("type:spot:spot-1:0")).toBe(true);
        expect(callbackEvents.has("type:futures:futures-1:0")).toBe(true);
        expect(callbackEvents.has("fixed:spot:spot-row:spot-1:0")).toBe(true);
        expect(callbackEvents.has("fixed:futures:futures-row:futures-1:0")).toBe(true);
        expect(callbackEvents.has("estimated:spot:spot-row:spot-1:0")).toBe(true);
        expect(callbackEvents.has("estimated:futures:futures-row:futures-1:0")).toBe(true);
        expect(callbackEvents.has("render:spot:spot-row:spot-1")).toBe(true);
        expect(callbackEvents.has("render:futures:futures-row:futures-1")).toBe(true);
        expect(getRenderedLabels(renderer)).toContain("spot:spot-row:Spot");
        expect(getRenderedLabels(renderer)).toContain("futures:futures-row:Futures");

        await cleanupRenderer(renderer);
    });

    it("shares the outer ScrollView ref with dataset imperative handles", async () => {
        const scrollRef = React.createRef<LegendListRef>();
        const scrollMethods = {
            flashScrollIndicators: () => {},
            getScrollableNode: () => ({}),
            getScrollResponder: () => null,
            measure: (cb: (x: number, y: number, width: number, height: number) => void) => cb(0, 0, 320, 200),
            scrollTo: () => {},
            scrollToEnd: () => {},
        };
        const ScrollHost = React.forwardRef<typeof scrollMethods, React.ComponentProps<typeof View>>(
            ({ children, ...props }, ref) => {
                React.useImperativeHandle(ref, () => scrollMethods, []);
                return <View {...props}>{children}</View>;
            },
        );
        const datasets = [
            {
                data: [{ id: "spot-1", label: "Spot" }],
                key: "spot",
            },
        ];

        const { LegendListDatasets } = await import("../../src/components/LegendListDatasets?shared-ref");
        const renderer = await createRenderer(
            <LegendListDatasets
                activeDatasetKey="spot"
                datasets={datasets}
                estimatedItemSize={50}
                keyExtractor={(item) => item.id}
                recycleItems={false}
                ref={scrollRef}
                renderItem={({ item }) => <Text>{item.label}</Text>}
                renderScrollComponent={(props) => <ScrollHost {...props} />}
                staggerMountMs={0}
            />,
        );

        await flushFrames();

        expect(scrollRef.current?.getNativeScrollRef()).toBe(scrollMethods);

        await cleanupRenderer(renderer);
    });

    it("does not pass list-only props to the shared scroll component", async () => {
        let scrollProps: Record<string, unknown> | undefined;
        const scrollMethods = {
            flashScrollIndicators: () => {},
            getScrollableNode: () => ({}),
            getScrollResponder: () => null,
            measure: (cb: (x: number, y: number, width: number, height: number) => void) => cb(0, 0, 320, 200),
            scrollTo: () => {},
            scrollToEnd: () => {},
        };
        const ScrollHost = React.forwardRef<typeof scrollMethods, React.ComponentProps<typeof View>>(
            ({ children, ...props }, ref) => {
                scrollProps = props;
                React.useImperativeHandle(ref, () => scrollMethods, []);
                return <View {...props}>{children}</View>;
            },
        );
        const datasets = [
            {
                data: [{ id: "spot-1", label: "Spot" }],
                key: "spot",
            },
        ];

        const { LegendListDatasets } = await import("../../src/components/LegendListDatasets?scroll-props");
        const renderer = await createRenderer(
            <LegendListDatasets
                activeDatasetKey="spot"
                alwaysRender={{ top: 1 }}
                contentInset={{ bottom: 4, left: 3, right: 2, top: 1 }}
                datasets={datasets}
                estimatedItemSize={50}
                keyExtractor={(item) => item.id}
                onEndReached={() => {}}
                onViewableItemsChanged={() => {}}
                recycleItems={false}
                renderItem={({ item }) => <Text>{item.label}</Text>}
                renderScrollComponent={(props) => <ScrollHost {...props} />}
                showsVerticalScrollIndicator={false}
                staggerMountMs={0}
                stickyHeaderIndices={[0]}
                viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
            />,
        );

        await flushFrames();

        expect(scrollProps?.contentInset).toEqual({ bottom: 4, left: 3, right: 2, top: 1 });
        expect(scrollProps?.showsVerticalScrollIndicator).toBe(false);
        expect(scrollProps).not.toHaveProperty("alwaysRender");
        expect(scrollProps).not.toHaveProperty("onEndReached");
        expect(scrollProps).not.toHaveProperty("onViewableItemsChanged");
        expect(scrollProps).not.toHaveProperty("stickyHeaderIndices");
        expect(scrollProps).not.toHaveProperty("viewabilityConfig");

        await cleanupRenderer(renderer);
    });

    it("does not emit metrics for hidden inactive layers", async () => {
        const metrics: Array<{ footerSize: number; headerSize: number }> = [];
        const datasets = [
            {
                data: [{ id: "spot-1", label: "Spot" }],
                key: "spot",
            },
            {
                data: [{ id: "futures-1", label: "Futures" }],
                key: "futures",
            },
        ];

        const { LegendListDatasets } = await import("../../src/components/LegendListDatasets?active-metrics");
        const renderer = await createRenderer(
            <LegendListDatasets
                activeDatasetKey="spot"
                datasets={datasets}
                estimatedItemSize={50}
                inactiveDatasetBehavior="hide"
                keyExtractor={(item) => item.id}
                onMetricsChange={(value) => metrics.push(value)}
                recycleItems={false}
                renderItem={({ item }) => <Text>{item.label}</Text>}
                staggerMountMs={0}
            />,
        );

        await flushFrames();

        expect(metrics).toHaveLength(1);

        await act(async () => {
            renderer.update(
                <LegendListDatasets
                    activeDatasetKey="futures"
                    datasets={datasets}
                    estimatedItemSize={50}
                    inactiveDatasetBehavior="hide"
                    keyExtractor={(item) => item.id}
                    onMetricsChange={(value) => metrics.push(value)}
                    recycleItems={false}
                    renderItem={({ item }) => <Text>{item.label}</Text>}
                    staggerMountMs={0}
                />,
            );
        });
        await flushFrames();

        expect(metrics).toHaveLength(2);

        await cleanupRenderer(renderer);
    });
});
