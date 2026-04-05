import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import "../setup";
import { Text } from "react-native";

import { finishScrollTo } from "../../src/core/finishScrollTo";
import { resolveInitialScrollOffset } from "../../src/core/initialScroll";
import type { ScrollAdjustHandler } from "../../src/core/ScrollAdjustHandler";
import { Platform } from "../../src/platform/Platform";
import type { StateContext } from "../../src/state/state";
import { act, render } from "../helpers/testingLibrary";

let lastListProps: any;
const handlerInstances: ScrollAdjustHandler[] = [];

function registerLegendListBootstrapMocks() {
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
}

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

function getBootstrapSession(state: any) {
    return state.initialScrollSession?.kind === "bootstrap" ? state.initialScrollSession.bootstrap : undefined;
}

function seedMeasuredLayout(state: any, count: number, size: number | number[]) {
    state.scrollLength = 200;
    for (let i = 0; i < count; i++) {
        const id = state.props.keyExtractor?.(state.props.data[i], i) ?? `item_${i}`;
        const resolvedSize = Array.isArray(size) ? size[i] ?? size.at(-1) ?? 0 : size;
        state.idCache[i] = id;
        state.indexByKey.set(id, i);
        state.positions[i] =
            i === 0 ? 0 : (state.positions[i - 1] ?? 0) + (Array.isArray(size) ? size[i - 1] ?? resolvedSize : size);
        state.sizes.set(id, resolvedSize);
        state.sizesKnown.set(id, resolvedSize);
    }
}

async function importOldArchitectureLegendList(suffix: string) {
    mock.module("@/constants-platform", () => ({
        IsNewArchitecture: false,
    }));

    return import(`../../src/components/LegendList?${suffix}`);
}

beforeEach(() => {
    registerLegendListBootstrapMocks();
    handlerInstances.length = 0;
    lastListProps = undefined;
    Platform.OS = "ios";
});

