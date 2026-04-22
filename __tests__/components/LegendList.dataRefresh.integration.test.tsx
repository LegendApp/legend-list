import * as React from "react";
import { Text } from "react-native";

import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import type { StateContext } from "../../src/state/state";
import { useArr$ } from "../../src/state/state";
import TestRenderer, { act } from "../helpers/testRenderer";
import { registerBaseModuleMocks } from "../setup";

const layoutEvent = {
    nativeEvent: { layout: { height: 200, width: 320, x: 0, y: 0 } },
};

let lastListProps: any;
const handlerInstances: Array<{ context: StateContext }> = [];

function IntegrationContainer({ getRenderedItem, id }: { getRenderedItem: (key: string) => any; id: number }) {
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

function IntegrationListComponent(props: any) {
    lastListProps = props;
    const [numContainersPooled = 0] = useArr$(["numContainersPooled"]);

    if (!props.canRender) {
        return null;
    }

    return (
        <>
            {Array.from({ length: numContainersPooled }, (_, id) => (
                <IntegrationContainer getRenderedItem={props.getRenderedItem} id={id} key={id} />
            ))}
        </>
    );
}

function registerIntegrationMocks() {
    mock.module("@/components/ListComponent", () => ({
        ListComponent: IntegrationListComponent,
    }));

    mock.module("@/core/ScrollAdjustHandler", () => ({
        ScrollAdjustHandler: class {
            context: StateContext;

            constructor(ctx: StateContext) {
                this.context = ctx;
                handlerInstances.push(this as { context: StateContext });
            }

            requestAdjust() {}
            setMounted() {}
            getAdjust() {
                return 0;
            }
        },
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

async function cleanupRenderer(renderer: ReturnType<typeof TestRenderer.create>) {
    await act(async () => {
        renderer.unmount();
    });
}

async function getStateFromRender(renderer: ReturnType<typeof TestRenderer.create>) {
    for (let i = 0; i < 5; i++) {
        const handler =
            lastListProps?.scrollAdjustHandler ??
            renderer.root.findAll((node) => node.props?.scrollAdjustHandler)[0]?.props?.scrollAdjustHandler ??
            handlerInstances.at(-1);
        if (handler) {
            return (handler as any).context.state;
        }
        await flushAsync();
    }

    throw new Error("scrollAdjustHandler not found after retries");
}

beforeEach(() => {
    mock.restore();
    registerBaseModuleMocks();
    registerIntegrationMocks();
    handlerInstances.length = 0;
    lastListProps = undefined;
});

afterEach(() => {
    handlerInstances.length = 0;
    lastListProps = undefined;
});

describe("LegendList data refresh integration", () => {
    it("updates rendered content for same-key replacements and increments dataChangeEpoch", async () => {
        const data = [{ id: "item-1", label: "Alpha" }];

        const { LegendList } = await import("../../src/components/LegendList?data-refresh-integration");
        const renderer = await createRenderer(
            <LegendList
                data={data}
                drawDistance={0}
                estimatedItemSize={100}
                getFixedItemSize={() => 100}
                keyExtractor={(item: { id: string }) => item.id}
                recycleItems={false}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
            />,
        );

        await flushFrames();
        await act(async () => {
            lastListProps?.onLayout?.(layoutEvent as any);
        });
        await flushFrames(8);

        const state = await getStateFromRender(renderer);
        const initialDataChangeEpoch = state.dataChangeEpoch;

        expect(getRenderedLabels(renderer)).toContain("Alpha");

        await act(async () => {
            renderer.update(
                <LegendList
                    data={[{ id: "item-1", label: "Beta" }]}
                    drawDistance={0}
                    estimatedItemSize={100}
                    getFixedItemSize={() => 100}
                    keyExtractor={(item: { id: string }) => item.id}
                    recycleItems={false}
                    renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
                />,
            );
        });
        await flushFrames(8);

        const labels = getRenderedLabels(renderer);
        expect(labels).toContain("Beta");
        expect(labels).not.toContain("Alpha");
        expect(state.dataChangeEpoch).toBe(initialDataChangeEpoch + 1);

        await cleanupRenderer(renderer);
    });

    it("keeps semantically equal same-key replacements on the cheap path when itemsAreEqual returns true", async () => {
        const data = [{ id: "item-1", label: "Alpha", version: 1 }];

        const { LegendList } = await import("../../src/components/LegendList?data-refresh-integration");
        const renderer = await createRenderer(
            <LegendList
                data={data}
                drawDistance={0}
                estimatedItemSize={100}
                getFixedItemSize={() => 100}
                itemsAreEqual={(previous, next) => previous.id === next.id && previous.label === next.label}
                keyExtractor={(item: { id: string }) => item.id}
                recycleItems={false}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
            />,
        );

        await flushFrames();
        await act(async () => {
            lastListProps?.onLayout?.(layoutEvent as any);
        });
        await flushFrames(8);

        const state = await getStateFromRender(renderer);
        const initialDataChangeEpoch = state.dataChangeEpoch;

        await act(async () => {
            renderer.update(
                <LegendList
                    data={[{ id: "item-1", label: "Alpha", version: 2 }]}
                    drawDistance={0}
                    estimatedItemSize={100}
                    getFixedItemSize={() => 100}
                    itemsAreEqual={(previous, next) => previous.id === next.id && previous.label === next.label}
                    keyExtractor={(item: { id: string }) => item.id}
                    recycleItems={false}
                    renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
                />,
            );
        });
        await flushFrames(8);

        const labels = getRenderedLabels(renderer);
        expect(labels).toContain("Alpha");
        expect(state.dataChangeEpoch).toBe(initialDataChangeEpoch);

        await cleanupRenderer(renderer);
    });
});
