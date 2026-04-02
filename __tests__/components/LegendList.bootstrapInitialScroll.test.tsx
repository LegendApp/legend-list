import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import "../setup";
import { Text } from "react-native";

import { setInitialScrollStrategyForTests } from "../../src/components/bootstrapInitialScroll";
import { finishScrollTo } from "../../src/core/finishScrollTo";
import { Platform } from "../../src/platform/Platform";
import type { StateContext } from "../../src/state/state";
import type { ScrollAdjustHandler } from "../../src/core/ScrollAdjustHandler";
import { act, render } from "../helpers/testingLibrary";

let lastListProps: any;
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
            commitPendingAdjust() {}
        },
    };
});

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

function seedMeasuredLayout(state: any, count: number, size: number) {
    state.scrollLength = 200;
    for (let i = 0; i < count; i++) {
        const id = state.props.keyExtractor?.(state.props.data[i], i) ?? `item_${i}`;
        state.idCache[i] = id;
        state.indexByKey.set(id, i);
        state.positions[i] = i * size;
        state.sizes.set(id, size);
        state.sizesKnown.set(id, size);
    }
}

beforeEach(() => {
    handlerInstances.length = 0;
    lastListProps = undefined;
    Platform.OS = "ios";
    setInitialScrollStrategyForTests("bootstrapReveal");
});

afterEach(() => {
    setInitialScrollStrategyForTests(undefined);
});

