import * as React from "react";
import { Text } from "react-native";

import { beforeEach, describe, expect, it, mock } from "bun:test";
import { useArr$, useStateContext } from "../../src/state/state";
import TestRenderer, { act } from "../helpers/testRenderer";
import { registerBaseModuleMocks } from "../setup";

type Item = { id: string; label: string };

type ScrollHarness = {
    getScrollCalls: () => Array<{ animated?: boolean; x?: number; y?: number }>;
    getScrollProps: () => any;
    ScrollComponent: React.ComponentType<any>;
};

let listPropsByFirstId: Map<string, any>;
let listScrollCallsByFirstId: Map<string, number>;

function createScrollHarness(): ScrollHarness {
    let scrollProps: any;
    const scrollCalls: Array<{ animated?: boolean; x?: number; y?: number }> = [];

    const ScrollComponent = React.forwardRef(function ScrollHarnessComponent(props: any, ref: React.Ref<any>) {
        scrollProps = props;
        React.useImperativeHandle(ref, () => ({
            flashScrollIndicators: () => undefined,
            getScrollableNode: () => null,
            getScrollResponder: () => null,
            scrollTo: (params: { animated?: boolean; x?: number; y?: number }) => {
                scrollCalls.push(params);
            },
            scrollToEnd: () => undefined,
        }));

        return <>{props.children}</>;
    });

    return {
        getScrollCalls: () => scrollCalls,
        getScrollProps: () => scrollProps,
        ScrollComponent,
    };
}

function IntegrationListComponent(props: any) {
    const ctx = useStateContext();
    const data = ctx.state.props.data as Item[];
    const firstId = data[0]?.id ?? "empty";
    const [numContainersPooled = 0] = useArr$(["numContainersPooled"]);
    listPropsByFirstId.set(firstId, { ...props, data });

    const children = props.canRender
        ? Array.from({ length: numContainersPooled }, (_, id) => <Text key={id}>{firstId}</Text>)
        : null;

    return props.renderScrollComponent({
        children,
        contentContainerStyle: props.contentContainerStyle,
        horizontal: props.horizontal,
        onLayout: props.onLayout,
        onMomentumScrollEnd: props.onMomentumScrollEnd,
        onScroll: (event: any) => {
            listScrollCallsByFirstId.set(firstId, (listScrollCallsByFirstId.get(firstId) ?? 0) + 1);
            props.onScroll?.(event);
        },
        ref: props.refScrollView,
        snapToOffsets: props.snapToOffsets,
        style: props.style,
    });
}

function registerLegendListGroupMocks() {
    mock.restore();
    registerBaseModuleMocks();
    mock.module("@/components/ListComponent", () => ({
        ListComponent: IntegrationListComponent,
    }));

    mock.module("@/core/ScrollAdjustHandler", () => ({
        ScrollAdjustHandler: class {
            requestAdjust() {}
            setMounted() {}
            getAdjust() {
                return 0;
            }
            commitPendingAdjust() {}
        },
    }));
}

async function createRenderer(element: React.ReactElement) {
    let renderer: ReturnType<typeof TestRenderer.create>;
    await act(async () => {
        renderer = TestRenderer.create(element);
    });
    return renderer!;
}

async function flushAsync() {
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
}

beforeEach(() => {
    listPropsByFirstId = new Map();
    listScrollCallsByFirstId = new Map();
    registerLegendListGroupMocks();
});

