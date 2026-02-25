import { beforeEach, describe, expect, it, mock } from "bun:test";
import "../setup";
import { Text } from "react-native";

import { act, render } from "../helpers/testingLibrary";

let lastListProps: any;
let requestAdjustCalls: number[] = [];

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

mock.module("@/utils/requestAdjust", () => ({
    requestAdjust: (_ctx: unknown, diff: number) => {
        requestAdjustCalls.push(diff);
    },
}));

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
    handlerInstances.length = 0;
    lastListProps = undefined;
    requestAdjustCalls = [];
});

describe("LegendList props behavior", () => {
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

    it("recomputes initialScrollAtEnd viewOffset after footer layout", async () => {
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
                ListFooterComponent={<Text>Footer</Text>}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
                style={{ paddingBottom: 6 }}
            />,
        );

        const state = await getStateFromRender();

        expect(state.initialScroll?.viewOffset).toBeCloseTo(-6);

        await act(async () => {
            lastListProps?.onLayoutFooter?.({ height: 40, width: 320, x: 0, y: 0 }, true);
        });
        await flushAsync();

        expect(state.initialScroll?.viewOffset).toBeCloseTo(-46);

        rendered.unmount();
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
        const rendered = render(
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

        const state = await getStateFromRender();

        const expectedOffset = 200 - viewOffset;

        expect(state.initialScroll?.contentOffset).toBe(expectedOffset);

        // TODO: This wasn't getting set for some reason
        // expect(state.scrollPending).toBe(expectedOffset);
        // expect(state.scroll).toBe(expectedOffset);

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
        const layoutEvent = {
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
            lastListProps?.onLayout?.(layoutEvent as any);
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
