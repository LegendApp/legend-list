import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import "../setup";

import type React from "react";
import { Text } from "react-native";

import TestRenderer, { act } from "../helpers/testRenderer";

let lastListProps: any;

import type { ScrollAdjustHandler } from "../../src/core/ScrollAdjustHandler";
import type { StateContext } from "../../src/state/state";

const handlerInstances: ScrollAdjustHandler[] = [];
let dateNowSpy: ReturnType<typeof spyOn> | undefined;
let nowValue = 0;

function registerLegendListDataVersionMocks() {
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
}

async function flushAsync() {
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
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

const layoutEvent = { nativeEvent: { layout: { height: 600, width: 320, x: 0, y: 0 } } };

beforeEach(() => {
    registerLegendListDataVersionMocks();
    handlerInstances.length = 0;
    lastListProps = undefined;
    nowValue = 1000;
    dateNowSpy?.mockRestore?.();
    dateNowSpy = spyOn(Date, "now").mockImplementation(() => ++nowValue);
});

afterEach(() => {
    dateNowSpy?.mockRestore?.();
    dateNowSpy = undefined;
});

describe("LegendList dataVersion behavior", () => {
    it("marks data change when dataVersion updates with stable array reference", async () => {
        const data = [{ id: "item-1", label: "Alpha" }];

        const { LegendList } = await import("../../src/components/LegendList?dataversion-test");
        const renderer = await createRenderer(
            <LegendList
                data={data}
                dataVersion={0}
                estimatedItemSize={100}
                keyExtractor={(item: { id: string }) => item.id}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
            />,
        );

        await flushAsync();
        await act(async () => {
            lastListProps?.onLayout?.(layoutEvent as any);
        });
        const state = await getStateFromRender(renderer);
        const initialVersion = state.props.dataVersion;
        const initialLastBatching = state.lastBatchingAction;

        expect(initialVersion).toBe(0);

        data[0] = { ...data[0], label: "Beta" };

        await act(async () => {
            renderer.update(
                <LegendList
                    data={data}
                    dataVersion={1}
                    estimatedItemSize={100}
                    keyExtractor={(item: { id: string }) => item.id}
                    renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
                />,
            );
        });
        await flushAsync();

        expect(state.props.dataVersion).toBe(1);
        expect(state.lastBatchingAction).toBeGreaterThan(initialLastBatching);

        await cleanupRenderer(renderer);
    });

    it("skips data change handling when dataVersion stays the same", async () => {
        const data = [{ id: "item-1", label: "Alpha" }];

        const { LegendList } = await import("../../src/components/LegendList?dataversion-test");
        const renderer = await createRenderer(
            <LegendList
                data={data}
                dataVersion={2}
                estimatedItemSize={100}
                keyExtractor={(item: { id: string }) => item.id}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
            />,
        );

        await flushAsync();
        await act(async () => {
            lastListProps?.onLayout?.(layoutEvent as any);
        });
        const state = await getStateFromRender(renderer);
        const initialVersion = state.props.dataVersion;
        const initialLastBatching = state.lastBatchingAction;

        expect(initialVersion).toBe(2);

        data[0] = { ...data[0], label: "Beta" };

        await act(async () => {
            renderer.update(
                <LegendList
                    data={data}
                    dataVersion={2}
                    estimatedItemSize={100}
                    keyExtractor={(item: { id: string }) => item.id}
                    renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
                />,
            );
        });
        await flushAsync();

        expect(state.props.dataVersion).toBe(initialVersion);
        expect(state.lastBatchingAction).toBe(initialLastBatching);

        await cleanupRenderer(renderer);
    });
});
