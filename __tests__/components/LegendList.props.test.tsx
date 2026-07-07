import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import "../setup";
import { RefreshControl, Text } from "react-native";

import { act, render } from "../helpers/testingLibrary";

let lastListProps: any;
let requestAdjustCalls: number[] = [];
let scrollToCalls: any[] = [];
let suppressScrollToImplementation = true;

import { finishScrollTo } from "../../src/core/finishScrollTo";
import type { ScrollAdjustHandler } from "../../src/core/ScrollAdjustHandler";
import { peek$, type StateContext, set$, useArr$ } from "../../src/state/state";
import { clearWarnDevOnceForTests } from "../../src/utils/helpers";
import { setDidLayout } from "../../src/utils/setDidLayout";

const handlerInstances: ScrollAdjustHandler[] = [];
const layoutEvent = {
    nativeEvent: { layout: { height: 200, width: 320, x: 0, y: 0 } },
};

function registerLegendListPropMocks() {
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

    mock.module("@/utils/requestAdjust", () => ({
        requestAdjust: (_ctx: unknown, diff: number) => {
            requestAdjustCalls.push(diff);
        },
    }));

    mock.module("@/core/scrollTo", () => ({
        scrollTo: (ctx: unknown, params: any) => {
            scrollToCalls.push(params);
            if (!suppressScrollToImplementation) {
                const state = (ctx as StateContext).state;
                const offset = params.offset ?? 0;
                state.scroll = offset;
                state.scrollPending = offset;
                if (!params.noScrollingTo) {
                    state.scrollingTo = {
                        ...params,
                        targetOffset: offset,
                    };
                }
                state.refScroller.current?.scrollTo?.({
                    animated: !!params.animated,
                    x: state.props.horizontal ? offset : 0,
                    y: state.props.horizontal ? 0 : offset,
                });
            }
        },
    }));
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
    registerLegendListPropMocks();
    clearWarnDevOnceForTests();
    handlerInstances.length = 0;
    lastListProps = undefined;
    requestAdjustCalls = [];
    scrollToCalls = [];
    suppressScrollToImplementation = true;
});

afterEach(() => {
    suppressScrollToImplementation = false;
});

