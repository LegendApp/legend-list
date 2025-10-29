import { describe, expect, it } from "bun:test";
import "../setup";

import React from "react";
import TestRenderer, { act } from "../helpers/testRenderer";
import { Text } from "react-native";

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

        expect(state.initialScroll).toEqual({ index: 2, viewOffset: 0 });

        renderer.unmount();
    });
});
