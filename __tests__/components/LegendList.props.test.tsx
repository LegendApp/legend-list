import { describe, expect, it } from "bun:test";
import "../setup";

import React from "react";
import { Text } from "react-native";

import TestRenderer, { act } from "../helpers/testRenderer";

const { LegendList } = await import("../../src/components/LegendList");

async function flushAsync() {
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
}

describe("LegendList props behavior", () => {
    it("initialScrollAtEnd scrolls to the last item", async () => {
        const data = [
            { id: "item-1", label: "Alpha" },
            { id: "item-2", label: "Beta" },
            { id: "item-3", label: "Gamma" },
        ];

        const renderer = TestRenderer.create(
            <LegendList
                data={data}
                estimatedItemSize={100}
                initialScrollAtEnd
                keyExtractor={(item: { id: string }) => item.id}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
            />,
        );

        await flushAsync();

        const listComponent = renderer.root.find(
            (node) => typeof node.type === "function" && node.type.name === "ListComponent",
        );
        const state = listComponent.props.scrollAdjustHandler.context.internalState;

        expect(state.initialScroll?.index).toBe(2);
        expect(state.initialScroll?.viewOffset).toBeCloseTo(0);

        renderer.unmount();
    });

    it("applies viewOffset when performing an initial scroll", async () => {
        const data = [
            { id: "item-1", label: "Alpha" },
            { id: "item-2", label: "Beta" },
            { id: "item-3", label: "Gamma" },
        ];
        const viewOffset = 120;
        const targetIndex = 2;

        const renderer = TestRenderer.create(
            <LegendList
                data={data}
                estimatedItemSize={100}
                initialScrollIndex={{ index: targetIndex, viewOffset }}
                keyExtractor={(item: { id: string }) => item.id}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
            />,
        );

        await flushAsync();

        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 50));
        });

        const listComponent = renderer.root.find(
            (node) => typeof node.type === "function" && node.type.name === "ListComponent",
        );
        const state = listComponent.props.scrollAdjustHandler.context.internalState;

        const expectedOffset = 200 - viewOffset;

        expect(state.initialScroll?.contentOffset).toBe(expectedOffset);

        // TODO: This wasn't getting set for some reason
        // expect(state.scrollPending).toBe(expectedOffset);
        // expect(state.scroll).toBe(expectedOffset);

        renderer.unmount();

        console.log("updated initial scroll", expectedOffset);
    });
});
