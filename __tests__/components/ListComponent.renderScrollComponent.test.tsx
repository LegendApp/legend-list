import * as React from "react";
import { Text, View } from "react-native";

import { describe, expect, it } from "bun:test";
import { StateProvider, useStateContext } from "../../src/state/state";
import { createMockState } from "../__mocks__/createMockState";
import TestRenderer, { act } from "../helpers/testRenderer";
import "../setup";

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

function Header({ events }: { events: string[] }) {
    React.useEffect(() => {
        events.push("mount:header");
        return () => {
            events.push("unmount:header");
        };
    }, [events]);

    return <Text>Header</Text>;
}

function ListComponentHarness({
    events,
    label,
    ListComponent,
}: {
    events: string[];
    label: string;
    ListComponent: React.ComponentType<any>;
}) {
    const ctx = useStateContext();
    const state = React.useMemo(() => createMockState(), []);
    ctx.state = state;

    return (
        <ListComponent
            canRender={false}
            drawDistance={0}
            estimatedItemSize={100}
            getRenderedItem={() => null}
            horizontal={false}
            initialContentOffset={undefined}
            ListHeaderComponent={<Header events={events} />}
            onLayout={() => {}}
            onScroll={() => {}}
            recycleItems={false}
            refScrollView={{ current: null }}
            renderScrollComponent={(scrollProps) => {
                const { children, ...rest } = scrollProps as any;
                return (
                    <View {...rest}>
                        <Text>{label}</Text>
                        {children}
                    </View>
                );
            }}
            scrollAdjustHandler={state.scrollAdjustHandler}
            scrollEventThrottle={0}
            snapToIndices={undefined}
            stickyHeaderIndices={undefined}
            style={{}}
            updateItemSize={() => {}}
        />
    );
}

describe("ListComponent renderScrollComponent", () => {
    it("keeps the scroll subtree mounted when the render callback identity changes", async () => {
        const { ListComponent } = await import("../../src/components/ListComponent?render-scroll-component");
        const events: string[] = [];
        let renderer!: TestRenderer.ReactTestRenderer;

        act(() => {
            renderer = TestRenderer.create(
                <StateProvider>
                    <ListComponentHarness events={events} ListComponent={ListComponent} label="first" />
                </StateProvider>,
            );
        });

        expect(collectTextFromTree(renderer.toJSON())).toContain("first");
        expect(events).toEqual(["mount:header"]);

        act(() => {
            renderer.update(
                <StateProvider>
                    <ListComponentHarness events={events} ListComponent={ListComponent} label="second" />
                </StateProvider>,
            );
        });

        expect(collectTextFromTree(renderer.toJSON())).toContain("second");
        expect(events).toEqual(["mount:header"]);

        act(() => {
            renderer.unmount();
        });
    });
});
