import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import "../setup";

import * as React from "react";
import { Text } from "react-native";

import { setInitialScrollStrategyForTests } from "../../src/components/bootstrapInitialScroll";
import { Platform } from "../../src/platform/Platform";
import type { LegendListRef } from "../../src/types";
import TestRenderer, { act } from "../helpers/testRenderer";

const layoutEvent = {
    nativeEvent: { layout: { height: 200, width: 320, x: 0, y: 0 } },
};

async function flushAsync() {
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
}

async function flushFrames(count = 4) {
    for (let i = 0; i < count; i++) {
        await flushAsync();
    }
}

function collectTextFromTree(node: any, values: string[] = []) {
    if (node == null) {
        return values;
    }

    if (typeof node === "string") {
        values.push(node);
        return values;
    }

    if (Array.isArray(node)) {
        for (const child of node) {
            collectTextFromTree(child, values);
        }
        return values;
    }

    if (node.children) {
        collectTextFromTree(node.children, values);
    }

    return values;
}

function getRenderedLabels(renderer: TestRenderer.ReactTestRenderer) {
    return Array.from(new Set(collectTextFromTree(renderer.toJSON()).filter((value) => value.startsWith("Item "))));
}

function createItems(count: number) {
    return Array.from({ length: count }, (_, index) => ({
        id: `item-${index}`,
        label: `Item ${index}`,
    }));
}

function expectRenderedWindow(
    renderer: TestRenderer.ReactTestRenderer,
    options: {
        absent?: string[];
        present: string[];
    },
) {
    const labels = getRenderedLabels(renderer);

    for (const expected of options.present) {
        expect(labels).toContain(expected);
    }

    for (const unexpected of options.absent ?? []) {
        expect(labels).not.toContain(unexpected);
    }
}

function expectScrollClose(ref: React.RefObject<LegendListRef | null>, expected: number) {
    expect(Math.abs((ref.current?.getState().scroll ?? 0) - expected) <= 1).toBe(true);
}

function expectScrollCallsContain(scrollCalls: number[], expected: number) {
    expect(scrollCalls.some((value) => Math.abs(value - expected) <= 1)).toBe(true);
}

function createScrollHarness() {
    const scrollCalls: number[] = [];
    let lastProps: any;

    const ScrollHarness = React.forwardRef(function ScrollHarnessComponent(props: any, ref: React.Ref<any>) {
        const currentOffsetRef = React.useRef(0);
        lastProps = props;

        React.useImperativeHandle(
            ref,
            () => ({
                flashScrollIndicators: () => {},
                getCurrentScrollOffset: () => currentOffsetRef.current,
                getScrollableNode: () => ({}),
                getScrollEventTarget: () => null,
                getScrollResponder: () => null,
                measure: (cb: (x: number, y: number, width: number, height: number) => void) => cb(0, 0, 320, 200),
                scrollTo: ({ x = 0, y = 0 }: { x?: number; y?: number }) => {
                    const next = props.horizontal ? x : y;
                    currentOffsetRef.current = next ?? 0;
                    scrollCalls.push(currentOffsetRef.current);
                },
                scrollToEnd: () => {},
            }),
            [props.horizontal],
        );

        return <>{props.children}</>;
    });

    return {
        getLastProps: () => lastProps,
        ScrollHarness,
        scrollCalls,
    };
}

async function renderInitialScrollScenario(options: {
    data: Array<{ id: string; label: string }>;
    importKey: string;
    legendListProps?: Record<string, unknown>;
    platform?: "ios" | "android" | "web";
}) {
    const previousPlatform = Platform.OS;
    Platform.OS = options.platform ?? "ios";
    const { ScrollHarness, getLastProps, scrollCalls } = createScrollHarness();
    const { LegendList } = await import(`../../src/components/LegendList?${options.importKey}`);
    const ref = React.createRef<LegendListRef>();

    const renderList = (data: Array<{ id: string; label: string }>) => (
        <LegendList
            data={data}
            drawDistance={0}
            estimatedItemSize={100}
            getFixedItemSize={() => 100}
            keyExtractor={(item: { id: string }) => item.id}
            ref={ref}
            renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
            renderScrollComponent={(props) => <ScrollHarness {...props} />}
            {...options.legendListProps}
        />
    );

    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
        renderer = TestRenderer.create(renderList(options.data));
    });
    await flushFrames();

    const fireLayout = async () => {
        await act(async () => {
            getLastProps()?.onLayout?.(layoutEvent as any);
        });
        await flushFrames(12);
    };

    const rerender = async (data: Array<{ id: string; label: string }>) => {
        await act(async () => {
            renderer!.update(renderList(data));
        });
        await flushFrames(12);
    };

    const cleanup = () => {
        Platform.OS = previousPlatform;
        renderer!.unmount();
    };

    return {
        cleanup,
        fireLayout,
        getLastProps,
        ref,
        renderer: renderer!,
        rerender,
        scrollCalls,
    };
}

