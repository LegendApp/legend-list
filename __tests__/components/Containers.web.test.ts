import * as React from "react";

import { describe, expect, it } from "bun:test";
import "../setup";

import { StateProvider, useStateContext } from "../../src/state/state";
import TestRenderer, { act } from "../helpers/testRenderer";

function StateSetup({
    children,
    columnWrapperStyle,
    horizontal,
}: {
    children: React.ReactNode;
    columnWrapperStyle: { columnGap?: number; rowGap?: number; gap?: number };
    horizontal: boolean;
}) {
    const ctx = useStateContext();
    ctx.columnWrapperStyle = columnWrapperStyle;
    ctx.values.set("numContainersPooled", 0);
    ctx.values.set("numColumns", 2);
    ctx.values.set("otherAxisSize", 100);
    ctx.values.set("totalSize", 500);
    ctx.state = { props: { horizontal } } as any;

    return children;
}

async function renderContainers(horizontal: boolean) {
    const { Containers } = await import("../../src/components/Containers?web-render");
    let renderer: TestRenderer.ReactTestRenderer | undefined;

    act(() => {
        renderer = TestRenderer.create(
            React.createElement(
                StateProvider,
                null,
                React.createElement(
                    StateSetup,
                    {
                        columnWrapperStyle: { columnGap: 12, rowGap: 8 },
                        horizontal,
                    },
                    React.createElement(Containers, {
                        getRenderedItem: () => null,
                        horizontal,
                        recycleItems: true,
                        updateItemSize: () => {},
                    }),
                ),
            ),
        );
    });

    return renderer!;
}

describe("Containers (web)", () => {
    it("applies only bottom negative margin for vertical multi-column row gaps", async () => {
        const renderer = await renderContainers(false);

        const div = renderer.root.findByType("div");
        expect(div.props.style).toEqual({
            height: 500,
            marginBottom: -8,
            minWidth: 100,
            position: "relative",
        });

        act(() => {
            renderer.unmount();
        });
    });

    it("applies horizontal negative margin only on the trailing edge", async () => {
        const renderer = await renderContainers(true);

        const div = renderer.root.findByType("div");
        expect(div.props.style).toEqual({
            marginBottom: -4,
            marginRight: -12,
            marginTop: -4,
            minHeight: 100,
            position: "relative",
            width: 500,
        });

        act(() => {
            renderer.unmount();
        });
    });
});