describe("LegendList props behavior", () => {
    it("prepares the reached-edge gate when a native drag begins", async () => {
        const data = [{ id: "item-1", label: "Alpha" }];
        const renderItem = ({ item }: { item: { label: string } }) => <Text>{item.label}</Text>;
        const { LegendList } = await import("../../src/components/LegendList?props-test-edge-drag-rearm");

        const rendered = render(
            <LegendList
                data={data}
                estimatedItemSize={100}
                keyExtractor={(item: { id: string }) => item.id}
                recycleItems={false}
                renderItem={renderItem}
            />,
        );
        const state = await getStateFromRender();
        state.edgeReachedGate = "closed";

        act(() => {
            lastListProps.onInternalScrollBeginDrag({ nativeEvent: {} });
        });

        expect(state.edgeReachedGate).toBe("prepared");
        rendered.unmount();
    });

    it("calls current native scroll lifecycle props from stable internal handlers", async () => {
        const data = [{ id: "item-1", label: "Alpha" }];
        const renderItem = ({ item }: { item: { label: string } }) => <Text>{item.label}</Text>;
        const dragCalls: string[] = [];
        const momentumCalls: string[] = [];
        const { LegendList } = await import("../../src/components/LegendList?props-test-current-scroll-callbacks");
        const renderList = (version: string) => (
            <LegendList
                data={data}
                estimatedItemSize={100}
                keyExtractor={(item: { id: string }) => item.id}
                onMomentumScrollEnd={() => momentumCalls.push(version)}
                onScrollBeginDrag={() => dragCalls.push(version)}
                recycleItems={false}
                renderItem={renderItem}
            />
        );
        const rendered = render(renderList("first"));

        act(() => {
            lastListProps.onInternalScrollBeginDrag({ nativeEvent: {} });
            lastListProps.onMomentumScrollEnd({ nativeEvent: {} });
        });

        rendered.rerender(renderList("next"));

        act(() => {
            lastListProps.onInternalScrollBeginDrag({ nativeEvent: {} });
            lastListProps.onMomentumScrollEnd({ nativeEvent: {} });
        });

        expect(dragCalls).toEqual(["first", "next"]);
        expect(momentumCalls).toEqual(["first", "next"]);
        rendered.unmount();
    });

    it("clears tracked timeouts on unmount", async () => {
        const data = [{ id: "item-1", label: "Alpha" }];
        const renderItem = ({ item }: { item: { label: string } }) => <Text>{item.label}</Text>;
        const { LegendList } = await import("../../src/components/LegendList?props-test-timeout-cleanup");

        const rendered = render(
            <LegendList
                data={data}
                estimatedItemSize={100}
                keyExtractor={(item: { id: string }) => item.id}
                recycleItems={false}
                renderItem={renderItem}
            />,
        );
        const state = await getStateFromRender();
        state.scheduledWork.timeout(() => {}, 1000, "adaptiveRender");

        rendered.unmount();

        expect(state.scheduledWork.has("adaptiveRender")).toBe(false);
    });

    it("cancels and settles imperative scroll work on unmount", async () => {
        const data = [{ id: "item-1", label: "Alpha" }];
        const renderItem = ({ item }: { item: { label: string } }) => <Text>{item.label}</Text>;
        const { LegendList } = await import("../../src/components/LegendList?props-test-imperative-scroll-cleanup");
        const originalCancelAnimationFrame = globalThis.cancelAnimationFrame;
        const cancelCalls: number[] = [];
        const cancelPlatformCompletion = mock(() => {});
        const resolveScroll = mock(() => {});
        globalThis.cancelAnimationFrame = ((id: number) => {
            cancelCalls.push(id);
        }) as typeof cancelAnimationFrame;

        try {
            const rendered = render(
                <LegendList
                    data={data}
                    estimatedItemSize={100}
                    keyExtractor={(item: { id: string }) => item.id}
                    recycleItems={false}
                    renderItem={renderItem}
                />,
            );
            const state = await getStateFromRender();
            const lifecycleState = state as any;
            lifecycleState.scheduledWork.register("checkFinishedScrollFrame", () => cancelAnimationFrame(0));
            lifecycleState.scheduledWork.register("platformScrollCompletion", cancelPlatformCompletion);
            lifecycleState.pendingScrollResolve = resolveScroll;
            lifecycleState.pendingScrollToEnd = { options: {}, resolve: resolveScroll, token: 1 };
            lifecycleState.scrollingTo = { animated: false, offset: 100 };
            lifecycleState.scrollTargetPinnedRange = { end: 1, start: 0 };

            rendered.unmount();

            expect(cancelCalls).toEqual([0]);
            expect(cancelPlatformCompletion).toHaveBeenCalledTimes(1);
            expect(resolveScroll).toHaveBeenCalledTimes(1);
            expect(lifecycleState.pendingScrollResolve).toBeUndefined();
            expect(lifecycleState.pendingScrollToEnd).toBeUndefined();
            expect(lifecycleState.scrollingTo).toBeUndefined();
            expect(lifecycleState.scrollTargetPinnedRange).toBeUndefined();
        } finally {
            globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
        }
    });

    it("cancels queued full drawDistance prewarm on unmount", async () => {
        const data = [{ id: "item-1", label: "Alpha" }];
        const renderItem = ({ item }: { item: { label: string } }) => <Text>{item.label}</Text>;
        const { LegendList } = await import("../../src/components/LegendList?props-test-draw-distance-cleanup");
        const originalCancelAnimationFrame = globalThis.cancelAnimationFrame;
        const cancelCalls: number[] = [];
        globalThis.cancelAnimationFrame = (id: number) => {
            cancelCalls.push(id);
        };

        try {
            const rendered = render(
                <LegendList
                    data={data}
                    estimatedItemSize={100}
                    keyExtractor={(item: { id: string }) => item.id}
                    recycleItems={false}
                    renderItem={renderItem}
                />,
            );
            const state = await getStateFromRender();
            state.scheduledWork.frame(() => {}, "fullDrawDistancePrewarm");

            rendered.unmount();

            expect(cancelCalls).toHaveLength(1);
            expect(state.scheduledWork.has("fullDrawDistancePrewarm")).toBe(false);
        } finally {
            globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
        }
    });

    it("stores the derived scroll-axis gap on context", async () => {
        const data = [{ id: "item-1", label: "Alpha" }];
        const renderItem = ({ item }: { item: { label: string } }) => <Text>{item.label}</Text>;
        const { LegendList } = await import("../../src/components/LegendList?props-test-scroll-axis-gap");
        const renderList = (horizontal?: boolean) => (
            <LegendList
                contentContainerStyle={{ columnGap: 16, gap: 10, rowGap: 12 }}
                data={data}
                estimatedItemSize={100}
                horizontal={horizontal}
                keyExtractor={(item: { id: string }) => item.id}
                recycleItems={false}
                renderItem={renderItem}
            />
        );

        const rendered = render(renderList(true));
        const ctx = await getContextFromRender();

        expect(ctx.scrollAxisGap).toBe(16);

        rendered.rerender(renderList());

        expect(ctx.scrollAxisGap).toBe(12);

        rendered.unmount();
    });

    it("invalidates cached item sizes when the scroll-axis gap changes", async () => {
        const data = [{ id: "item-1", label: "Alpha" }];
        const renderItem = ({ item }: { item: { label: string } }) => <Text>{item.label}</Text>;
        const { LegendList } = await import("../../src/components/LegendList?props-test-scroll-axis-gap-cache");
        const renderList = (gap: number) => (
            <LegendList
                contentContainerStyle={{ rowGap: gap }}
                data={data}
                estimatedItemSize={100}
                keyExtractor={(item: { id: string }) => item.id}
                recycleItems={false}
                renderItem={renderItem}
            />
        );

        const rendered = render(renderList(12));
        const ctx = await getContextFromRender();
        const state = ctx.state;

        state.sizes.set("item-1", 112);
        state.sizesKnown.set("item-1", 112);
        state.totalSize = 112;
        set$(ctx, "totalSize", 112);

        rendered.rerender(renderList(24));

        expect(ctx.scrollAxisGap).toBe(24);
        expect(state.sizes.size).toBe(0);
        expect(state.sizesKnown.size).toBe(0);

        rendered.unmount();
    });

    it("invalidates cached item sizes when the scroll axis changes without a gap change", async () => {
        const data = [{ id: "item-1", label: "Alpha" }];
        const renderItem = ({ item }: { item: { label: string } }) => <Text>{item.label}</Text>;
        const { LegendList } = await import("../../src/components/LegendList?props-test-scroll-axis-cache");
        const renderList = (horizontal?: boolean) => (
            <LegendList
                data={data}
                estimatedItemSize={100}
                horizontal={horizontal}
                keyExtractor={(item: { id: string }) => item.id}
                recycleItems={false}
                renderItem={renderItem}
            />
        );

        const rendered = render(renderList());
        const ctx = await getContextFromRender();
        const state = ctx.state;

        state.sizes.set("item-1", 120);
        state.sizesKnown.set("item-1", 120);
        state.totalSize = 120;
        set$(ctx, "totalSize", 120);

        rendered.rerender(renderList(true));

        expect(state.sizes.size).toBe(0);
        expect(state.sizesKnown.size).toBe(0);
        expect(state.layoutStoreRuntime?.store).toBeDefined();

        rendered.unmount();
    });

    it("does not rescan fixed-size hints on unrelated rerenders", async () => {
        const data = Array.from({ length: 1000 }, (_, index) => ({
            id: `item-${index}`,
            label: `Item ${index}`,
        }));
        const getFixedItemSize = mock(() => 64);
        const keyExtractor = (item: { id: string }) => item.id;
        const renderItem = ({ item }: { item: { label: string } }) => <Text>{item.label}</Text>;
        const { LegendList } = await import("../../src/components/LegendList?props-test-fixed-size-rerender");
        const renderList = (onLoad?: () => void) => (
            <LegendList
                data={data}
                estimatedItemSize={64}
                getFixedItemSize={getFixedItemSize}
                keyExtractor={keyExtractor}
                onLoad={onLoad}
                recycleItems={false}
                renderItem={renderItem}
            />
        );

        const rendered = render(renderList());
        await flushAsync();
        const callsAfterMount = getFixedItemSize.mock.calls.length;

        rendered.rerender(renderList(() => {}));
        await flushAsync();

        expect(callsAfterMount).toBe(data.length);
        expect(getFixedItemSize.mock.calls.length).toBe(callsAfterMount);

        rendered.unmount();
    });

    it("does not rebuild prefix layout for inline callback identities on unrelated rerenders", async () => {
        const data = Array.from({ length: 1000 }, (_, index) => ({
            id: `item-${index}`,
            kind: index % 2 === 0 ? "even" : "odd",
            label: `Item ${index}`,
        }));
        const getFixedItemSize = mock((_item: (typeof data)[number], _index: number, itemType?: string) =>
            itemType === "even" ? 64 : 72,
        );
        const getItemType = mock((item: (typeof data)[number]) => item.kind);
        const keyExtractor = mock((item: (typeof data)[number]) => item.id);
        const renderItem = ({ item }: { item: { label: string } }) => <Text>{item.label}</Text>;
        const { LegendList } = await import("../../src/components/LegendList?props-test-inline-callback-rerender");
        const consoleWarnSpy = mock(() => {});
        const originalWarn = console.warn;
        const renderList = (onLoad?: () => void) => (
            <LegendList
                data={data}
                estimatedItemSize={68}
                getFixedItemSize={(item, index, itemType) => getFixedItemSize(item, index, itemType)}
                getItemType={(item, index) => getItemType(item, index)}
                keyExtractor={(item) => keyExtractor(item)}
                onLoad={onLoad}
                recycleItems={false}
                renderItem={renderItem}
            />
        );

        console.warn = consoleWarnSpy as any;
        try {
            const rendered = render(renderList());
            await flushAsync();
            const fixedSizeCallsAfterMount = getFixedItemSize.mock.calls.length;
            const itemTypeCallsAfterMount = getItemType.mock.calls.length;
            const keyExtractorCallsAfterMount = keyExtractor.mock.calls.length;

            rendered.rerender(renderList(() => {}));
            await flushAsync();

            expect(fixedSizeCallsAfterMount).toBe(data.length);
            expect(itemTypeCallsAfterMount).toBe(data.length);
            expect(keyExtractorCallsAfterMount).toBeGreaterThanOrEqual(data.length);
            expect(getFixedItemSize.mock.calls.length).toBe(fixedSizeCallsAfterMount);
            expect(getItemType.mock.calls.length).toBe(itemTypeCallsAfterMount);
            expect(keyExtractor.mock.calls.length).toBe(keyExtractorCallsAfterMount);
            expect(consoleWarnSpy).toHaveBeenCalledWith(
                "[legend-list] keyExtractor changed identity without a data change. Pass a stable keyExtractor because item identity is only recomputed during data changes.",
            );

            rendered.unmount();
        } finally {
            console.warn = originalWarn;
        }
    });

    it("syncs public totals after an exact prefix-layout estimate rebuild", async () => {
        const data = [
            { id: "item-1", label: "Alpha" },
            { id: "item-2", label: "Beta" },
            { id: "item-3", label: "Gamma" },
        ];
        const keyExtractor = (item: { id: string }) => item.id;
        const renderItem = ({ item }: { item: { label: string } }) => <Text>{item.label}</Text>;
        const { LegendList } = await import("../../src/components/LegendList?props-test-prefix-exact-sync");
        const renderList = (estimatedItemSize: number) => (
            <LegendList
                data={data}
                estimatedItemSize={estimatedItemSize}
                keyExtractor={keyExtractor}
                recycleItems={false}
                renderItem={renderItem}
                snapToIndices={[0, 2]}
            />
        );

        const rendered = render(renderList(100));
        const ctx = await getContextFromRender();

        expect(ctx.state.totalSize).toBe(300);
        expect(ctx.values.get("snapToOffsets")).toEqual([0, 200]);

        rendered.rerender(renderList(80));
        await flushAsync();

        expect(ctx.state.layoutStoreRuntime?.store.getTotalSize()).toBe(240);
        expect(ctx.state.totalSize).toBe(240);
        expect(ctx.values.get("totalSize")).toBe(240);
        expect(ctx.values.get("snapToOffsets")).toEqual([0, 160]);

        rendered.unmount();
    });

    it("keeps prefix layout active after keyless data changes reset layout", async () => {
        const initialData = [{ label: "Alpha" }, { label: "Beta" }];
        const nextData = [{ label: "Gamma" }, { label: "Delta" }, { label: "Epsilon" }];
        const renderItem = ({ item }: { item: { label: string } }) => <Text>{item.label}</Text>;
        const { LegendList } = await import("../../src/components/LegendList?props-test-keyless-prefix-reset");
        const renderList = (data: typeof initialData | typeof nextData, estimatedItemSize = 100) => (
            <LegendList
                data={data}
                estimatedItemSize={estimatedItemSize}
                recycleItems={false}
                renderItem={renderItem}
            />
        );

        const rendered = render(renderList(initialData));
        const ctx = await getContextFromRender();

        expect(ctx.state.layoutStoreRuntime?.store).toBeDefined();

        rendered.rerender(renderList(nextData));
        await flushAsync();

        expect(ctx.state.layoutStoreRuntime?.store).toBeDefined();
        expect(ctx.state.layoutStoreRuntime?.store.length).toBe(nextData.length);
        expect(ctx.state.layoutStoreRuntime?.store.getMeasuredCount()).toBe(0);
        expect(ctx.state.positions.length).toBe(0);

        rendered.rerender(renderList(nextData, 80));
        await flushAsync();

        expect(ctx.state.layoutStoreRuntime?.store).toBeDefined();
        expect(ctx.state.layoutStoreRuntime?.store.getEstimatedSize()).toBe(80);

        rendered.unmount();
    });

    it("calls warnDevOnce when recycleItems is omitted", async () => {
        const consoleWarnSpy = mock(() => {});
        const originalWarn = console.warn;
        console.warn = consoleWarnSpy as any;
        const data = [
            { id: "item-1", label: "Alpha" },
            { id: "item-2", label: "Beta" },
        ];
        const { LegendList } = await import("../../src/components/LegendList?props-test-recycle-warning");

        try {
            const rendered = render(
                <LegendList
                    data={data}
                    estimatedItemSize={100}
                    keyExtractor={(item: { id: string }) => item.id}
                    renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
                />,
            );

            expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
            expect(consoleWarnSpy).toHaveBeenCalledWith(
                "[legend-list] recycleItems was not provided, so it defaults to false. Set recycleItems explicitly to true for better performance with recycling-aware rows, or false to preserve remount-on-reuse behavior.",
            );

            rendered.unmount();
        } finally {
            console.warn = originalWarn;
        }
    });

    it("does not call warnDevOnce when recycleItems is explicit", async () => {
        const consoleWarnSpy = mock(() => {});
        const originalWarn = console.warn;
        console.warn = consoleWarnSpy as any;
        const data = [
            { id: "item-1", label: "Alpha" },
            { id: "item-2", label: "Beta" },
        ];
        const { LegendList } = await import("../../src/components/LegendList?props-test-recycle-explicit");

        try {
            const renderedTrue = render(
                <LegendList
                    data={data}
                    estimatedItemSize={100}
                    keyExtractor={(item: { id: string }) => item.id}
                    recycleItems
                    renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
                />,
            );
            const renderedFalse = render(
                <LegendList
                    data={data}
                    estimatedItemSize={100}
                    keyExtractor={(item: { id: string }) => item.id}
                    recycleItems={false}
                    renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
                />,
            );

            expect(consoleWarnSpy).not.toHaveBeenCalled();

            renderedTrue.unmount();
            renderedFalse.unmount();
        } finally {
            console.warn = originalWarn;
        }
    });

    it("warns when anchoredEndSpace is used with multiple columns", async () => {
        const consoleWarnSpy = mock(() => {});
        const originalWarn = console.warn;
        console.warn = consoleWarnSpy as any;
        const data = [
            { id: "item-1", label: "Alpha" },
            { id: "item-2", label: "Beta" },
        ];
        const { LegendList } = await import("../../src/components/LegendList?props-test-anchored-columns-warning");

        try {
            const singleColumn = render(
                <LegendList
                    anchoredEndSpace={{ anchorIndex: 0 }}
                    data={data}
                    estimatedItemSize={100}
                    keyExtractor={(item: { id: string }) => item.id}
                    recycleItems={false}
                    renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
                />,
            );

            expect(consoleWarnSpy).not.toHaveBeenCalled();
            singleColumn.unmount();

            const multipleColumns = render(
                <LegendList
                    anchoredEndSpace={{ anchorIndex: 0 }}
                    data={data}
                    estimatedItemSize={100}
                    keyExtractor={(item: { id: string }) => item.id}
                    numColumns={2}
                    recycleItems={false}
                    renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
                />,
            );

            expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
            expect(consoleWarnSpy).toHaveBeenCalledWith(
                "[legend-list] anchoredEndSpace is only supported when numColumns is 1. Using it with multiple columns may produce incorrect anchored spacing.",
            );
            multipleColumns.unmount();
        } finally {
            console.warn = originalWarn;
        }
    });

    it("clears stale first-render layout caches before rebuilding positions", async () => {
        const initialData = [
            { id: "a", label: "Alpha" },
            { id: "b", label: "Beta" },
        ];
        const nextData = [
            { id: "b", label: "Beta" },
            { id: "c", label: "Gamma" },
            { id: "a", label: "Alpha" },
        ];
        const consoleErrorSpy = mock(() => {});
        const originalError = console.error;
        console.error = consoleErrorSpy as any;
        const { LegendList } = await import("../../src/components/LegendList?props-test-stale-first-cache");

        try {
            const renderList = (data: typeof initialData | typeof nextData) => (
                <LegendList
                    data={data}
                    estimatedItemSize={100}
                    keyExtractor={(item: { id: string }) => item.id}
                    numColumns={2}
                    recycleItems={false}
                    renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
                    // Keep this stale-cache regression on the eager positions path.
                    // The prefix layout store materializes ids lazily after layout.
                />
            );
            const rendered = render(renderList(initialData));
            const state = await getStateFromRender();

            state.isFirst = true;
            state.idCache[0] = "a";
            state.idCache[1] = "b";
            state.indexByKey.set("a", 0);
            state.indexByKey.set("b", 1);
            state.positions[0] = 0;
            state.positions[1] = 100;
            state.columns[0] = 1;
            state.columns[1] = 1;
            state.columnSpans[0] = 1;
            state.columnSpans[1] = 1;

            rendered.rerender(renderList(nextData));

            const overlappingKeyErrors = consoleErrorSpy.mock.calls.filter(([message]) =>
                String(message).includes("Detected overlapping key"),
            );
            expect(overlappingKeyErrors).toHaveLength(0);
            expect(state.idCache.slice(0, 3)).toEqual(["b", "c", "a"]);
            expect(state.indexByKey.get("a")).toBe(2);
            rendered.unmount();
        } finally {
            console.error = originalError;
        }
    });

    it("does not install a public throttled onScroll when scrollEventThrottle is set without onScroll", async () => {
        const data = [
            { id: "item-1", label: "Alpha" },
            { id: "item-2", label: "Beta" },
        ];
        const { LegendList } = await import("../../src/components/LegendList?props-test-throttle-without-onscroll");

        const rendered = render(
            <LegendList
                data={data}
                estimatedItemSize={100}
                keyExtractor={(item: { id: string }) => item.id}
                recycleItems={false}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
                scrollEventThrottle={16}
            />,
        );

        expect(lastListProps.onScroll).toBeDefined();

        expect(() =>
            lastListProps.onScroll({
                nativeEvent: {
                    contentOffset: { x: 0, y: 32 },
                    contentSize: { height: 200, width: 320 },
                    layoutMeasurement: { height: 200, width: 320 },
                },
            }),
        ).not.toThrow();

        const state = await getStateFromRender();
        expect(state.props.onScroll).toBeUndefined();

        rendered.unmount();
    });

    it("computes sparse snap offsets for targets outside the rendered viewport", async () => {
        const data = Array.from({ length: 40 }, (_, index) => ({
            id: `item-${index}`,
            label: `Item ${index}`,
        }));
        const { LegendList } = await import("../../src/components/LegendList?props-test-sparse-snap-indices");

        const rendered = render(
            <LegendList
                data={data}
                estimatedItemSize={296}
                getFixedItemSize={() => 296}
                horizontal
                keyExtractor={(item: { id: string }) => item.id}
                recycleItems
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
                snapToIndices={[0, 12, 24, 36]}
            />,
        );

        await flushAsync();
        await act(async () => {
            lastListProps?.onLayout?.({
                nativeEvent: { layout: { height: 200, width: 696, x: 0, y: 0 } },
            } as any);
        });
        await flushAsync();

        const ctx = await getContextFromRender();
        expect(lastListProps?.snapToIndices).toEqual([0, 12, 24, 36]);
        expect(ctx.values.get("snapToOffsets")).toEqual([0, 3552, 7104, 10656]);
        expect(ctx.state.startBuffered).toBe(0);
        expect(ctx.state.endBuffered).toBeLessThan(12);

        rendered.unmount();
    });

    it("does not issue a mount content offset when no initial scroll is configured", async () => {
        const data = [
            { id: "item-1", label: "Alpha" },
            { id: "item-2", label: "Beta" },
        ];
        const { LegendList } = await import("../../src/components/LegendList?props-test-no-initial-scroll");

        const rendered = render(
            <LegendList
                data={data}
                estimatedItemSize={100}
                keyExtractor={(item: { id: string }) => item.id}
                recycleItems={false}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
            />,
        );

        await getStateFromRender();
        expect(lastListProps.initialContentOffset).toBeUndefined();

        rendered.unmount();
    });

    it("sets readyToRender after layout when no initial scroll is configured", async () => {
        const data = [
            { id: "item-1", label: "Alpha" },
            { id: "item-2", label: "Beta" },
        ];
        const onLoadCalls: number[] = [];
        const { LegendList } = await import("../../src/components/LegendList?props-test-ready-no-initial-scroll");

        const rendered = render(
            <LegendList
                data={data}
                estimatedItemSize={100}
                keyExtractor={(item: { id: string }) => item.id}
                onLoad={({ elapsedTimeInMs }) => onLoadCalls.push(elapsedTimeInMs)}
                recycleItems={false}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
            />,
        );

        const ctx = await getContextFromRender();
        expect(ctx.values.get("readyToRender")).toBeUndefined();

        await act(async () => {
            setDidLayout(ctx);
        });
        await flushAsync();

        expect(ctx.values.get("readyToRender")).toBe(true);
        expect(onLoadCalls).toHaveLength(1);

        rendered.unmount();
    });

    it("uses the configured adaptive render initial mode before readyToRender", async () => {
        const data = [
            { id: "item-1", label: "Alpha" },
            { id: "item-2", label: "Beta" },
        ];
        const { LegendList } = await import("../../src/components/LegendList?props-test-adaptive-render-initial-mode");

        const rendered = render(
            <LegendList
                data={data}
                estimatedItemSize={100}
                experimental_adaptiveRender={{ initialMode: "light" }}
                keyExtractor={(item: { id: string }) => item.id}
                recycleItems={false}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
            />,
        );

        const ctx = await getContextFromRender();
        expect(ctx.values.get("readyToRender")).toBeUndefined();
        expect(ctx.values.get("adaptiveRender")).toBe("light");

        await act(async () => {
            setDidLayout(ctx);
        });
        await flushAsync();

        expect(ctx.values.get("readyToRender")).toBe(true);
        expect(ctx.values.get("adaptiveRender")).toBe("normal");

        rendered.unmount();
    });

    it("resets adaptive render when the config is disabled", async () => {
        const data = [
            { id: "item-1", label: "Alpha" },
            { id: "item-2", label: "Beta" },
        ];
        const changes: Array<[string, string]> = [];
        const { LegendList } = await import("../../src/components/LegendList?props-test-adaptive-render-disable");
        const renderList = (experimental_adaptiveRender?: {
            exitDelay?: number;
            initialMode?: "light";
            onChange?: (mode: "normal" | "light", reason: string) => void;
        }) => (
            <LegendList
                data={data}
                estimatedItemSize={100}
                experimental_adaptiveRender={experimental_adaptiveRender}
                keyExtractor={(item: { id: string }) => item.id}
                recycleItems={false}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
            />
        );

        const rendered = render(
            renderList({
                exitDelay: 10_000,
                initialMode: "light",
                onChange: (mode, reason) => changes.push([mode, reason]),
            }),
        );
        const ctx = await getContextFromRender();
        ctx.state.scheduledWork.timeout(() => {}, 10_000, "adaptiveRender");

        expect(ctx.values.get("adaptiveRender")).toBe("light");

        rendered.rerender(renderList());
        await flushAsync();

        expect(ctx.values.get("adaptiveRender")).toBe("normal");
        expect(ctx.state.scheduledWork.has("adaptiveRender")).toBe(false);
        expect(changes).toEqual([]);

        rendered.unmount();
    });

    it("restarts layout readiness when cleared data is replaced with a new non-empty dataset", async () => {
        const initialData = [
            { id: "item-1", label: "Alpha" },
            { id: "item-2", label: "Beta" },
        ];
        const nextData = [
            { id: "item-3", label: "Gamma" },
            { id: "item-4", label: "Delta" },
        ];
        const { LegendList } = await import("../../src/components/LegendList?props-test-empty-fresh-dataset");
        const renderList = (data: typeof initialData) => (
            <LegendList
                data={data}
                estimatedItemSize={100}
                experimental_adaptiveRender={{ initialMode: "light" }}
                keyExtractor={(item: { id: string }) => item.id}
                recycleItems={false}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
            />
        );

        const rendered = render(renderList(initialData));
        const ctx = await getContextFromRender();

        await act(async () => {
            setDidLayout(ctx);
        });
        await flushAsync();

        expect(ctx.values.get("readyToRender")).toBe(true);
        expect(ctx.values.get("adaptiveRender")).toBe("normal");

        rendered.rerender(renderList([]));
        await flushAsync();

        expect(ctx.values.get("readyToRender")).toBe(true);

        rendered.rerender(renderList(nextData));
        await flushAsync();

        expect(ctx.state.didContainersLayout).toBe(false);
        expect(ctx.state.didFinishInitialScroll).toBe(true);
        expect(ctx.values.get("readyToRender")).toBe(false);
        expect(ctx.values.get("adaptiveRender")).toBe("light");

        await act(async () => {
            setDidLayout(ctx);
        });
        await flushAsync();

        expect(ctx.values.get("readyToRender")).toBe(true);
        expect(ctx.values.get("adaptiveRender")).toBe("normal");

        rendered.unmount();
    });

    it("restarts layout readiness when dataKey changes with non-empty data", async () => {
        mock.module("@/components/ListComponent", () => ({
            ListComponent: (props: any) => {
                lastListProps = props;
                useArr$(["readyToRender"]);
                return null;
            },
        }));
        const initialData = [
            { id: "item-1", label: "Alpha" },
            { id: "item-2", label: "Beta" },
        ];
        const nextData = [
            { id: "item-3", label: "Gamma" },
            { id: "item-4", label: "Delta" },
        ];
        const { LegendList } = await import("../../src/components/LegendList?props-test-data-key-fresh-dataset");
        const consoleError = mock(() => {});
        const originalConsoleError = console.error;
        console.error = consoleError;
        const renderList = (data: typeof initialData, dataKey: string) => (
            <LegendList
                data={data}
                dataKey={dataKey}
                estimatedItemSize={100}
                experimental_adaptiveRender={{ initialMode: "light" }}
                keyExtractor={(item: { id: string }) => item.id}
                recycleItems={false}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
            />
        );

        try {
            const rendered = render(renderList(initialData, "conversation-1"));
            const ctx = await getContextFromRender();

            await act(async () => {
                setDidLayout(ctx);
            });
            await flushAsync();

            expect(ctx.values.get("readyToRender")).toBe(true);
            expect(ctx.values.get("adaptiveRender")).toBe("normal");
            const initialFreshDataTransitionEpoch = lastListProps.freshDataTransitionEpoch;

            rendered.rerender(renderList(nextData, "conversation-2"));
            await flushAsync();

            expect(ctx.state.didContainersLayout).toBe(false);
            expect(ctx.state.didFinishInitialScroll).toBe(true);
            expect(ctx.values.get("readyToRender")).toBe(false);
            expect(ctx.values.get("adaptiveRender")).toBe("light");
            expect(lastListProps.freshDataTransitionEpoch).toBe(initialFreshDataTransitionEpoch + 1);
            expect(consoleError.mock.calls.flat().join(" ")).not.toContain("Cannot update a component");

            await act(async () => {
                setDidLayout(ctx);
            });
            await flushAsync();

            expect(ctx.values.get("readyToRender")).toBe(true);
            expect(ctx.values.get("adaptiveRender")).toBe("normal");

            rendered.unmount();
        } finally {
            console.error = originalConsoleError;
        }
    });

    it("clears zero-valued initial scroll targets on mount", async () => {
        const data = [
            { id: "item-1", label: "Alpha" },
            { id: "item-2", label: "Beta" },
        ];
        const { LegendList } = await import("../../src/components/LegendList?props-test-zero");

        const renderList = (props: { initialScrollIndex?: number; initialScrollOffset?: number }) =>
            render(
                <LegendList
                    data={data}
                    estimatedItemSize={100}
                    keyExtractor={(item: { id: string }) => item.id}
                    recycleItems={false}
                    renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
                    {...props}
                />,
            );

        const indexRenderer = renderList({ initialScrollIndex: 0 });
        const indexState = await getStateFromRender();
        const indexContext = await getContextFromRender();
        expect(indexState.didFinishInitialScroll).toBe(true);
        expect(indexState.initialScroll).toBeUndefined();
        expect(indexContext.values.get("readyToRender")).toBeUndefined();
        await act(async () => {
            setDidLayout(indexContext);
        });
        await flushAsync();
        expect(indexContext.values.get("readyToRender")).toBe(true);
        indexRenderer.unmount();

        const offsetRenderer = renderList({ initialScrollOffset: 0 });
        const offsetState = await getStateFromRender();
        const offsetContext = await getContextFromRender();
        expect(offsetState.didFinishInitialScroll).toBe(true);
        expect(offsetState.initialScroll).toBeUndefined();
        expect(offsetContext.values.get("readyToRender")).toBeUndefined();
        await act(async () => {
            setDidLayout(offsetContext);
        });
        await flushAsync();
        expect(offsetContext.values.get("readyToRender")).toBe(true);
        offsetRenderer.unmount();
    });

    it("clears zero-valued object initial scroll targets on mount", async () => {
        const data = [
            { id: "item-1", label: "Alpha" },
            { id: "item-2", label: "Beta" },
        ];
        const { LegendList } = await import("../../src/components/LegendList?props-test-zero-object");

        const rendered = render(
            <LegendList
                data={data}
                estimatedItemSize={100}
                initialScrollIndex={{ index: 0, viewOffset: 0, viewPosition: 0 }}
                keyExtractor={(item: { id: string }) => item.id}
                recycleItems={false}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
            />,
        );

        const state = await getStateFromRender();
        expect(state.didFinishInitialScroll).toBe(true);
        expect(state.initialScroll).toBeUndefined();

        rendered.unmount();
    });

    it("finishes empty zero-valued initial scroll targets so onLoad can fire", async () => {
        const onLoadCalls: number[] = [];
        const { LegendList } = await import("../../src/components/LegendList?props-test-empty-zero");

        const renderList = (props: { initialScrollIndex?: number; initialScrollOffset?: number }) =>
            render(
                <LegendList
                    data={[]}
                    estimatedItemSize={100}
                    keyExtractor={(item: { id: string }) => item.id}
                    onLoad={({ elapsedTimeInMs }) => onLoadCalls.push(elapsedTimeInMs)}
                    recycleItems={false}
                    renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
                    {...props}
                />,
            );

        const indexRenderer = renderList({ initialScrollIndex: 0 });
        const indexState = await getStateFromRender();
        const indexContext = await getContextFromRender();
        expect(indexState.didFinishInitialScroll).toBe(true);
        expect(indexState.initialScroll).toBeUndefined();
        await act(async () => {
            setDidLayout(indexContext);
        });
        await flushAsync();
        expect(indexContext.values.get("readyToRender")).toBe(true);
        expect(onLoadCalls).toHaveLength(1);
        indexRenderer.unmount();

        onLoadCalls.length = 0;

        const offsetRenderer = renderList({ initialScrollOffset: 0 });
        const offsetState = await getStateFromRender();
        const offsetContext = await getContextFromRender();
        expect(offsetState.didFinishInitialScroll).toBe(true);
        expect(offsetState.initialScroll).toBeUndefined();
        await act(async () => {
            setDidLayout(offsetContext);
        });
        await flushAsync();
        expect(offsetContext.values.get("readyToRender")).toBe(true);
        expect(onLoadCalls).toHaveLength(1);
        offsetRenderer.unmount();
    });

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
                recycleItems={false}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
            />,
        );

        const state = await getStateFromRender();

        expect(state.initialScroll?.index).toBe(2);
        expect(state.initialScroll?.viewOffset).toBeCloseTo(0);

        rendered.unmount();
    });

    it("offsets horizontal initialScrollAtEnd by the logical end padding", async () => {
        const data = [
            { id: "item-1", label: "Alpha" },
            { id: "item-2", label: "Beta" },
            { id: "item-3", label: "Gamma" },
        ];

        const { LegendList } = await import("../../src/components/LegendList?props-test-horizontal-end-padding");
        const rendered = render(
            <LegendList
                contentContainerStyle={{ paddingBottom: 40, paddingRight: 12 }}
                data={data}
                estimatedItemSize={100}
                horizontal
                initialScrollAtEnd
                keyExtractor={(item: { id: string }) => item.id}
                recycleItems={false}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
                rtl={false}
            />,
        );

        const state = await getStateFromRender();
        expect(state.initialScroll?.index).toBe(2);
        expect(state.initialScroll?.viewOffset).toBe(-12);

        rendered.unmount();
    });

    it("finishes empty initialScrollAtEnd mounts so onLoad can fire", async () => {
        const onLoadCalls: number[] = [];

        const { LegendList } = await import("../../src/components/LegendList?props-test-empty-end");
        const rendered = render(
            <LegendList
                data={[]}
                estimatedItemSize={100}
                initialScrollAtEnd
                keyExtractor={(item: { id: string }) => item.id}
                onLoad={({ elapsedTimeInMs }) => onLoadCalls.push(elapsedTimeInMs)}
                recycleItems={false}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
            />,
        );

        const state = await getStateFromRender();
        expect(state.didFinishInitialScroll).toBe(true);
        expect(state.initialScroll?.contentOffset).toBe(0);

        await act(async () => {
            setDidLayout((handlerInstances.at(-1) as any).context);
        });
        await flushAsync();

        expect(onLoadCalls).toHaveLength(1);

        rendered.unmount();
    });

    it("sets readyToRender after a non-zero offset-only initial scroll finishes", async () => {
        const data = Array.from({ length: 10 }, (_value, index) => ({
            id: `item-${index}`,
            label: `Item ${index}`,
        }));
        const onLoadCalls: number[] = [];
        const { LegendList } = await import("../../src/components/LegendList?props-test-offset-ready");

        const rendered = render(
            <LegendList
                data={data}
                estimatedItemSize={100}
                initialScrollOffset={220}
                keyExtractor={(item: { id: string }) => item.id}
                onLoad={({ elapsedTimeInMs }) => onLoadCalls.push(elapsedTimeInMs)}
                recycleItems={false}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
            />,
        );

        const state = await getStateFromRender();
        const ctx = await getContextFromRender();
        expect(state.initialScroll?.contentOffset).toBe(220);
        expect(ctx.values.get("readyToRender")).toBeUndefined();

        await act(async () => {
            setDidLayout(ctx);
        });
        await flushAsync();

        expect(ctx.values.get("readyToRender")).toBeUndefined();

        state.scrollingTo = {
            animated: false,
            isInitialScroll: true,
            offset: 220,
        } as any;
        state.scroll = 220;
        state.scrollPending = 220;
        state.scrollPrev = 220;

        await act(async () => {
            finishScrollTo(ctx);
        });

        expect(state.didFinishInitialScroll).toBe(true);
        expect(ctx.values.get("readyToRender")).toBe(true);
        expect(onLoadCalls).toHaveLength(1);

        rendered.unmount();
    });

    it("defaults bottom-aligned initialScrollIndex object viewOffset from paddingBottom", async () => {
        const data = [
            { id: "item-1", label: "Alpha" },
            { id: "item-2", label: "Beta" },
            { id: "item-3", label: "Gamma" },
        ];

        const { LegendList } = await import("../../src/components/LegendList?props-test-view-position-default");
        const rendered = render(
            <LegendList
                data={data}
                estimatedItemSize={100}
                initialScrollIndex={{ index: 2, viewPosition: 1 }}
                keyExtractor={(item: { id: string }) => item.id}
                recycleItems={false}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
                style={{ paddingBottom: 12 }}
            />,
        );

        const state = await getStateFromRender();
        expect(state.initialScroll?.index).toBe(2);
        expect(state.initialScroll?.viewPosition).toBe(1);
        expect(state.initialScroll?.viewOffset).toBe(-12);

        rendered.unmount();
    });

    it("offsets the built-in RefreshControl by contentContainerStyle.paddingTop", async () => {
        const data = [
            { id: "item-1", label: "Alpha" },
            { id: "item-2", label: "Beta" },
        ];

        const { LegendList } = await import("../../src/components/LegendList?props-test-refresh-padding-top");
        const rendered = render(
            <LegendList
                contentContainerStyle={{ paddingTop: 24 }}
                data={data}
                estimatedItemSize={100}
                keyExtractor={(item: { id: string }) => item.id}
                onRefresh={() => {}}
                progressViewOffset={6}
                recycleItems={false}
                refreshing={false}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
            />,
        );

        expect(lastListProps.refreshControl.props.progressViewOffset).toBe(30);

        rendered.unmount();
    });

    it("offsets a custom RefreshControl by contentContainerStyle.paddingTop", async () => {
        const data = [
            { id: "item-1", label: "Alpha" },
            { id: "item-2", label: "Beta" },
        ];

        const { LegendList } = await import("../../src/components/LegendList?props-test-custom-refresh-padding-top");
        const rendered = render(
            <LegendList
                contentContainerStyle={{ paddingTop: 24 }}
                data={data}
                estimatedItemSize={100}
                keyExtractor={(item: { id: string }) => item.id}
                recycleItems={false}
                refreshControl={<RefreshControl progressViewOffset={6} refreshing={false} />}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
            />,
        );

        expect(lastListProps.refreshControl.props.progressViewOffset).toBe(30);

        rendered.unmount();
    });

    it("does not retry a finished initial scroll after the user scrolls away", async () => {
        const data = Array.from({ length: 10 }, (_value, index) => ({
            id: `item-${index}`,
            label: `Item ${index}`,
        }));

        const { LegendList } = await import("../../src/components/LegendList?props-test-retry");
        const rendered = render(
            <LegendList
                data={data}
                estimatedItemSize={100}
                getFixedItemSize={() => 100}
                initialScrollIndex={3}
                keyExtractor={(item: { id: string }) => item.id}
                recycleItems={false}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
            />,
        );

        const state = await getStateFromRender();
        expect(state.initialScroll?.contentOffset).toBe(300);

        scrollToCalls = [];
        state.didFinishInitialScroll = true;
        state.initialScroll = undefined;
        state.scroll = 120;

        await act(async () => {
            lastListProps?.onLayout?.({
                nativeEvent: { layout: { height: 180, width: 320, x: 0, y: 0 } },
            } as any);
        });
        await flushAsync();

        expect(scrollToCalls).toEqual([]);

        rendered.unmount();
    });

    it("does not use the removed post-finish layout retry window for bootstrap initial scroll", async () => {
        const data = Array.from({ length: 10 }, (_value, index) => ({
            id: `item-${index}`,
            label: `Item ${index}`,
        }));

        const { LegendList } = await import("../../src/components/LegendList?props-test-retry-window");
        const rendered = render(
            <LegendList
                data={data}
                estimatedItemSize={100}
                getFixedItemSize={() => 100}
                initialScrollIndex={{ index: 3, viewPosition: 1 }}
                keyExtractor={(item: { id: string }) => item.id}
                recycleItems={false}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
            />,
        );

        const state = await getStateFromRender();
        const targetOffset = lastListProps.initialContentOffset ?? state.initialScroll?.contentOffset ?? 0;

        scrollToCalls = [];
        state.didFinishInitialScroll = true;
        state.initialScroll = undefined;
        state.scroll = targetOffset;

        await act(async () => {
            lastListProps?.onLayout?.({
                nativeEvent: { layout: { height: 180, width: 320, x: 0, y: 0 } },
            } as any);
        });
        await flushAsync();

        expect(scrollToCalls).toEqual([]);

        rendered.unmount();
    });

    it("does not retry a finished offset-only initial scroll after a layout change", async () => {
        const data = Array.from({ length: 10 }, (_value, index) => ({
            id: `item-${index}`,
            label: `Item ${index}`,
        }));

        const { LegendList } = await import("../../src/components/LegendList?props-test-offset-retry");
        const rendered = render(
            <LegendList
                data={data}
                estimatedItemSize={100}
                initialScrollOffset={220}
                keyExtractor={(item: { id: string }) => item.id}
                recycleItems={false}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
            />,
        );

        const state = await getStateFromRender();
        expect(state.initialScroll?.contentOffset).toBe(220);

        scrollToCalls = [];
        state.didFinishInitialScroll = true;
        state.initialScroll = undefined;
        state.scroll = 220;

        await act(async () => {
            lastListProps?.onLayout?.({
                nativeEvent: { layout: { height: 180, width: 320, x: 0, y: 0 } },
            } as any);
        });
        await flushAsync();

        expect(scrollToCalls).toEqual([]);

        rendered.unmount();
    });

    it("replays offset-only initialScroll with a native scroll after data arrives post-layout", async () => {
        const { LegendList } = await import("../../src/components/LegendList?props-test-offset-async");
        const renderList = (data: Array<{ id: string; label: string }>) => (
            <LegendList
                data={data}
                estimatedItemSize={100}
                getFixedItemSize={() => 100}
                initialScrollOffset={250}
                keyExtractor={(item: { id: string }) => item.id}
                recycleItems={false}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
            />
        );

        const rendered = render(renderList([]));
        await getStateFromRender();

        await act(async () => {
            lastListProps?.onLayout?.(layoutEvent as any);
        });
        await flushAsync();

        scrollToCalls = [];
        await act(async () => {
            rendered.rerender(
                renderList(
                    Array.from({ length: 5 }, (_value, index) => ({
                        id: `item-${index}`,
                        label: `Item ${index}`,
                    })),
                ),
            );
        });
        await flushAsync();

        expect(scrollToCalls).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    forceScroll: true,
                    isInitialScroll: true,
                    offset: 250,
                }),
            ]),
        );

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
                recycleItems={false}
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
        const longListLayoutEvent = {
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
                recycleItems={false}
                renderItem={({ item, index }: { item: { label: string }; index: number }) => {
                    observedRenderedIndices.add(index);
                    return <Text>{item.label}</Text>;
                }}
            />,
        );

        const state = await getStateFromRender();
        await act(async () => {
            lastListProps?.onLayout?.(longListLayoutEvent as any);
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

    it("warns on web when the outer height is effectively unbounded and virtualization is disabled", async () => {
        const consoleWarnSpy = mock(() => {});
        const originalWarn = console.warn;
        console.warn = consoleWarnSpy as any;
        const reactNative = await import("react-native");
        const previousPlatform = reactNative.Platform.OS;
        reactNative.Platform.OS = "web" as any;
        const data = Array.from({ length: 120 }, (_value, index) => ({
            id: `item-${index}`,
            label: `Item ${index}`,
        }));
        const { LegendList } = await import("../../src/components/LegendList?props-test-web-unbounded-warning");

        try {
            const rendered = render(
                <LegendList
                    data={data}
                    estimatedItemSize={100}
                    keyExtractor={(item: { id: string }) => item.id}
                    recycleItems={false}
                    renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
                />,
            );

            const ctx = await getContextFromRender();
            const state = await getStateFromRender();

            await act(async () => {
                state.scrollLength = 12000;
                set$(ctx, "totalSize", 12000);
                set$(ctx, "numContainers", 120);
                set$(ctx, "readyToRender", true);
            });
            await flushAsync();

            expect(consoleWarnSpy).toHaveBeenCalledWith(
                "[legend-list] LegendList appears to have an unbounded outer height on web, so virtualization is effectively disabled. Set a bounded height or flex: 1 on the list container, or use useWindowScroll.",
            );

            rendered.unmount();
        } finally {
            reactNative.Platform.OS = previousPlatform;
            console.warn = originalWarn;
        }
    });

    it("does not warn on web when container allocation stays bounded", async () => {
        const consoleWarnSpy = mock(() => {});
        const originalWarn = console.warn;
        console.warn = consoleWarnSpy as any;
        const reactNative = await import("react-native");
        const previousPlatform = reactNative.Platform.OS;
        reactNative.Platform.OS = "web" as any;
        const data = Array.from({ length: 120 }, (_value, index) => ({
            id: `item-${index}`,
            label: `Item ${index}`,
        }));
        const { LegendList } = await import("../../src/components/LegendList?props-test-web-bounded-warning");

        try {
            const rendered = render(
                <LegendList
                    data={data}
                    estimatedItemSize={100}
                    keyExtractor={(item: { id: string }) => item.id}
                    recycleItems={false}
                    renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
                />,
            );

            const ctx = await getContextFromRender();
            const state = await getStateFromRender();

            await act(async () => {
                state.scrollLength = 800;
                set$(ctx, "totalSize", 12000);
                set$(ctx, "numContainers", 18);
                set$(ctx, "readyToRender", true);
            });
            await flushAsync();

            expect(consoleWarnSpy).not.toHaveBeenCalled();

            rendered.unmount();
        } finally {
            reactNative.Platform.OS = previousPlatform;
            console.warn = originalWarn;
        }
    });

    it("recalculates for prop-only anchoredEndSpace anchorIndex changes", async () => {
        const data = Array.from({ length: 20 }, (_value, index) => ({
            id: `item-${index}`,
            label: `Item ${index}`,
        }));
        const keyExtractor = (item: { id: string }) => item.id;
        const renderItem = ({ item }: { item: { label: string } }) => <Text>{item.label}</Text>;
        const { LegendList } = await import("../../src/components/LegendList?props-test-anchored-recalculate");
        const renderList = (listData = data, anchorIndex = 18) => (
            <LegendList
                anchoredEndSpace={{ anchorIndex }}
                data={listData}
                estimatedItemSize={100}
                keyExtractor={keyExtractor}
                recycleItems={false}
                renderItem={renderItem}
            />
        );

        const rendered = render(renderList());
        const state = await getStateFromRender();
        const triggerCalculateItemsInView = mock(() => {});
        state.triggerCalculateItemsInView = triggerCalculateItemsInView;

        await act(async () => {
            state.scrollForNextCalculateItemsInView = { bottom: 1000, top: -1000 };
            rendered.rerender(renderList(data, 19));
        });

        expect(triggerCalculateItemsInView).toHaveBeenCalledTimes(1);
        expect(state.scrollForNextCalculateItemsInView).toBeUndefined();

        triggerCalculateItemsInView.mockClear();

        await act(async () => {
            rendered.rerender(renderList([...data, { id: "item-20", label: "Item 20" }]));
        });

        expect(triggerCalculateItemsInView).not.toHaveBeenCalled();

        rendered.unmount();
    });

    it("recomputes anchored end space when only axis or logical end padding props change", async () => {
        const data = [
            { id: "item-0", label: "Item 0" },
            { id: "item-1", label: "Item 1" },
        ];
        const onSizeChanged = mock(() => {});
        const keyExtractor = (item: { id: string }) => item.id;
        const getFixedItemSize = () => 100;
        const renderItem = ({ item }: { item: { label: string } }) => <Text>{item.label}</Text>;
        const { LegendList } = await import("../../src/components/LegendList?props-test-anchored-axis-padding");
        const renderList = ({
            anchored = true,
            horizontal = false,
            paddingBottom = 0,
            rtl = false,
        }: {
            anchored?: boolean;
            horizontal?: boolean;
            paddingBottom?: number;
            rtl?: boolean;
        }) => (
            <LegendList
                anchoredEndSpace={anchored ? { anchorIndex: 1, onSizeChanged } : undefined}
                contentContainerStyle={{ paddingBottom, paddingLeft: 10, paddingRight: 30 }}
                data={data}
                estimatedItemSize={100}
                getFixedItemSize={getFixedItemSize}
                horizontal={horizontal}
                keyExtractor={keyExtractor}
                recycleItems={false}
                renderItem={renderItem}
                rtl={rtl}
            />
        );

        const rendered = render(renderList({}));
        const ctx = await getContextFromRender();
        const state = ctx.state;
        state.scrollLength = 300;
        onSizeChanged.mockClear();

        await act(async () => {
            rendered.rerender(renderList({ paddingBottom: 20 }));
        });
        expect(onSizeChanged).toHaveBeenCalledTimes(1);
        expect(onSizeChanged).toHaveBeenLastCalledWith(180);

        onSizeChanged.mockClear();
        await act(async () => {
            rendered.rerender(renderList({ horizontal: true, paddingBottom: 20 }));
        });
        expect(onSizeChanged).toHaveBeenCalledTimes(1);
        expect(onSizeChanged).toHaveBeenLastCalledWith(170);

        onSizeChanged.mockClear();
        await act(async () => {
            rendered.rerender(renderList({ horizontal: true, paddingBottom: 20, rtl: true }));
        });
        expect(onSizeChanged).toHaveBeenCalledTimes(1);
        expect(onSizeChanged).toHaveBeenLastCalledWith(190);

        await act(async () => {
            rendered.rerender(renderList({ anchored: false, horizontal: true, paddingBottom: 20, rtl: true }));
        });
        expect(peek$(ctx, "anchoredEndSpaceSize")).toBe(0);

        rendered.unmount();
    });

    it("clears stale precomputed scroll range when viewability is enabled", async () => {
        const data = Array.from({ length: 20 }, (_value, index) => ({
            id: `item-${index}`,
            label: `Item ${index}`,
        }));
        const keyExtractor = (item: { id: string }) => item.id;
        const renderItem = ({ item }: { item: { label: string } }) => <Text>{item.label}</Text>;
        const viewabilityConfig = { itemVisiblePercentThreshold: 50 };
        const { LegendList } = await import("../../src/components/LegendList?props-test-viewability-scroll-range");
        const renderList = (onViewableItemsChanged?: () => void) => (
            <LegendList
                data={data}
                estimatedItemSize={100}
                keyExtractor={keyExtractor}
                onViewableItemsChanged={onViewableItemsChanged}
                recycleItems={false}
                renderItem={renderItem}
                viewabilityConfig={viewabilityConfig}
            />
        );

        const rendered = render(renderList());
        const state = await getStateFromRender();

        await act(async () => {
            state.scrollForNextCalculateItemsInView = { bottom: null, top: 1000 };
            rendered.rerender(renderList(() => {}));
        });

        expect(state.enableScrollForNextCalculateItemsInView).toBe(true);
        expect(state.scrollForNextCalculateItemsInView).toBeUndefined();

        rendered.unmount();
    });
});