beforeEach(() => {
    setInitialScrollStrategyForTests("bootstrapReveal");
    Platform.OS = "ios";
});

afterEach(() => {
    setInitialScrollStrategyForTests(undefined);
    Platform.OS = "ios";
});

describe("LegendList initial scroll integration", () => {
    it("renders the expected window for fixed-size initialScrollIndex", async () => {
        const data = createItems(10);
        const scenario = await renderInitialScrollScenario({
            data,
            importKey: "initial-scroll-render-index-window",
            legendListProps: {
                initialScrollIndex: 5,
            },
        });

        await scenario.fireLayout();

        expectScrollClose(scenario.ref, 500);
        expectRenderedWindow(scenario.renderer, {
            absent: ["Item 0", "Item 9"],
            present: ["Item 5", "Item 6"],
        });

        scenario.cleanup();
    });

    it("renders the centered target window for object initialScrollIndex", async () => {
        const data = createItems(10);
        const scenario = await renderInitialScrollScenario({
            data,
            importKey: "initial-scroll-render-index-centered",
            legendListProps: {
                initialScrollIndex: { index: 5, viewPosition: 0.5 },
            },
        });

        await scenario.fireLayout();

        expect(Math.abs((scenario.ref.current?.getState().scroll ?? 0) - 450) <= 1).toBe(true);
        expectRenderedWindow(scenario.renderer, {
            absent: ["Item 0", "Item 9"],
            present: ["Item 4", "Item 5"],
        });

        scenario.cleanup();
    });

    it("applies viewOffset on object initialScrollIndex and renders the adjusted window", async () => {
        const data = createItems(10);
        const scenario = await renderInitialScrollScenario({
            data,
            importKey: "initial-scroll-render-index-centered-offset",
            legendListProps: {
                initialScrollIndex: { index: 5, viewOffset: 25, viewPosition: 0.5 },
            },
        });

        await scenario.fireLayout();

        expectScrollClose(scenario.ref, 425);
        expectRenderedWindow(scenario.renderer, {
            absent: ["Item 0", "Item 9"],
            present: ["Item 4", "Item 5"],
        });

        scenario.cleanup();
    });

    it("clamps a centered end-facing initialScrollIndex to the tail window", async () => {
        const data = createItems(10);
        const scenario = await renderInitialScrollScenario({
            data,
            importKey: "initial-scroll-render-index-centered-tail-clamped",
            legendListProps: {
                initialScrollIndex: { index: 9, viewPosition: 0.5 },
            },
        });

        await scenario.fireLayout();

        expectScrollClose(scenario.ref, 800);
        expectRenderedWindow(scenario.renderer, {
            absent: ["Item 0", "Item 1"],
            present: ["Item 8", "Item 9"],
        });

        scenario.cleanup();
    });

    it("treats initialScrollOffset as an absolute content offset", async () => {
        const { ScrollHarness, getLastProps, scrollCalls } = createScrollHarness();
        const { LegendList } = await import("../../src/components/LegendList?initial-scroll-integration-offset");
        const ref = React.createRef<LegendListRef>();
        const data = Array.from({ length: 20 }, (_, index) => ({ id: `item-${index}` }));

        let renderer: any;
        await act(async () => {
            renderer = TestRenderer.create(
                <LegendList
                    data={data}
                    estimatedItemSize={100}
                    getFixedItemSize={() => 100}
                    initialScrollOffset={250}
                    keyExtractor={(item: { id: string }) => item.id}
                    ref={ref}
                    renderItem={({ item }: { item: { id: string } }) => <Text>{item.id}</Text>}
                    renderScrollComponent={(props) => <ScrollHarness {...props} />}
                />,
            );
        });

        await flushAsync();

        expect(getLastProps()?.contentOffset?.y).toBe(250);

        await act(async () => {
            getLastProps()?.onLayout?.(layoutEvent as any);
        });
        await flushFrames(6);

        expect(scrollCalls.some((value) => Math.abs(value - 250) <= 1)).toBe(true);
        expect(ref.current?.getState().scroll).toBe(250);

        renderer.unmount();
    });

    it("renders the expected window for offset-only initial scrolls", async () => {
        const data = createItems(10);
        const scenario = await renderInitialScrollScenario({
            data,
            importKey: "initial-scroll-render-offset-window",
            legendListProps: {
                initialScrollOffset: 250,
            },
        });

        await scenario.fireLayout();

        expect(Math.abs((scenario.ref.current?.getState().scroll ?? 0) - 250) <= 1).toBe(true);
        expectRenderedWindow(scenario.renderer, {
            absent: ["Item 0", "Item 9"],
            present: ["Item 2", "Item 3"],
        });

        scenario.cleanup();
    });

    it("clamps oversized initialScrollOffset values to the tail window", async () => {
        const data = createItems(10);
        const scenario = await renderInitialScrollScenario({
            data,
            importKey: "initial-scroll-render-offset-clamped-tail",
            legendListProps: {
                initialScrollOffset: 950,
            },
        });

        await scenario.fireLayout();

        expectScrollClose(scenario.ref, 800);
        expectRenderedWindow(scenario.renderer, {
            absent: ["Item 0", "Item 1"],
            present: ["Item 8", "Item 9"],
        });

        scenario.cleanup();
    });

    it("renders the tail window for initialScrollAtEnd", async () => {
        const data = createItems(10);
        const scenario = await renderInitialScrollScenario({
            data,
            importKey: "initial-scroll-render-at-end-window",
            legendListProps: {
                initialScrollAtEnd: true,
            },
        });

        await scenario.fireLayout();

        expect(Math.abs((scenario.ref.current?.getState().scroll ?? 0) - 800) <= 1).toBe(true);
        expectRenderedWindow(scenario.renderer, {
            absent: ["Item 0", "Item 1"],
            present: ["Item 8", "Item 9"],
        });

        scenario.cleanup();
    });

    it("keeps initialScrollAtEnd at the origin when the content already fits", async () => {
        const data = createItems(2);
        const scenario = await renderInitialScrollScenario({
            data,
            importKey: "initial-scroll-render-at-end-short-content",
            legendListProps: {
                initialScrollAtEnd: true,
            },
        });

        await scenario.fireLayout();

        expect(scenario.ref.current?.getState().scroll).toBe(0);
        expect(getRenderedLabels(scenario.renderer)).toEqual(["Item 0", "Item 1"]);

        scenario.cleanup();
    });

    it("renders from the origin for zero-valued initial targets", async () => {
        const data = createItems(10);
        const scenario = await renderInitialScrollScenario({
            data,
            importKey: "initial-scroll-render-origin-zero",
            legendListProps: {
                initialScrollIndex: 0,
            },
        });

        await scenario.fireLayout();

        expect(scenario.ref.current?.getState().scroll).toBe(0);
        expectRenderedWindow(scenario.renderer, {
            absent: ["Item 5", "Item 9"],
            present: ["Item 0", "Item 1"],
        });

        scenario.cleanup();
    });

    it("re-targets initialScrollAtEnd when data arrives after mount", async () => {
        const { ScrollHarness, getLastProps, scrollCalls } = createScrollHarness();
        const { LegendList } = await import("../../src/components/LegendList?initial-scroll-integration-end");
        const ref = React.createRef<LegendListRef>();

        const renderList = (data: Array<{ id: string }>) => (
            <LegendList
                data={data}
                estimatedItemSize={100}
                getFixedItemSize={() => 100}
                initialScrollAtEnd
                keyExtractor={(item: { id: string }) => item.id}
                ref={ref}
                renderItem={({ item }: { item: { id: string } }) => <Text>{item.id}</Text>}
                renderScrollComponent={(props) => <ScrollHarness {...props} />}
            />
        );

        let renderer: any;
        await act(async () => {
            renderer = TestRenderer.create(renderList([]));
        });
        await flushAsync();

        await act(async () => {
            getLastProps()?.onLayout?.(layoutEvent as any);
        });
        await flushAsync();

        const items = Array.from({ length: 5 }, (_, index) => ({ id: `item-${index}` }));
        await act(async () => {
            renderer.update(renderList(items));
        });
        await flushFrames(12);

        await act(async () => {
            getLastProps()?.onLayout?.(layoutEvent as any);
        });
        await flushFrames(12);

        expect(scrollCalls.some((value) => value > 200)).toBe(true);
        expect((ref.current?.getState().scroll ?? 0) > 200).toBe(true);

        renderer.unmount();
    });

    it("renders the tail window when initialScrollAtEnd data arrives after mount", async () => {
        const scenario = await renderInitialScrollScenario({
            data: [],
            importKey: "initial-scroll-render-at-end-async-window",
            legendListProps: {
                initialScrollAtEnd: true,
            },
        });

        await scenario.fireLayout();
        await scenario.rerender(createItems(5));

        expect(Math.abs((scenario.ref.current?.getState().scroll ?? 0) - 300) <= 1).toBe(true);
        expectRenderedWindow(scenario.renderer, {
            absent: ["Item 0"],
            present: ["Item 3", "Item 4"],
        });

        scenario.cleanup();
    });

    it("keeps async initialScrollAtEnd at the origin when the arriving data fits in view", async () => {
        const scenario = await renderInitialScrollScenario({
            data: [],
            importKey: "initial-scroll-render-at-end-async-short-content",
            legendListProps: {
                initialScrollAtEnd: true,
            },
        });

        await scenario.fireLayout();
        await scenario.rerender(createItems(2));

        expect(scenario.ref.current?.getState().scroll).toBe(0);
        expect(getRenderedLabels(scenario.renderer)).toEqual(["Item 0", "Item 1"]);

        scenario.cleanup();
    });

    it("re-targets offset-only initialScroll when data arrives after mount", async () => {
        const { ScrollHarness, getLastProps } = createScrollHarness();
        const { LegendList } = await import("../../src/components/LegendList?initial-scroll-integration-offset-async");
        const ref = React.createRef<LegendListRef>();

        const renderList = (data: Array<{ id: string }>) => (
            <LegendList
                data={data}
                estimatedItemSize={100}
                getFixedItemSize={() => 100}
                initialScrollOffset={250}
                keyExtractor={(item: { id: string }) => item.id}
                ref={ref}
                renderItem={({ item }: { item: { id: string } }) => <Text>{item.id}</Text>}
                renderScrollComponent={(props) => <ScrollHarness {...props} />}
            />
        );

        let renderer: any;
        await act(async () => {
            renderer = TestRenderer.create(renderList([]));
        });
        await flushAsync();

        await act(async () => {
            getLastProps()?.onLayout?.(layoutEvent as any);
        });
        await flushFrames(6);

        const items = Array.from({ length: 5 }, (_, index) => ({ id: `item-${index}` }));
        await act(async () => {
            renderer.update(renderList(items));
        });
        await flushFrames(12);

        expect(Math.abs((ref.current?.getState().scroll ?? 0) - 250) <= 1).toBe(true);

        renderer.unmount();
    });

    it("settles Android initialScrollAtEnd without native scroll events and still renders the tail window", async () => {
        const data = createItems(10);
        const scenario = await renderInitialScrollScenario({
            data,
            importKey: "initial-scroll-render-at-end-android-silent",
            legendListProps: {
                initialScrollAtEnd: true,
            },
            platform: "android",
        });

        await scenario.fireLayout();

        expect(scenario.scrollCalls.length).toBeGreaterThan(0);
        expectScrollClose(scenario.ref, 800);
        expectRenderedWindow(scenario.renderer, {
            absent: ["Item 0", "Item 1"],
            present: ["Item 8", "Item 9"],
        });

        scenario.cleanup();
    });

    it("settles Android initialScrollIndex without native scroll events and still renders the target window", async () => {
        const data = createItems(10);
        const scenario = await renderInitialScrollScenario({
            data,
            importKey: "initial-scroll-render-index-android-silent",
            legendListProps: {
                initialScrollIndex: 5,
            },
            platform: "android",
        });

        await scenario.fireLayout();

        expectScrollClose(scenario.ref, 500);
        expectRenderedWindow(scenario.renderer, {
            absent: ["Item 0", "Item 9"],
            present: ["Item 5", "Item 6"],
        });

        scenario.cleanup();
    });

    it("settles Android initialScrollOffset without native scroll events and still renders the target window", async () => {
        const data = createItems(10);
        const scenario = await renderInitialScrollScenario({
            data,
            importKey: "initial-scroll-render-offset-android-silent",
            legendListProps: {
                initialScrollOffset: 250,
            },
            platform: "android",
        });

        await scenario.fireLayout();

        expectScrollCallsContain(scenario.scrollCalls, 249);
        expectScrollCallsContain(scenario.scrollCalls, 250);
        expectScrollClose(scenario.ref, 250);
        expectRenderedWindow(scenario.renderer, {
            absent: ["Item 0", "Item 9"],
            present: ["Item 2", "Item 3"],
        });

        scenario.cleanup();
    });

    it("renders the correct horizontal window for fixed-size initialScrollIndex", async () => {
        const data = createItems(10);
        const scenario = await renderInitialScrollScenario({
            data,
            importKey: "initial-scroll-render-index-horizontal-window",
            legendListProps: {
                horizontal: true,
                initialScrollIndex: 5,
            },
        });

        await scenario.fireLayout();

        expectScrollClose(scenario.ref, 500);
        expectRenderedWindow(scenario.renderer, {
            absent: ["Item 0", "Item 1"],
            present: ["Item 5", "Item 6", "Item 7"],
        });

        scenario.cleanup();
    });

    it("renders the horizontal tail window for initialScrollAtEnd", async () => {
        const data = createItems(10);
        const scenario = await renderInitialScrollScenario({
            data,
            importKey: "initial-scroll-render-at-end-horizontal-window",
            legendListProps: {
                horizontal: true,
                initialScrollAtEnd: true,
            },
        });

        await scenario.fireLayout();

        expectScrollClose(scenario.ref, 680);
        expectRenderedWindow(scenario.renderer, {
            absent: ["Item 0", "Item 1"],
            present: ["Item 7", "Item 8", "Item 9"],
        });

        scenario.cleanup();
    });
});
