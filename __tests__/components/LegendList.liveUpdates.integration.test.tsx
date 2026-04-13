import * as React from "react";
import { Text } from "react-native";

import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import type { StateContext } from "../../src/state/state";
import { useArr$ } from "../../src/state/state";
import TestRenderer, { act } from "../helpers/testRenderer";
import { registerBaseModuleMocks } from "../setup";

type InboxItem = {
    id: string;
    isUnread: boolean;
    label: string;
};

type InboxScenarioRef = {
    prepend: (count: number) => void;
    scrollToTop: () => Promise<void>;
};

type InboxScenarioProps = {
    LegendListComponent: React.ComponentType<any>;
    renderScrollComponent: (props: any) => React.ReactNode;
};

const layoutEvent = {
    nativeEvent: { layout: { height: 200, width: 320, x: 0, y: 0 } },
};

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
    return Array.from(new Set(collectTextFromTree(renderer.toJSON()).filter((value) => value.includes("Item "))));
}

function buildExistingItems(count: number) {
    return Array.from({ length: count }, (_, index) => ({
        id: `existing-${index}`,
        isUnread: false,
        label: `Item ${index} Read`,
    }));
}

function buildPrependedItems(start: number, count: number) {
    return Array.from({ length: count }, (_, offset) => {
        const sequence = start + offset;
        return {
            id: `prepended-${sequence}`,
            isUnread: true,
            label: `Item P${sequence} Unread`,
        };
    });
}

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

function IntegrationContainer({ getRenderedItem, id }: { getRenderedItem: (key: string) => any; id: number }) {
    const [data, itemKey, extraData] = useArr$([
        `containerItemData${id}` as const,
        `containerItemKey${id}` as const,
        "extraData",
    ]);
    const renderedItemInfo = React.useMemo(
        () => (itemKey !== undefined ? getRenderedItem(itemKey) : null),
        [data, extraData, getRenderedItem, itemKey],
    );

    return <>{renderedItemInfo?.renderedItem ?? null}</>;
}

function createScrollHarness() {
    let lastProps: any;
    let currentOffset = 0;

    const emitScroll = async (offset: number) => {
        currentOffset = offset;
        await act(async () => {
            lastProps?.onScroll?.({
                nativeEvent: {
                    contentOffset: { x: 0, y: offset },
                    contentSize: { height: 1200, width: 320 },
                },
            });
        });
    };

    const ScrollHarness = React.forwardRef(function ScrollHarnessComponent(props: any, ref: React.Ref<any>) {
        lastProps = props;

        React.useImperativeHandle(ref, () => ({
            flashScrollIndicators: () => {},
            getCurrentScrollOffset: () => currentOffset,
            getScrollableNode: () => ({}),
            getScrollEventTarget: () => null,
            getScrollResponder: () => null,
            measure: (cb: (x: number, y: number, width: number, height: number) => void) => cb(0, 0, 320, 200),
            scrollTo: ({ x = 0, y = 0 }: { x?: number; y?: number }) => {
                currentOffset = props.horizontal ? x : y;
                setTimeout(() => {
                    props.onScroll?.({
                        nativeEvent: {
                            contentOffset: { x: 0, y: currentOffset },
                            contentSize: { height: 1200, width: 320 },
                        },
                    });
                }, 0);
            },
            scrollToEnd: () => {},
        }));

        return <>{props.children}</>;
    });

    return {
        ScrollHarness,
        emitScroll,
        getLastProps: () => lastProps,
    };
}

function IntegrationListComponent(props: any) {
    const [numContainersPooled = 0] = useArr$(["numContainersPooled"]);

    const renderedItems = props.canRender
        ? Array.from({ length: numContainersPooled }, (_, id) => (
              <IntegrationContainer getRenderedItem={props.getRenderedItem} id={id} key={id} />
          ))
        : null;

    if (!props.renderScrollComponent) {
        return <>{renderedItems}</>;
    }

    return props.renderScrollComponent({
        children: renderedItems,
        contentContainerStyle: props.contentContainerStyle,
        horizontal: props.horizontal,
        onLayout: props.onLayout,
        onScroll: props.onScroll,
        ref: props.refScrollView,
        style: props.style,
    });
}

