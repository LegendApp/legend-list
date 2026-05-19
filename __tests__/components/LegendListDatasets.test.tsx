import * as React from "react";
import { Text, View } from "react-native";

import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { useArr$ } from "../../src/state/state";
import TestRenderer, { act } from "../helpers/testRenderer";
import { registerBaseModuleMocks } from "../setup";

const layoutEvent = {
    nativeEvent: { layout: { height: 200, width: 320, x: 0, y: 0 } },
};

function TestContainer({ getRenderedItem, id }: { getRenderedItem: (key: string) => any; id: number }) {
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

function TestContainers({ getRenderedItem }: { getRenderedItem: (key: string) => any }) {
    const [numContainersPooled = 0] = useArr$(["numContainersPooled"]);

    return (
        <>
            {Array.from({ length: numContainersPooled }, (_, id) => (
                <TestContainer getRenderedItem={getRenderedItem} id={id} key={id} />
            ))}
        </>
    );
}

function registerDatasetsMocks() {
    mock.module("@/components/Containers", () => ({
        Containers: TestContainers,
    }));
}

function collectTextFromTree(node: any, values: string[] = []) {
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
        renderer.root.findByType("AnimatedScrollView").props.onLayout?.(layoutEvent as any);
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
    it("keeps hidden dataset rows mounted when switching active keys with display hiding", async () => {
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
                keyExtractor: (item: { id: string }) => item.id,
                renderItem: ({ item }: { item: { id: string; label: string } }) => (
                    <Row id={item.id} label={item.label} />
                ),
            },
            {
                data: [{ id: "futures-1", label: "Futures" }],
                key: "futures",
                keyExtractor: (item: { id: string }) => item.id,
                renderItem: ({ item }: { item: { id: string; label: string } }) => (
                    <Row id={item.id} label={item.label} />
                ),
            },
        ];

        const { LegendListDatasets } = await import("../../src/components/LegendListDatasets?stable-shell");
        const renderer = await createRenderer(
            <LegendListDatasets
                activeKey="spot"
                datasets={datasets}
                estimatedItemSize={50}
                getFixedItemSize={() => 50}
                inactiveBehavior="hide"
                recycleItems={false}
                staggerMountMs={0}
            />,
        );

        await flushFrames();
        await layoutDefaultScrollView(renderer);
        await flushFrames(8);

        expect(getRenderedLabels(renderer)).toContain("Spot");
        expect(getRenderedLabels(renderer)).toContain("Futures");
        expect(events).toEqual(["mount:spot-1", "mount:futures-1"]);

        await act(async () => {
            renderer.update(
                <LegendListDatasets
                    activeKey="futures"
                    datasets={datasets}
                    estimatedItemSize={50}
                    getFixedItemSize={() => 50}
                    inactiveBehavior="hide"
                    recycleItems={false}
                    staggerMountMs={0}
                />,
            );
        });
        await flushFrames(4);

        expect(events).toEqual(["mount:spot-1", "mount:futures-1"]);

        await cleanupRenderer(renderer);
    });

    it("renders ListEmptyComponent for the active dataset only", async () => {
        const datasets = [
            {
                data: [] as Array<{ id: string; label: string }>,
                key: "empty",
                keyExtractor: (item: { id: string }) => item.id,
                renderItem: ({ item }: { item: { label: string } }) => <Text>{item.label}</Text>,
            },
            {
                data: [{ id: "spot-1", label: "Spot" }],
                key: "spot",
                keyExtractor: (item: { id: string }) => item.id,
                renderItem: ({ item }: { item: { label: string } }) => <Text>{item.label}</Text>,
            },
        ];

        const { LegendListDatasets } = await import("../../src/components/LegendListDatasets?active-empty");
        const renderer = await createRenderer(
            <LegendListDatasets
                activeKey="empty"
                datasets={datasets}
                estimatedItemSize={50}
                inactiveBehavior="hide"
                ListEmptyComponent={<Text>Empty active dataset</Text>}
                recycleItems={false}
                staggerMountMs={0}
            />,
        );

        expect(getRenderedLabels(renderer)).toContain("Empty active dataset");

        await act(async () => {
            renderer.update(
                <LegendListDatasets
                    activeKey="spot"
                    datasets={datasets}
                    estimatedItemSize={50}
                    inactiveBehavior="hide"
                    ListEmptyComponent={<Text>Empty active dataset</Text>}
                    recycleItems={false}
                    staggerMountMs={0}
                />,
            );
        });

        expect(getRenderedLabels(renderer)).not.toContain("Empty active dataset");

        await cleanupRenderer(renderer);
    });

    it("shares the outer ScrollView ref with dataset imperative handles", async () => {
        const scrollRef = React.createRef<any>();
        const scrollMethods = {
            flashScrollIndicators: () => {},
            getScrollableNode: () => ({}),
            getScrollResponder: () => null,
            measure: (cb: (x: number, y: number, width: number, height: number) => void) => cb(0, 0, 320, 200),
            scrollTo: () => {},
            scrollToEnd: () => {},
        };
        const ScrollHost = React.forwardRef<any, any>(({ children, ...props }, ref) => {
            React.useImperativeHandle(ref, () => scrollMethods, []);
            return <View {...props}>{children}</View>;
        });
        const datasets = [
            {
                data: [{ id: "spot-1", label: "Spot" }],
                key: "spot",
                keyExtractor: (item: { id: string }) => item.id,
                renderItem: ({ item }: { item: { label: string } }) => <Text>{item.label}</Text>,
            },
        ];

        const { LegendListDatasets } = await import("../../src/components/LegendListDatasets?shared-ref");
        const renderer = await createRenderer(
            <LegendListDatasets
                activeKey="spot"
                datasets={datasets}
                estimatedItemSize={50}
                recycleItems={false}
                ref={scrollRef}
                renderScrollComponent={(props) => <ScrollHost {...props} />}
                staggerMountMs={0}
            />,
        );

        await flushFrames();

        expect(scrollRef.current?.getNativeScrollRef()).toBe(scrollMethods);

        await cleanupRenderer(renderer);
    });
});
