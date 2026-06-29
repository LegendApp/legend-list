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
import { registerBaseModuleMocks } from "../setup";

let lastListProps: any;
const handlerInstances: ScrollAdjustHandler[] = [];

function registerOldArchitectureMocks() {
    mock.restore();
    registerBaseModuleMocks();

    mock.module("@/constants-platform", () => ({
        IsNewArchitecture: false,
    }));

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
                requestedAdjusts: number[] = [];
                mounted = false;
                constructor(ctx: StateContext) {
                    this.context = ctx;
                    handlerInstances.push(this as any);
                }
                requestAdjust(add: number) {
                    this.requestedAdjusts.push(add);
                }
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
    return import(`../../src/components/LegendList?${suffix}`);
}

beforeEach(() => {
    registerOldArchitectureMocks();
    handlerInstances.length = 0;
    lastListProps = undefined;
    Platform.OS = "ios";
});

afterEach(() => {
    Platform.OS = "ios";
});

describe("LegendList bootstrap initial scroll old architecture", () => {
    it("adjusts a finished footer-preserved end alignment when a later layout shrinks the viewport", async () => {
        const data = Array.from({ length: 6 }, (_, index) => ({
            id: `item-${index}`,
            label: `Item ${index}`,
        }));
        const { LegendList } = await importOldArchitectureLegendList("bootstrap-footer-layout-retarget-oldarch");

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
            await flushAsync();

            expect(layoutFinishTracker.assignedValues).not.toContain(false);
            expect(state.didFinishInitialScroll).toBe(true);
            expect(state.initialScroll?.viewPosition).toBe(1);
            expect(getBootstrapSession(state)).toBeUndefined();
            expect(state.scrollingTo).toBeUndefined();
            expect(lastListProps.scrollAdjustHandler.requestedAdjusts.at(-1)).toBe(50);
            expect(state.scroll).toBe(50);
        } finally {
            layoutFinishTracker.restore();
        }
    });

    it("waits for mounted bootstrap items to measure before finishing index targets", async () => {
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

    it("waits for mounted bootstrap items to measure before finishing end targets", async () => {
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
