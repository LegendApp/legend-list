import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import "../setup";
import { Text } from "react-native";

import { finishScrollTo } from "../../src/core/finishScrollTo";
import { resolveInitialScrollOffset } from "../../src/core/initialScroll";
import type { ScrollAdjustHandler } from "../../src/core/ScrollAdjustHandler";
import { Platform } from "../../src/platform/Platform";
import type { StateContext } from "../../src/state/state";
import { setDidLayout } from "../../src/utils/setDidLayout";
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

function trackAssignedStateValue<T extends object, K extends keyof T>(object: T, key: K) {
    const originalDescriptor = Object.getOwnPropertyDescriptor(object, key);
    let currentValue = object[key];
    const assignedValues: T[K][] = [];

    Object.defineProperty(object, key, {
        configurable: true,
        enumerable: true,
        get() {
            return currentValue;
        },
        set(value: T[K]) {
            assignedValues.push(value);
            currentValue = value;
        },
    });

    return {
        assignedValues,
        restore() {
            if (originalDescriptor) {
                Object.defineProperty(object, key, originalDescriptor);
            } else {
                delete (object as Record<PropertyKey, unknown>)[key as PropertyKey];
                (object as Record<PropertyKey, unknown>)[key as PropertyKey] = currentValue;
            }
        },
    };
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

async function getContextFromRender() {
    for (let i = 0; i < 5; i++) {
        const handler = lastListProps?.scrollAdjustHandler ?? handlerInstances.at(-1);
        if (handler) {
            return (handler as any).context as StateContext;
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
        const resolvedSize = Array.isArray(size) ? (size[i] ?? size.at(-1) ?? 0) : size;
        state.idCache[i] = id;
        state.indexByKey.set(id, i);
        state.positions[i] =
            i === 0 ? 0 : (state.positions[i - 1] ?? 0) + (Array.isArray(size) ? (size[i - 1] ?? resolvedSize) : size);
        state.sizes.set(id, resolvedSize);
        state.sizesKnown.set(id, resolvedSize);
    }
}

function seedEstimatedLayout(state: any, count: number, size: number | number[]) {
    state.scrollLength = 200;
    state.sizes.clear();
    state.sizesKnown.clear();
    for (let i = 0; i < count; i++) {
        const id = state.props.keyExtractor?.(state.props.data[i], i) ?? `item_${i}`;
        const resolvedSize = Array.isArray(size) ? (size[i] ?? size.at(-1) ?? 0) : size;
        state.idCache[i] = id;
        state.indexByKey.set(id, i);
        state.positions[i] =
            i === 0 ? 0 : (state.positions[i - 1] ?? 0) + (Array.isArray(size) ? (size[i - 1] ?? resolvedSize) : size);
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
        state.refScroller.current = {
            getCurrentScrollOffset: () => 250,
        } as any;

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

    it("finishes immediately once the mounted bootstrap window is measured", async () => {
        const data = Array.from({ length: 10 }, (_, index) => ({
            id: `item-${index}`,
            label: `Item ${index}`,
        }));
        const { LegendList } = await import("../../src/components/LegendList?bootstrap-immediate-finish");

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
        state.refScroller.current = {
            getCurrentScrollOffset: () => 250,
        } as any;
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

    it("completes web corrective scrolls through finishScrollTo", async () => {
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
            const ctx = await getContextFromRender();
            expect(lastListProps.initialContentOffset).toBeUndefined();
            expect(ctx.values.get("readyToRender")).toBeUndefined();

            seedMeasuredLayout(state, data.length, 50);

            await act(async () => {
                state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
                state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
                state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
            });

            expect(state.scrollingTo?.isInitialScroll).toBe(true);
            expect(state.didFinishInitialScroll).not.toBe(true);

            await act(async () => {
                finishScrollTo((handlerInstances.at(-1) as any).context);
            });

            expect(state.didFinishInitialScroll).toBe(true);
            expect(ctx.values.get("readyToRender")).toBe(true);
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
        const ctx = await getContextFromRender();
        expect(emptyState.didFinishInitialScroll).toBe(true);
        expect(getBootstrapSession(emptyState)).toBeUndefined();
        await act(async () => {
            setDidLayout(ctx);
        });
        expect(ctx.values.get("readyToRender")).toBe(true);

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
        expect(ctx.values.get("readyToRender")).toBe(true);
        expect(getBootstrapSession(state)).toBeDefined();

        seedMeasuredLayout(state, nextData.length, 50);
        await act(async () => {
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
        });

        expect(state.didFinishInitialScroll).toBe(true);
        expect(ctx.values.get("readyToRender")).toBe(true);
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
        const ctx = await getContextFromRender();
        expect(emptyState.didFinishInitialScroll).toBe(true);
        expect(emptyState.initialScroll?.index).toBe(2);
        expect(getBootstrapSession(emptyState)).toBeUndefined();
        await act(async () => {
            setDidLayout(ctx);
        });
        expect(ctx.values.get("readyToRender")).toBe(true);

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
        expect(ctx.values.get("readyToRender")).toBe(true);
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
        expect(ctx.values.get("readyToRender")).toBe(true);
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
        const ctx = await getContextFromRender();
        seedMeasuredLayout(state, data.length, 50);
        expect(lastListProps.initialContentOffset).toBe(250);
        await act(async () => {
            setDidLayout(ctx);
        });
        getBootstrapSession(state).mountFrameCount = 8;
        getBootstrapSession(state).passCount = 24;

        await act(async () => {
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
        });

        expect(state.didFinishInitialScroll).toBe(true);
        expect(ctx.values.get("readyToRender")).toBe(true);
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

        await act(async () => {
            lastListProps.onLayoutFooter?.({ height: 40, width: 320, x: 0, y: 0 });
        });

        expect(state.initialScroll.viewOffset).toBe(-40);
        expect(getBootstrapSession(state)?.mountFrameCount).toBeGreaterThanOrEqual(3);
        expect(getBootstrapSession(state)?.passCount).toBe(0);
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
        expect(getBootstrapSession(state)).toBeDefined();
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

    it("clears a finished bottom-aligned initialScrollIndex when data changes", async () => {
        const data = Array.from({ length: 6 }, (_, index) => ({
            id: `item-${index}`,
            label: `Item ${index}`,
        }));
        const { LegendList } = await import(
            "../../src/components/LegendList?bootstrap-finished-bottom-index-data-change"
        );
        const rendered = render(
            <LegendList
                data={data}
                estimatedItemSize={50}
                estimatedListSize={{ height: 200, width: 320 }}
                initialScrollIndex={{ index: 2, viewPosition: 1 }}
                keyExtractor={(item: { id: string }) => item.id}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
            />,
        );

        const state = await getStateFromRender();
        const ctx = await getContextFromRender();
        seedMeasuredLayout(state, data.length, 50);

        await act(async () => {
            setDidLayout(ctx);
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
        });

        if (state.scrollingTo?.isInitialScroll) {
            await act(async () => {
                finishScrollTo(ctx);
            });
        }

        expect(state.didFinishInitialScroll).toBe(true);
        expect(state.initialScroll?.viewPosition).toBe(1);
        expect(getBootstrapSession(state)).toBeUndefined();

        rendered.rerender(
            <LegendList
                data={data.map((item) => ({ ...item, label: `${item.label} updated` }))}
                estimatedItemSize={50}
                estimatedListSize={{ height: 200, width: 320 }}
                initialScrollIndex={{ index: 2, viewPosition: 1 }}
                keyExtractor={(item: { id: string }) => item.id}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
            />,
        );

        await flushAsync();

        expect(state.didFinishInitialScroll).toBe(true);
        expect(state.initialScroll).toBeUndefined();
        expect(getBootstrapSession(state)).toBeUndefined();
        expect(state.scrollingTo).toBeUndefined();
    });

    it("clears a finished initialScrollAtEnd target when data changes", async () => {
        const data = Array.from({ length: 3 }, (_, index) => ({
            id: `item-${index}`,
            label: `Item ${index}`,
        }));
        const { LegendList } = await import("../../src/components/LegendList?bootstrap-finished-end-data-change");
        const rendered = render(
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
        const ctx = await getContextFromRender();
        seedMeasuredLayout(state, data.length, 50);

        await act(async () => {
            setDidLayout(ctx);
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
        });

        if (state.scrollingTo?.isInitialScroll) {
            await act(async () => {
                finishScrollTo(ctx);
            });
        }

        expect(state.didFinishInitialScroll).toBe(true);
        expect(state.initialScroll?.index).toBe(2);
        expect(getBootstrapSession(state)).toBeUndefined();

        const appendedData = [...data, { id: "item-3", label: "Item 3" }];
        rendered.rerender(
            <LegendList
                data={appendedData}
                estimatedItemSize={50}
                estimatedListSize={{ height: 200, width: 320 }}
                initialScrollAtEnd
                keyExtractor={(item: { id: string }) => item.id}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
            />,
        );

        await flushAsync();

        expect(state.didFinishInitialScroll).toBe(true);
        expect(state.initialScroll).toBeUndefined();
        expect(getBootstrapSession(state)).toBeUndefined();
        expect(state.scrollingTo).toBeUndefined();
    });

    it("keeps rendered content visible when footer layout retargets a finished end alignment", async () => {
        const data = Array.from({ length: 6 }, (_, index) => ({
            id: `item-${index}`,
            label: `Item ${index}`,
        }));
        const { LegendList } = await import("../../src/components/LegendList?bootstrap-footer-ready");

        render(
            <LegendList
                data={data}
                estimatedItemSize={50}
                estimatedListSize={{ height: 200, width: 320 }}
                initialScrollAtEnd
                keyExtractor={(item: { id: string }) => item.id}
                ListFooterComponent={() => <Text>Footer</Text>}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
            />,
        );

        const state = await getStateFromRender();
        const ctx = await getContextFromRender();
        seedMeasuredLayout(state, data.length, 50);

        await act(async () => {
            setDidLayout(ctx);
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
        });

        if (state.scrollingTo?.isInitialScroll) {
            await act(async () => {
                finishScrollTo(ctx);
            });
        }

        expect(state.didFinishInitialScroll).toBe(true);
        expect(ctx.values.get("readyToRender")).toBe(true);

        await act(async () => {
            lastListProps.onLayoutFooter?.({ height: 40, width: 320, x: 0, y: 0 });
        });

        expect(state.didFinishInitialScroll).toBe(false);
        expect(ctx.values.get("readyToRender")).toBe(true);

        await act(async () => {
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
        });

        if (state.scrollingTo?.isInitialScroll) {
            await act(async () => {
                finishScrollTo(ctx);
            });
        }

        expect(state.didFinishInitialScroll).toBe(true);
        expect(ctx.values.get("readyToRender")).toBe(true);
    });

    it("reopens bootstrap when a later authoritative layout shrinks the viewport after finish", async () => {
        const data = Array.from({ length: 6 }, (_, index) => ({
            id: `item-${index}`,
            label: `Item ${index}`,
        }));
        const { LegendList } = await import("../../src/components/LegendList?bootstrap-layout-retarget");

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
        const ctx = await getContextFromRender();
        seedMeasuredLayout(state, data.length, 50);

        await act(async () => {
            setDidLayout(ctx);
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
        });

        if (state.scrollingTo?.isInitialScroll) {
            expect(state.scrollingTo.targetOffset ?? state.scrollingTo.offset).toBe(100);
            await act(async () => {
                finishScrollTo(ctx);
            });
        }

        expect(state.didFinishInitialScroll).toBe(true);
        expect(state.initialScroll?.viewPosition).toBe(1);

        await act(async () => {
            lastListProps.onLayout?.({
                nativeEvent: {
                    layout: { height: 150, width: 320, x: 0, y: 0 },
                },
            });
        });

        expect(state.didFinishInitialScroll).toBe(false);
        expect(!!getBootstrapSession(state) || !!state.scrollingTo?.isInitialScroll).toBe(true);

        await act(async () => {
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
        });

        expect(state.scrollingTo?.targetOffset ?? state.scrollingTo?.offset).toBe(150);

        if (state.scrollingTo?.isInitialScroll) {
            await act(async () => {
                finishScrollTo(ctx);
            });
        }

        expect(state.didFinishInitialScroll).toBe(true);
        expect(ctx.values.get("readyToRender")).toBe(true);
    });

    it("keeps the finished end target alive until a later relayout reopens bootstrap", async () => {
        const originalSetTimeout = globalThis.setTimeout;
        let preservedTargetClearDelay: number | undefined;
        let queuedPreservedTargetClear: (() => void) | undefined;
        globalThis.setTimeout = ((callback: TimerHandler, delay?: number) => {
            if (typeof delay === "number" && delay > 0) {
                preservedTargetClearDelay = delay;
                queuedPreservedTargetClear = callback as () => void;
                return 1 as any;
            }

            return originalSetTimeout(callback, delay as number | undefined);
        }) as typeof setTimeout;

        try {
            const data = Array.from({ length: 6 }, (_, index) => ({
                id: `item-${index}`,
                label: `Item ${index}`,
            }));
            const { LegendList } = await import("../../src/components/LegendList?bootstrap-layout-retarget-delayed");

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
            const ctx = await getContextFromRender();
            seedMeasuredLayout(state, data.length, 50);

            await act(async () => {
                setDidLayout(ctx);
                state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
                state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
            });

            if (state.scrollingTo?.isInitialScroll) {
                await act(async () => {
                    finishScrollTo(ctx);
                });
            }

            expect(state.didFinishInitialScroll).toBe(true);
            expect(state.initialScroll?.viewPosition).toBe(1);
            expect(preservedTargetClearDelay).toBe(2000);
            expect(queuedPreservedTargetClear).toBeDefined();

            await act(async () => {
                lastListProps.onLayout?.({
                    nativeEvent: {
                        layout: { height: 150, width: 320, x: 0, y: 0 },
                    },
                });
            });

            expect(state.didFinishInitialScroll).toBe(false);
            expect(!!getBootstrapSession(state) || !!state.scrollingTo?.isInitialScroll).toBe(true);
            expect(state.initialScroll?.viewPosition).toBe(1);
        } finally {
            globalThis.setTimeout = originalSetTimeout;
        }
    });

    it("reopens bootstrap after footer layout settles and a later layout shrinks the viewport", async () => {
        const data = Array.from({ length: 6 }, (_, index) => ({
            id: `item-${index}`,
            label: `Item ${index}`,
        }));
        const { LegendList } = await import("../../src/components/LegendList?bootstrap-footer-layout-retarget");

        render(
            <LegendList
                data={data}
                estimatedItemSize={50}
                estimatedListSize={{ height: 200, width: 320 }}
                initialScrollAtEnd
                keyExtractor={(item: { id: string }) => item.id}
                ListFooterComponent={() => <Text>Footer</Text>}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
            />,
        );

        const state = await getStateFromRender();
        const ctx = await getContextFromRender();
        seedMeasuredLayout(state, data.length, 50);

        await act(async () => {
            setDidLayout(ctx);
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
        });

        if (state.scrollingTo?.isInitialScroll) {
            await act(async () => {
                finishScrollTo(ctx);
            });
        }

        expect(state.didFinishInitialScroll).toBe(true);
        expect(state.initialScroll?.viewPosition).toBe(1);
        expect(state.initialScroll?.preserveForFooterLayout).toBe(true);

        const footerFinishTracker = trackAssignedStateValue(state, "didFinishInitialScroll");
        try {
            await act(async () => {
                lastListProps.onLayoutFooter?.({ height: 40, width: 320, x: 0, y: 0 });
            });

            expect(footerFinishTracker.assignedValues).toContain(false);
            expect(state.initialScroll?.viewPosition).toBe(1);
        } finally {
            footerFinishTracker.restore();
        }

        await act(async () => {
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
        });

        if (state.scrollingTo?.isInitialScroll) {
            await act(async () => {
                finishScrollTo(ctx);
            });
        }

        expect(state.didFinishInitialScroll).toBe(true);
        expect(state.initialScroll?.viewPosition).toBe(1);

        const layoutFinishTracker = trackAssignedStateValue(state, "didFinishInitialScroll");
        try {
            await act(async () => {
                lastListProps.onLayout?.({
                    nativeEvent: {
                        layout: { height: 150, width: 320, x: 0, y: 0 },
                    },
                });
            });

            expect(layoutFinishTracker.assignedValues).toContain(false);
            expect(state.initialScroll?.viewPosition).toBe(1);
        } finally {
            layoutFinishTracker.restore();
        }
    });

    it("reopens bootstrap when a finished end alignment gets a width-only layout change", async () => {
        const data = Array.from({ length: 6 }, (_, index) => ({
            id: `item-${index}`,
            label: `Item ${index}`,
        }));
        const { LegendList } = await import("../../src/components/LegendList?bootstrap-width-layout-retarget");

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
        const ctx = await getContextFromRender();
        seedMeasuredLayout(state, data.length, 50);

        await act(async () => {
            setDidLayout(ctx);
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
        });

        if (state.scrollingTo?.isInitialScroll) {
            await act(async () => {
                finishScrollTo(ctx);
            });
        }

        expect(state.didFinishInitialScroll).toBe(true);

        const finishTracker = trackAssignedStateValue(state, "didFinishInitialScroll");
        try {
            await act(async () => {
                lastListProps.onLayout?.({
                    nativeEvent: {
                        layout: { height: 200, width: 260, x: 0, y: 0 },
                    },
                });
            });

            expect(finishTracker.assignedValues).toContain(false);
            expect(state.initialScroll?.viewPosition).toBe(1);
        } finally {
            finishTracker.restore();
        }
    });

    it("waits for old-architecture mounted bootstrap items to measure before finishing index targets", async () => {
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
        seedEstimatedLayout(state, data.length, 50);

        await act(async () => {
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
        });

        expect(state.didFinishInitialScroll).not.toBe(true);
        expect(getBootstrapSession(state)).toBeDefined();

        seedMeasuredLayout(state, data.length, [80, 80, 80, 80, 80, 80, 50, 50, 50, 50]);

        await act(async () => {
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
        });

        expect(resolveInitialScrollOffset((handlerInstances.at(-1) as any).context, initialTarget)).toBe(280);
        expect(state.scrollingTo?.targetOffset).toBe(280);

        await act(async () => {
            finishScrollTo((handlerInstances.at(-1) as any).context);
        });

        expect(state.didFinishInitialScroll).toBe(true);
    });

    it("waits for old-architecture mounted bootstrap items to measure before finishing end targets", async () => {
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
        seedEstimatedLayout(state, data.length, 50);

        await act(async () => {
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
        });

        expect(state.didFinishInitialScroll).not.toBe(true);
        expect(getBootstrapSession(state)).toBeDefined();

        seedMeasuredLayout(state, data.length, 80);

        await act(async () => {
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
            state.triggerCalculateItemsInView?.({ forceFullItemPositions: true });
        });

        expect(state.scrollingTo?.targetOffset).toBe(600);

        await act(async () => {
            finishScrollTo((handlerInstances.at(-1) as any).context);
        });

        expect(state.didFinishInitialScroll).toBe(true);
    });
});