function registerIntegrationMocks() {
    mock.module("@/components/ListComponent", () => ({
        ListComponent: IntegrationListComponent,
    }));

    mock.module("@/core/ScrollAdjustHandler", () => ({
        ScrollAdjustHandler: class {
            constructor(_ctx: StateContext) {}

            requestAdjust() {}
            setMounted() {}
            getAdjust() {
                return 0;
            }
        },
    }));
}

const InboxScenario = React.forwardRef<InboxScenarioRef, InboxScenarioProps>(function InboxScenarioComponent(
    { LegendListComponent, renderScrollComponent },
    ref,
) {
    const [items, setItems] = React.useState(() => buildExistingItems(8));
    const nextPrependedRef = React.useRef(1);
    const listRef = React.useRef<any>(null);

    React.useImperativeHandle(ref, () => ({
        prepend(count: number) {
            const nextItems = buildPrependedItems(nextPrependedRef.current, count);
            nextPrependedRef.current += count;
            setItems((previous) => [...nextItems, ...previous]);
        },
        scrollToTop() {
            return listRef.current?.scrollToOffset({ animated: false, offset: 0 }) ?? Promise.resolve();
        },
    }));

    const handleViewableItemsChanged = React.useCallback(
        ({ viewableItems }: { viewableItems: Array<{ item: InboxItem }> }) => {
            const visibleIds = new Set(viewableItems.map((token) => token.item.id));
            if (visibleIds.size === 0) {
                return;
            }

            setItems((current) => {
                let didChange = false;
                const nextItems = current.map((item) => {
                    if (!item.isUnread || !visibleIds.has(item.id)) {
                        return item;
                    }

                    didChange = true;
                    return {
                        ...item,
                        isUnread: false,
                        label: item.label.replace("Unread", "Read"),
                    };
                });

                return didChange ? nextItems : current;
            });
        },
        [],
    );

    return (
        <LegendListComponent
            data={items}
            drawDistance={0}
            estimatedItemSize={100}
            getFixedItemSize={() => 100}
            keyExtractor={(item: InboxItem) => item.id}
            maintainVisibleContentPosition
            onViewableItemsChanged={handleViewableItemsChanged}
            ref={listRef}
            renderItem={({ item }: { item: InboxItem }) => <Text>{item.label}</Text>}
            renderScrollComponent={renderScrollComponent}
            viewabilityConfig={{
                id: "live-updates-read",
                itemVisiblePercentThreshold: 60,
            }}
        />
    );
});

beforeEach(() => {
    mock.restore();
    registerBaseModuleMocks();
    registerIntegrationMocks();
});

afterEach(() => {
});

describe("LegendList live updates integration", () => {
    it("updates prepended visible items after a fast scroll to top", async () => {
        const scenarioRef = React.createRef<InboxScenarioRef>();
        const { ScrollHarness, emitScroll, getLastProps } = createScrollHarness();
        const { LegendList } = await import("../../src/components/LegendList?live-updates-integration");

        let renderer: TestRenderer.ReactTestRenderer;
        await act(async () => {
            renderer = TestRenderer.create(
                <InboxScenario
                    LegendListComponent={LegendList}
                    ref={scenarioRef}
                    renderScrollComponent={(props: any) => <ScrollHarness {...props} />}
                />,
            );
        });
        await flushFrames(8);

        await act(async () => {
            getLastProps()?.onLayout?.(layoutEvent as any);
        });
        await flushFrames(12);

        await emitScroll(300);
        await flushFrames(6);

        await act(async () => {
            scenarioRef.current?.prepend(3);
        });
        await flushFrames(12);

        expect(getRenderedLabels(renderer!)).not.toContain("Item P1 Read");

        await act(async () => {
            await scenarioRef.current?.scrollToTop();
        });
        await flushFrames(12);

        const labels = getRenderedLabels(renderer!);
        expect(labels).toContain("Item P1 Read");
        expect(labels).toContain("Item P2 Read");
        expect(labels).not.toContain("Item P1 Unread");

        await act(async () => {
            renderer!.unmount();
        });
    });
});