describe("LegendList bootstrap initial scroll", () => {
    it("short-circuits zero-valued targets without starting bootstrap", async () => {
        const data = [{ id: "item-0", label: "Item 0" }];
        const { LegendList } = await import("../../src/components/LegendList?bootstrap-zero");

        render(
            <LegendList
                data={data}
                estimatedItemSize={50}
                estimatedListSize={{ height: 200, width: 320 }}
                initialScrollIndex={0}
                keyExtractor={(item: { id: string }) => item.id}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
            />,
        );

        const state = await getStateFromRender();

        expect(state.didFinishInitialScroll).toBe(true);
        expect(state.initialScroll).toBeUndefined();
        expect(state.bootstrapInitialScroll).toBeUndefined();
    });

    it("reveals natively without a corrective scroll when the mount seed already matches", async () => {
        const data = Array.from({ length: 10 }, (_, index) => ({
            id: `item-${index}`,
            label: `Item ${index}`,
        }));
        const { LegendList } = await import("../../src/components/LegendList?bootstrap-native");

        render(
            <LegendList
                data={data}
                estimatedItemSize={50}
                estimatedListSize={{ height: 200, width: 320 }}
                initialScrollIndex={5}
                keyExtractor={(item: { id: string }) => item.id}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
            />,
        );

        const state = await getStateFromRender();
        expect(lastListProps.initialContentOffset).toBe(250);

        seedMeasuredLayout(state, data.length, 50);

        await act(async () => {
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
        });

        expect(state.didFinishInitialScroll).toBe(true);
        expect(state.bootstrapInitialScroll).toBeUndefined();
        expect(state.scrollingTo).toBeUndefined();
        expect(state.scroll).toBe(250);
    });

    it("schedules the second stable pass after measurements settle", async () => {
        const data = Array.from({ length: 10 }, (_, index) => ({
            id: `item-${index}`,
            label: `Item ${index}`,
        }));
        const { LegendList } = await import("../../src/components/LegendList?bootstrap-stable-pass");

        render(
            <LegendList
                data={data}
                estimatedItemSize={50}
                estimatedListSize={{ height: 200, width: 320 }}
                initialScrollIndex={5}
                keyExtractor={(item: { id: string }) => item.id}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
            />,
        );

        const state = await getStateFromRender();
        seedMeasuredLayout(state, data.length, 50);

        await act(async () => {
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
        });

        expect(state.didFinishInitialScroll).not.toBe(true);
        expect(state.bootstrapInitialScroll?.stablePassCount).toBe(1);

        await flushAsync();

        expect(state.didFinishInitialScroll).toBe(true);
        expect(state.bootstrapInitialScroll).toBeUndefined();
        expect(state.scrollingTo).toBeUndefined();
        expect(state.scroll).toBe(250);
    });

    it("waits an extra frame after the web corrective scroll before revealing", async () => {
        const previousPlatform = Platform.OS;
        Platform.OS = "web";
        try {
            const data = Array.from({ length: 10 }, (_, index) => ({
                id: `item-${index}`,
                label: `Item ${index}`,
            }));
            const { LegendList } = await import("../../src/components/LegendList?bootstrap-web");

            render(
                <LegendList
                    data={data}
                    estimatedItemSize={50}
                    estimatedListSize={{ height: 200, width: 320 }}
                    initialScrollIndex={5}
                    keyExtractor={(item: { id: string }) => item.id}
                    renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
                />,
            );

            const state = await getStateFromRender();
            expect(lastListProps.initialContentOffset).toBeUndefined();

            seedMeasuredLayout(state, data.length, 50);

            await act(async () => {
                state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
                state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
            });

            expect(state.scrollingTo?.isInitialScroll).toBe(true);
            expect(state.didFinishInitialScroll).not.toBe(true);

            await act(async () => {
                finishScrollTo((handlerInstances.at(-1) as any).context);
            });

            expect(state.didFinishInitialScroll).not.toBe(true);

            await flushAsync();

            expect(state.didFinishInitialScroll).toBe(true);
            expect(state.bootstrapInitialScroll).toBeUndefined();
        } finally {
            Platform.OS = previousPlatform;
        }
    });

    it("rearms empty initialScrollAtEnd when data arrives later", async () => {
        const { LegendList } = await import("../../src/components/LegendList?bootstrap-empty-at-end");
        const rendered = render(
            <LegendList
                data={[]}
                estimatedItemSize={50}
                estimatedListSize={{ height: 200, width: 320 }}
                initialScrollAtEnd
                keyExtractor={(item: { id: string }) => item.id}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
            />,
        );

        const emptyState = await getStateFromRender();
        expect(emptyState.didFinishInitialScroll).toBe(true);
        expect(emptyState.bootstrapInitialScroll).toBeUndefined();

        const nextData = [{ id: "item-0", label: "Item 0" }];
        rendered.rerender(
            <LegendList
                data={nextData}
                estimatedItemSize={50}
                estimatedListSize={{ height: 200, width: 320 }}
                initialScrollAtEnd
                keyExtractor={(item: { id: string }) => item.id}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
            />,
        );

        await flushAsync();

        const state = await getStateFromRender();
        expect(state.didFinishInitialScroll).toBe(false);
        expect(state.bootstrapInitialScroll?.active).toBe(true);

        seedMeasuredLayout(state, nextData.length, 50);
        await act(async () => {
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
        });

        expect(state.didFinishInitialScroll).toBe(true);
    });

    it("preserves the native seed when bootstrap bounds are exceeded", async () => {
        const data = Array.from({ length: 10 }, (_, index) => ({
            id: `item-${index}`,
            label: `Item ${index}`,
        }));
        const { LegendList } = await import("../../src/components/LegendList?bootstrap-abort");

        render(
            <LegendList
                data={data}
                estimatedItemSize={50}
                estimatedListSize={{ height: 200, width: 320 }}
                initialScrollIndex={5}
                keyExtractor={(item: { id: string }) => item.id}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
            />,
        );

        const state = await getStateFromRender();
        seedMeasuredLayout(state, data.length, 50);
        expect(lastListProps.initialContentOffset).toBe(250);
        state.bootstrapInitialScroll.frameCount = 8;
        state.bootstrapInitialScroll.passCount = 24;

        await act(async () => {
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
        });

        expect(state.didFinishInitialScroll).toBe(true);
        expect(state.scroll).toBe(250);
        expect(state.bootstrapInitialScroll).toBeUndefined();
    });

    it("invalidates bootstrap settle when footer measurement changes the end offset", async () => {
        const data = Array.from({ length: 3 }, (_, index) => ({
            id: `item-${index}`,
            label: `Item ${index}`,
        }));
        const { LegendList } = await import("../../src/components/LegendList?bootstrap-footer");

        render(
            <LegendList
                data={data}
                estimatedItemSize={50}
                estimatedListSize={{ height: 200, width: 320 }}
                initialScrollAtEnd
                keyExtractor={(item: { id: string }) => item.id}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
            />,
        );

        const state = await getStateFromRender();
        expect(state.bootstrapInitialScroll?.active).toBe(true);

        state.bootstrapInitialScroll.stablePassCount = 1;

        await act(async () => {
            lastListProps.onLayoutFooter?.({ height: 40, width: 320, x: 0, y: 0 });
        });

        expect(state.initialScroll.viewOffset).toBe(-40);
        expect(state.bootstrapInitialScroll?.stablePassCount).toBe(0);
    });
});
