import { describe, expect, it } from "bun:test";
import "../setup";

import React from "react";
import { Text } from "react-native";

import { LegendList } from "../../src/components/LegendList";
import TestRenderer, { act } from "../helpers/testRenderer";

async function flushAsync() {
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
}

const layoutEvent = { nativeEvent: { layout: { height: 600, width: 320, x: 0, y: 0 } } };

describe("LegendList dataVersion behavior", () => {
    it("marks data change when dataVersion updates with stable array reference", async () => {
        const data = [{ id: "item-1", label: "Alpha" }];

        const renderer = TestRenderer.create(
            <LegendList
                data={data}
                dataVersion={0}
                estimatedItemSize={100}
                keyExtractor={(item: { id: string }) => item.id}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
            />,
        );

        const listComponent = renderer.root.find(
            (node) => typeof node.type === "function" && node.type.name === "ListComponent",
        );

        await act(async () => {
            listComponent.props.onLayout(layoutEvent);
        });
        await flushAsync();

        const state = listComponent.props.scrollAdjustHandler.context.internalState;
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

        renderer.unmount();
    });

    it("skips data change handling when dataVersion stays the same", async () => {
        const data = [{ id: "item-1", label: "Alpha" }];

        const renderer = TestRenderer.create(
            <LegendList
                data={data}
                dataVersion={2}
                estimatedItemSize={100}
                keyExtractor={(item: { id: string }) => item.id}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
            />,
        );

        const listComponent = renderer.root.find(
            (node) => typeof node.type === "function" && node.type.name === "ListComponent",
        );

        await act(async () => {
            listComponent.props.onLayout(layoutEvent);
        });
        await flushAsync();

        const state = listComponent.props.scrollAdjustHandler.context.internalState;
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

        renderer.unmount();
    });
});
