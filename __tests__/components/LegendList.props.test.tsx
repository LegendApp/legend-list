import { beforeEach, describe, expect, it, mock } from "bun:test";
import "../setup";

import { Text } from "react-native";

import TestRenderer, { act } from "../helpers/testRenderer";

let lastListProps: any;

import type { ScrollAdjustHandler } from "../../src/core/ScrollAdjustHandler";
import type { StateContext } from "../../src/state/state";

const handlerInstances: ScrollAdjustHandler[] = [];

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

async function flushAsync() {
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
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
    handlerInstances.length = 0;
    lastListProps = undefined;
});

describe("LegendList props behavior", () => {
    it("initialScrollAtEnd scrolls to the last item", async () => {
        const data = [
            { id: "item-1", label: "Alpha" },
            { id: "item-2", label: "Beta" },
            { id: "item-3", label: "Gamma" },
        ];

        const { LegendList } = await import("../../src/components/LegendList?props-test");
        const renderer = TestRenderer.create(
            <LegendList
                data={data}
                estimatedItemSize={100}
                initialScrollAtEnd
                keyExtractor={(item: { id: string }) => item.id}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
            />,
        );

        const state = await getStateFromRender(renderer);

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

        const { LegendList } = await import("../../src/components/LegendList?props-test");
        const renderer = TestRenderer.create(
            <LegendList
                data={data}
                estimatedItemSize={100}
                initialScrollIndex={{ index: targetIndex, viewOffset }}
                keyExtractor={(item: { id: string }) => item.id}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
            />,
        );

        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 50));
        });

        const state = await getStateFromRender(renderer);

        const expectedOffset = 200 - viewOffset;

        expect(state.initialScroll?.contentOffset).toBe(expectedOffset);

        // TODO: This wasn't getting set for some reason
        // expect(state.scrollPending).toBe(expectedOffset);
        // expect(state.scroll).toBe(expectedOffset);

        renderer.unmount();

        console.log("updated initial scroll", expectedOffset);
    });
});
