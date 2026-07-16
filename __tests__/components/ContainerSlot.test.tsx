import * as React from "react";

import { describe, expect, it } from "bun:test";
import "../setup";

import { type ContainerComponentProps, ContainerSlotBase } from "@/components/ContainerSlot";
import { type StateContext, StateProvider, set$, useStateContext } from "@/state/state";
import TestRenderer, { act } from "../helpers/testRenderer";

let currentCtx: StateContext | undefined;

function Setup({ children, itemKey }: { children: React.ReactNode; itemKey?: string }) {
    const ctx = useStateContext();
    currentCtx = ctx;

    if (itemKey !== undefined) {
        ctx.values.set("containerItemKey0", itemKey);
    }

    return children;
}

function renderSlot({
    activeItemKeys,
    itemKey,
    onContainerRender,
}: {
    activeItemKeys?: ReadonlySet<string>;
    itemKey?: string;
    onContainerRender: (props: ContainerComponentProps<unknown>) => void;
}) {
    currentCtx = undefined;

    function MockContainer(props: ContainerComponentProps<unknown>) {
        onContainerRender(props);
        return React.createElement("mock-container", { itemKey: props.itemKey });
    }

    let renderer: TestRenderer.ReactTestRenderer | undefined;
    act(() => {
        renderer = TestRenderer.create(
            <StateProvider>
                <Setup itemKey={itemKey}>
                    <ContainerSlotBase
                        activeItemKeys={activeItemKeys ?? new Set(["item-0", "item-1"])}
                        ContainerComponent={MockContainer}
                        getRenderedItem={() => null}
                        horizontal={false}
                        id={0}
                        recycleItems={false}
                    />
                </Setup>
            </StateProvider>,
        );
    });

    return renderer!;
}

describe("ContainerSlot", () => {
    it("does not mount a Container until an item key is assigned", () => {
        const renderedProps: ContainerComponentProps<unknown>[] = [];
        const renderer = renderSlot({
            onContainerRender: (props) => renderedProps.push(props),
        });

        expect(renderer.toJSON()).toBeNull();
        expect(renderedProps).toHaveLength(0);

        act(() => {
            set$(currentCtx!, "containerItemKey0", "item-0");
        });

        expect(renderedProps).toHaveLength(1);
        expect(renderedProps[0].itemKey).toBe("item-0");
        expect(renderer.toJSON()).toEqual({
            children: null,
            props: {
                itemKey: "item-0",
            },
            type: "mock-container",
        });

        act(() => {
            renderer.unmount();
        });
    });

    it("passes the assigned item key into the mounted Container", () => {
        const renderedProps: ContainerComponentProps<unknown>[] = [];
        const renderer = renderSlot({
            itemKey: "item-1",
            onContainerRender: (props) => renderedProps.push(props),
        });

        expect(renderedProps).toHaveLength(1);
        expect(renderedProps[0]).toMatchObject({
            horizontal: false,
            id: 0,
            itemKey: "item-1",
            recycleItems: false,
        });

        act(() => {
            renderer.unmount();
        });
    });

    it("updates and unmounts the Container when the assigned item key changes", () => {
        const renderedProps: ContainerComponentProps<unknown>[] = [];
        const renderer = renderSlot({
            itemKey: "item-0",
            onContainerRender: (props) => renderedProps.push(props),
        });

        expect(renderer.toJSON()).toMatchObject({
            props: {
                itemKey: "item-0",
            },
        });

        act(() => {
            set$(currentCtx!, "containerItemKey0", "item-1");
        });

        expect(renderedProps.at(-1)?.itemKey).toBe("item-1");
        expect(renderer.toJSON()).toMatchObject({
            props: {
                itemKey: "item-1",
            },
        });

        act(() => {
            set$(currentCtx!, "containerItemKey0", undefined);
        });

        expect(renderer.toJSON()).toBeNull();

        act(() => {
            renderer.unmount();
        });
    });

    it("unmounts a Container whose assigned item key is absent from the latest data", () => {
        const renderedProps: ContainerComponentProps<unknown>[] = [];
        const onContainerRender = (props: ContainerComponentProps<unknown>) => renderedProps.push(props);
        const itemKey = "item-0";

        function MockContainer(props: ContainerComponentProps<unknown>) {
            onContainerRender(props);
            return React.createElement("mock-container", { itemKey: props.itemKey });
        }

        const render = (activeItemKeys: ReadonlySet<string>) => (
            <StateProvider>
                <Setup itemKey={itemKey}>
                    <ContainerSlotBase
                        activeItemKeys={activeItemKeys}
                        ContainerComponent={MockContainer}
                        getRenderedItem={() => null}
                        horizontal={false}
                        id={0}
                        recycleItems={false}
                    />
                </Setup>
            </StateProvider>
        );

        let renderer: TestRenderer.ReactTestRenderer | undefined;
        act(() => {
            renderer = TestRenderer.create(render(new Set([itemKey])));
        });

        expect(renderer!.toJSON()).toMatchObject({
            props: { itemKey },
        });

        act(() => {
            renderer!.update(render(new Set()));
        });

        expect(renderer!.toJSON()).toBeNull();
        expect(renderedProps).toHaveLength(1);

        act(() => {
            renderer!.unmount();
        });
    });
});