describe("LegendListGroup", () => {
    it("routes shared scroll events to the active list when activeKey changes", async () => {
        const { ScrollComponent, getScrollProps } = createScrollHarness();
        const { LegendListGroup } = await import("../../src/components/LegendListGroup?group-active-switching");
        const lists = [
            { data: [{ id: "a1", label: "A" }], key: "a", renderItem: () => null },
            { data: [{ id: "b1", label: "B" }], key: "b", renderItem: () => null },
        ];
        const renderer = await createRenderer(
            <LegendListGroup
                activeKey="a"
                estimatedItemSize={20}
                lists={lists}
                recycleItems={false}
                renderScrollComponent={(props) => <ScrollComponent {...props} />}
            />,
        );

        await act(async () => {
            getScrollProps().onScroll({ nativeEvent: { contentOffset: { x: 0, y: 10 } } });
        });

        expect(listScrollCallsByFirstId.get("a1")).toBe(1);
        expect(listScrollCallsByFirstId.get("b1")).toBeUndefined();

        await act(async () => {
            renderer.update(
                <LegendListGroup
                    activeKey="b"
                    estimatedItemSize={20}
                    lists={lists}
                    recycleItems={false}
                    renderScrollComponent={(props) => <ScrollComponent {...props} />}
                />,
            );
        });
        await act(async () => {
            getScrollProps().onScroll({ nativeEvent: { contentOffset: { x: 0, y: 20 } } });
        });

        expect(listScrollCallsByFirstId.get("b1")).toBe(1);

        await act(async () => {
            renderer.unmount();
        });
    });

    it("keeps inactive list updates lazy until activation by default", async () => {
        const { ScrollComponent } = createScrollHarness();
        const { LegendListGroup } = await import("../../src/components/LegendListGroup?group-lazy-data");
        const initialLists = [
            { data: [{ id: "a1", label: "A" }], key: "a", renderItem: () => null },
            { data: [{ id: "b1", label: "B" }], key: "b", renderItem: () => null },
        ];
        const nextLists = [initialLists[0], { data: [{ id: "b2", label: "B2" }], key: "b", renderItem: () => null }];
        const renderer = await createRenderer(
            <LegendListGroup
                activeKey="a"
                estimatedItemSize={20}
                lists={initialLists}
                recycleItems={false}
                renderScrollComponent={(props) => <ScrollComponent {...props} />}
            />,
        );

        await act(async () => {
            renderer.update(
                <LegendListGroup
                    activeKey="a"
                    estimatedItemSize={20}
                    lists={nextLists}
                    recycleItems={false}
                    renderScrollComponent={(props) => <ScrollComponent {...props} />}
                />,
            );
        });

        expect(listPropsByFirstId.has("b2")).toBe(false);
        expect(listPropsByFirstId.get("b1")?.data).toBe(initialLists[1].data);

        await act(async () => {
            renderer.update(
                <LegendListGroup
                    activeKey="b"
                    estimatedItemSize={20}
                    lists={nextLists}
                    recycleItems={false}
                    renderScrollComponent={(props) => <ScrollComponent {...props} />}
                />,
            );
        });

        expect(listPropsByFirstId.get("b2")?.data).toBe(nextLists[1].data);

        await act(async () => {
            renderer.unmount();
        });
    });

    it("delegates imperative state to the active list", async () => {
        const { ScrollComponent } = createScrollHarness();
        const { LegendListGroup } = await import("../../src/components/LegendListGroup?group-ref-state");
        const ref = React.createRef<any>();
        const lists = [
            { data: [{ id: "a1", label: "A" }], key: "a", renderItem: () => null },
            { data: [{ id: "b1", label: "B" }], key: "b", renderItem: () => null },
        ];
        const renderer = await createRenderer(
            <LegendListGroup
                activeKey="b"
                estimatedItemSize={20}
                lists={lists}
                recycleItems={false}
                ref={ref}
                renderScrollComponent={(props) => <ScrollComponent {...props} />}
            />,
        );

        expect(ref.current.getState().data).toBe(lists[1].data);

        await act(async () => {
            renderer.update(
                <LegendListGroup
                    activeKey="a"
                    estimatedItemSize={20}
                    lists={lists}
                    recycleItems={false}
                    ref={ref}
                    renderScrollComponent={(props) => <ScrollComponent {...props} />}
                />,
            );
        });

        expect(ref.current.getState().data).toBe(lists[0].data);

        await act(async () => {
            renderer.unmount();
        });
    });

    it("uses maintainVisibleContentPosition from the active list", async () => {
        const { ScrollComponent, getScrollProps } = createScrollHarness();
        const { LegendListGroup } = await import("../../src/components/LegendListGroup?group-mvcp");
        const lists = [
            {
                data: [{ id: "a1", label: "A" }],
                key: "a",
                maintainVisibleContentPosition: false,
                renderItem: () => null,
            },
            {
                data: [{ id: "b1", label: "B" }],
                key: "b",
                maintainVisibleContentPosition: true,
                renderItem: () => null,
            },
        ];
        const renderer = await createRenderer(
            <LegendListGroup
                activeKey="a"
                estimatedItemSize={20}
                lists={lists}
                recycleItems={false}
                renderScrollComponent={(props) => <ScrollComponent {...props} />}
            />,
        );

        expect(getScrollProps().maintainVisibleContentPosition).toBeUndefined();

        await act(async () => {
            renderer.update(
                <LegendListGroup
                    activeKey="b"
                    estimatedItemSize={20}
                    lists={lists}
                    recycleItems={false}
                    renderScrollComponent={(props) => <ScrollComponent {...props} />}
                />,
            );
        });

        expect(getScrollProps().maintainVisibleContentPosition).toEqual({ minIndexForVisible: 0 });

        await act(async () => {
            renderer.unmount();
        });
    });

    it("renders shared header and footer outside list layers", async () => {
        const { ScrollComponent } = createScrollHarness();
        const { LegendListGroup } = await import("../../src/components/LegendListGroup?group-header-footer");
        const renderer = await createRenderer(
            <LegendListGroup
                activeKey="a"
                estimatedItemSize={20}
                ListFooterComponent={<Text>Shared footer</Text>}
                ListHeaderComponent={<Text>Shared header</Text>}
                lists={[{ data: [{ id: "a1", label: "A" }], key: "a", renderItem: () => null }]}
                recycleItems={false}
                renderScrollComponent={(props) => <ScrollComponent {...props} />}
            />,
        );

        await flushAsync();

        expect(listPropsByFirstId.get("a1")?.ListHeaderComponent).toBeUndefined();
        expect(listPropsByFirstId.get("a1")?.ListFooterComponent).toBeUndefined();
        expect(JSON.stringify(renderer.toJSON())).toContain("Shared header");
        expect(JSON.stringify(renderer.toJSON())).toContain("Shared footer");

        await act(async () => {
            renderer.unmount();
        });
    });
});
