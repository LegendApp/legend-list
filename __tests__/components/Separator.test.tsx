import * as React from "react";

import { describe, expect, it } from "bun:test";
import "../setup";

import { Separator } from "@/components/Separator";
import { ContextContainer } from "@/state/ContextContainer";
import { type StateContext, StateProvider, set$, useStateContext } from "@/state/state";
import type { LegendListItemSeparatorProps } from "@/types.base";
import TestRenderer, { act } from "../helpers/testRenderer";

type Item = { id: string; group: string };

let currentCtx: StateContext | undefined;

function Setup({ children, initialValues }: { children: React.ReactNode; initialValues: Record<string, any> }) {
    const ctx = useStateContext();
    currentCtx = ctx;

    for (const [key, value] of Object.entries(initialValues)) {
        if (!ctx.values.has(key as any)) {
            ctx.values.set(key as any, value);
        }
    }

    return children;
}

function renderSeparator({
    initialValues,
    leadingItem,
    onSeparatorRender,
}: {
    initialValues: Record<string, any>;
    leadingItem: Item;
    onSeparatorRender: (props: LegendListItemSeparatorProps<Item>) => void;
}) {
    currentCtx = undefined;

    function ItemSeparatorComponent(props: LegendListItemSeparatorProps<Item>) {
        onSeparatorRender(props);
        return React.createElement("mock-separator", {
            leading: props.leadingItem?.id,
            trailing: props.trailingItem?.id,
        });
    }

    let renderer: TestRenderer.ReactTestRenderer | undefined;
    act(() => {
        renderer = TestRenderer.create(
            <StateProvider>
                <Setup initialValues={initialValues}>
                    <ContextContainer.Provider value={{ containerId: 0, triggerLayout: () => {} }}>
                        <Separator
                            containerId={0}
                            ItemSeparatorComponent={ItemSeparatorComponent}
                            leadingItem={leadingItem}
                        />
                    </ContextContainer.Provider>
                </Setup>
            </StateProvider>,
        );
    });

    return renderer!;
}

describe("Separator", () => {
    it("renders the separator with both the leading and the trailing item", () => {
        const leadingItem: Item = { group: "a", id: "item-0" };
        const trailingItem: Item = { group: "b", id: "item-1" };
        const renderedProps: LegendListItemSeparatorProps<Item>[] = [];

        const renderer = renderSeparator({
            initialValues: {
                containerItemKey0: "item-0",
                containerItemTrailingData0: trailingItem,
                lastItemKeys: ["item-9"],
            },
            leadingItem,
            onSeparatorRender: (props) => renderedProps.push(props),
        });

        expect(renderedProps.at(-1)).toEqual({ leadingItem, trailingItem });
        expect(renderer.toJSON()).toEqual({
            children: null,
            props: { leading: "item-0", trailing: "item-1" },
            type: "mock-separator",
        });

        act(() => {
            renderer.unmount();
        });
    });

    it("updates the trailing item without the leading item changing", () => {
        const leadingItem: Item = { group: "a", id: "item-0" };
        const trailingItem: Item = { group: "a", id: "item-1" };
        const nextTrailingItem: Item = { group: "b", id: "item-2" };
        const renderedProps: LegendListItemSeparatorProps<Item>[] = [];

        const renderer = renderSeparator({
            initialValues: {
                containerItemKey0: "item-0",
                containerItemTrailingData0: trailingItem,
                lastItemKeys: ["item-9"],
            },
            leadingItem,
            onSeparatorRender: (props) => renderedProps.push(props),
        });

        act(() => {
            set$(currentCtx!, "containerItemTrailingData0", nextTrailingItem);
        });

        expect(renderedProps.at(-1)).toEqual({ leadingItem, trailingItem: nextTrailingItem });
        expect(renderer.toJSON()).toEqual({
            children: null,
            props: { leading: "item-0", trailing: "item-2" },
            type: "mock-separator",
        });

        act(() => {
            renderer.unmount();
        });
    });

    it("renders nothing after the last item", () => {
        const leadingItem: Item = { group: "a", id: "item-0" };
        const renderedProps: LegendListItemSeparatorProps<Item>[] = [];

        const renderer = renderSeparator({
            initialValues: {
                containerItemKey0: "item-0",
                containerItemTrailingData0: undefined,
                lastItemKeys: ["item-0"],
            },
            leadingItem,
            onSeparatorRender: (props) => renderedProps.push(props),
        });

        expect(renderedProps).toHaveLength(0);
        expect(renderer.toJSON()).toBeNull();

        act(() => {
            renderer.unmount();
        });
    });
});
