import type * as React from "react";

import { beforeEach, describe, expect, it, mock } from "bun:test";
import "../setup";

import { type StateContext, StateProvider, useStateContext } from "@/state/state";
import { render } from "../helpers/testingLibrary";

// Containers are absolutely positioned, so where a row APPEARS comes from its own offset.
// Child order is what feeds the native view order, and therefore the accessibility order —
// which is why these tests assert on the order of the rendered children rather than on any
// style or position.
function registerContainerSlotMock() {
    mock.module("@/components/ContainerSlot", () => ({
        ContainerSlot: ({ id }: { id: number }) => <mock-container-slot testID={`container-${id}`} />,
    }));
}

type SetupProps = {
    children: React.ReactNode;
    // Which item index each pooled container currently holds; index in this array is the
    // container id. `undefined` is a container holding nothing, as happens off-screen.
    itemIndexByContainer: (number | undefined)[];
    onContext?: (ctx: StateContext) => void;
};

const Setup = ({ children, itemIndexByContainer, onContext }: SetupProps) => {
    const ctx = useStateContext();
    onContext?.(ctx);
    ctx.columnWrapperStyle = undefined;
    ctx.values.set("numColumns", 1);
    ctx.values.set("numContainersPooled", itemIndexByContainer.length);
    ctx.values.set("otherAxisSize", 0);
    ctx.values.set("readyToRender", true);
    ctx.values.set("totalSize", 0);
    itemIndexByContainer.forEach((itemIndex, containerId) => {
        ctx.values.set(`containerItemIndex${containerId}`, itemIndex);
    });
    return <>{children}</>;
};

// Depth-first walk collecting the mocked slots in render order.
function renderedContainerIds(tree: any): number[] {
    const ids: number[] = [];
    const visit = (node: any): void => {
        if (!node || typeof node !== "object") {
            return;
        }
        if (Array.isArray(node)) {
            node.forEach(visit);
            return;
        }
        const testID: string | undefined = node.props?.testID;
        if (testID?.startsWith("container-")) {
            ids.push(Number(testID.slice("container-".length)));
        }
        (node.children ?? []).forEach(visit);
    };
    visit(tree);
    return ids;
}

describe("Containers native render order", () => {
    beforeEach(() => {
        registerContainerSlotMock();
    });

    it("renders pooled containers in the order of the items they hold", async () => {
        const { Containers } = await import("@/components/Containers");

        // A pool that has been recycled: container 0 now holds the LAST item, and the
        // first item is in container 1. This is the steady state after a reorder.
        const { toJSON, unmount } = render(
            <StateProvider>
                <Setup itemIndexByContainer={[2, 0, 1]}>
                    <Containers
                        freshDataTransitionEpoch={0}
                        getRenderedItem={() => null}
                        horizontal={false}
                        recycleItems={false}
                    />
                </Setup>
            </StateProvider>,
        );

        // Item order is 0, 1, 2 -> containers 1, 2, 0. Rendered in pool order (0, 1, 2) a
        // screen reader would read the last item first.
        expect(renderedContainerIds(toJSON())).toEqual([1, 2, 0]);

        unmount();
    });

    it("keeps containers holding no item after the ones that do", async () => {
        const { Containers } = await import("@/components/Containers");

        const { toJSON, unmount } = render(
            <StateProvider>
                <Setup itemIndexByContainer={[undefined, 1, 0]}>
                    <Containers
                        freshDataTransitionEpoch={0}
                        getRenderedItem={() => null}
                        horizontal={false}
                        recycleItems={false}
                    />
                </Setup>
            </StateProvider>,
        );

        expect(renderedContainerIds(toJSON())).toEqual([2, 1, 0]);

        unmount();
    });

    it("leaves an already-ordered pool untouched", async () => {
        const { Containers } = await import("@/components/Containers");

        const { toJSON, unmount } = render(
            <StateProvider>
                <Setup itemIndexByContainer={[0, 1, 2]}>
                    <Containers
                        freshDataTransitionEpoch={0}
                        getRenderedItem={() => null}
                        horizontal={false}
                        recycleItems={false}
                    />
                </Setup>
            </StateProvider>,
        );

        expect(renderedContainerIds(toJSON())).toEqual([0, 1, 2]);

        unmount();
    });
});