afterEach(() => {
    Platform.OS = "ios";
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
        expect(getBootstrapSession(state)).toBeUndefined();
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
        expect(getBootstrapSession(state)).toBeUndefined();
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
        expect(getBootstrapSession(state)?.stablePassCount).toBe(1);

        await flushAsync();

        expect(state.didFinishInitialScroll).toBe(true);
        expect(getBootstrapSession(state)).toBeUndefined();
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
            expect(getBootstrapSession(state)).toBeUndefined();
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
        expect(getBootstrapSession(emptyState)).toBeUndefined();

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
        expect(getBootstrapSession(state)).toBeDefined();

        seedMeasuredLayout(state, nextData.length, 50);
        await act(async () => {
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
        });

        expect(state.didFinishInitialScroll).toBe(true);
    });

    it("rearms empty initialScrollIndex when data arrives later", async () => {
        const { LegendList } = await import("../../src/components/LegendList?bootstrap-empty-index");
        const rendered = render(
            <LegendList
                data={[]}
                estimatedItemSize={50}
                estimatedListSize={{ height: 200, width: 320 }}
                initialScrollIndex={2}
                keyExtractor={(item: { id: string }) => item.id}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
            />,
        );

        const emptyState = await getStateFromRender();
        expect(emptyState.didFinishInitialScroll).toBe(true);
        expect(emptyState.initialScroll?.index).toBe(2);
        expect(getBootstrapSession(emptyState)).toBeUndefined();

        const nextData = Array.from({ length: 5 }, (_, index) => ({
            id: `item-${index}`,
            label: `Item ${index}`,
        }));
        rendered.rerender(
            <LegendList
                data={nextData}
                estimatedItemSize={50}
                estimatedListSize={{ height: 200, width: 320 }}
                initialScrollIndex={2}
                keyExtractor={(item: { id: string }) => item.id}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
            />,
        );

        await flushAsync();

        const state = await getStateFromRender();
        expect(state.didFinishInitialScroll).toBe(false);
        expect(getBootstrapSession(state)).toBeDefined();

        seedMeasuredLayout(state, nextData.length, 50);
        await act(async () => {
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
        });

        expect(state.scrollingTo?.isInitialScroll).toBe(true);
        expect(state.scrollingTo?.targetOffset ?? state.scrollingTo?.offset).toBe(50);

        await act(async () => {
            finishScrollTo((handlerInstances.at(-1) as any).context);
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
        getBootstrapSession(state).mountFrameCount = 8;
        getBootstrapSession(state).passCount = 24;

        await act(async () => {
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
        });

        expect(state.didFinishInitialScroll).toBe(true);
        expect(state.scroll).toBe(250);
        expect(getBootstrapSession(state)).toBeUndefined();
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
        expect(getBootstrapSession(state)).toBeDefined();

        getBootstrapSession(state).mountFrameCount = 3;
        getBootstrapSession(state).stablePassCount = 1;

        await act(async () => {
            lastListProps.onLayoutFooter?.({ height: 40, width: 320, x: 0, y: 0 });
        });

        expect(state.initialScroll.viewOffset).toBe(-40);
        expect(getBootstrapSession(state)?.mountFrameCount).toBeGreaterThanOrEqual(3);
        expect(getBootstrapSession(state)?.stablePassCount).toBe(0);
    });

    it("rearms bootstrap when data changes without a length change", async () => {
        const data = Array.from({ length: 3 }, (_, index) => ({
            id: `item-${index}`,
            label: `Item ${index}`,
        }));
        const { LegendList } = await import("../../src/components/LegendList?bootstrap-same-length-change");
        const rendered = render(
            <LegendList
                data={data}
                estimatedItemSize={50}
                estimatedListSize={{ height: 200, width: 320 }}
                initialScrollIndex={1}
                keyExtractor={(item: { id: string }) => item.id}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
            />,
        );

        const state = await getStateFromRender();
        expect(getBootstrapSession(state)).toBeDefined();

        getBootstrapSession(state).mountFrameCount = 3;
        getBootstrapSession(state).passCount = 4;
        getBootstrapSession(state).stablePassCount = 1;

        rendered.rerender(
            <LegendList
                data={data.map((item) => ({ ...item, label: `${item.label} updated` }))}
                estimatedItemSize={50}
                estimatedListSize={{ height: 200, width: 320 }}
                initialScrollIndex={1}
                keyExtractor={(item: { id: string }) => item.id}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
            />,
        );

        expect(getBootstrapSession(state)?.stablePassCount).toBe(0);

        await flushAsync();

        expect(getBootstrapSession(state)).toBeDefined();
        expect(getBootstrapSession(state)?.mountFrameCount).toBeGreaterThanOrEqual(3);
    });

    it("re-targets bottom-aligned bootstrap targets when paddingBottom changes", async () => {
        const data = Array.from({ length: 3 }, (_, index) => ({
            id: `item-${index}`,
            label: `Item ${index}`,
        }));
        const { LegendList } = await import("../../src/components/LegendList?bootstrap-padding-bottom");
        const rendered = render(
            <LegendList
                data={data}
                estimatedItemSize={50}
                estimatedListSize={{ height: 200, width: 320 }}
                initialScrollIndex={{ index: 2, viewPosition: 1 }}
                keyExtractor={(item: { id: string }) => item.id}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
                style={{ paddingBottom: 10 }}
            />,
        );

        const state = await getStateFromRender();
        expect(state.initialScroll?.viewOffset).toBe(-10);
        expect(getBootstrapSession(state)).toBeDefined();

        getBootstrapSession(state).mountFrameCount = 3;
        getBootstrapSession(state).stablePassCount = 1;

        rendered.rerender(
            <LegendList
                data={data}
                estimatedItemSize={50}
                estimatedListSize={{ height: 200, width: 320 }}
                initialScrollIndex={{ index: 2, viewPosition: 1 }}
                keyExtractor={(item: { id: string }) => item.id}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
                style={{ paddingBottom: 40 }}
            />,
        );

        await flushAsync();

        expect(state.initialScroll?.viewOffset).toBe(-40);
        expect(getBootstrapSession(state)?.mountFrameCount).toBeGreaterThanOrEqual(3);
        expect(getBootstrapSession(state)?.stablePassCount).toBe(0);
    });

    it("does not overwrite explicit bottom-aligned viewOffset values when paddingBottom changes", async () => {
        const data = Array.from({ length: 3 }, (_, index) => ({
            id: `item-${index}`,
            label: `Item ${index}`,
        }));
        const { LegendList } = await import("../../src/components/LegendList?bootstrap-explicit-view-offset");
        const rendered = render(
            <LegendList
                data={data}
                estimatedItemSize={50}
                estimatedListSize={{ height: 200, width: 320 }}
                initialScrollIndex={{ index: 2, viewOffset: -5, viewPosition: 1 }}
                keyExtractor={(item: { id: string }) => item.id}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
                style={{ paddingBottom: 10 }}
            />,
        );

        const state = await getStateFromRender();
        expect(state.initialScroll?.viewOffset).toBe(-5);

        rendered.rerender(
            <LegendList
                data={data}
                estimatedItemSize={50}
                estimatedListSize={{ height: 200, width: 320 }}
                initialScrollIndex={{ index: 2, viewOffset: -5, viewPosition: 1 }}
                keyExtractor={(item: { id: string }) => item.id}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
                style={{ paddingBottom: 40 }}
            />,
        );

        await flushAsync();

        expect(state.initialScroll?.viewOffset).toBe(-5);
    });

    it("keeps index-based bootstrap targets aligned when old-architecture measurements change after finish", async () => {
        const data = Array.from({ length: 10 }, (_, index) => ({
            id: `item-${index}`,
            label: `Item ${index}`,
        }));
        const initialTarget = { index: 5, viewPosition: 1 as const };
        const { LegendList } = await importOldArchitectureLegendList("bootstrap-old-arch-index");

        render(
            <LegendList
                data={data}
                estimatedItemSize={50}
                estimatedListSize={{ height: 200, width: 320 }}
                initialScrollIndex={initialTarget}
                keyExtractor={(item: { id: string }) => item.id}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
            />,
        );

        const state = await getStateFromRender();
        seedMeasuredLayout(state, data.length, 50);

        await act(async () => {
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
        });

        expect(state.didFinishInitialScroll).toBe(true);
        expect(state.scroll).toBe(100);

        seedMeasuredLayout(state, data.length, [80, 80, 80, 80, 80, 80, 50, 50, 50, 50]);

        await act(async () => {
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
        });

        expect(resolveInitialScrollOffset((handlerInstances.at(-1) as any).context, initialTarget)).toBe(280);
        expect(state.scroll).toBe(280);
    });

    it("keeps initialScrollAtEnd bootstrap targets aligned when old-architecture measurements change after finish", async () => {
        const data = Array.from({ length: 10 }, (_, index) => ({
            id: `item-${index}`,
            label: `Item ${index}`,
        }));
        const { LegendList } = await importOldArchitectureLegendList("bootstrap-old-arch-end");

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
        seedMeasuredLayout(state, data.length, 50);

        await act(async () => {
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
        });

        expect(state.didFinishInitialScroll).toBe(true);
        expect(state.scroll).toBe(300);

        seedMeasuredLayout(state, data.length, 80);

        await act(async () => {
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
        });

        expect(state.scroll).toBe(600);
    });
});
