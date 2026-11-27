import * as React from "react";

import { describe, expect, it } from "bun:test";
import "../setup";

import { StateProvider, useStateContext } from "../../src/state/state";
import TestRenderer, { act } from "../helpers/testRenderer";

function StateSetup({
    children,
    columnWrapperStyle,
    horizontal,
    numColumns,
    readyToRender,
}: {
    children: React.ReactNode;
    columnWrapperStyle: { columnGap?: number; rowGap?: number; gap?: number };
    horizontal: boolean;
    numColumns: number;
    readyToRender: boolean;
}) {
    const ctx = useStateContext();
    ctx.columnWrapperStyle = columnWrapperStyle;
    ctx.values.set("numContainersPooled", 0);
    ctx.values.set("numColumns", numColumns);
    ctx.values.set("otherAxisSize", 100);
    ctx.values.set("readyToRender", readyToRender);
    ctx.values.set("totalSize", 500);
    ctx.state = { props: { horizontal } } as any;

    return children;
}

async function renderContainers(horizontal: boolean, readyToRender = true, numColumns = 2) {
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
                        numColumns,
                        readyToRender,
                    },
                    React.createElement(Containers, {
                        freshDataTransitionEpoch: 0,
                        getRenderedItem: () => null,
                        horizontal,
                        recycleItems: true,
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
            opacity: 1,
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
            flexShrink: 0,
            marginBottom: -4,
            marginRight: -12,
            marginTop: -4,
            minHeight: 100,
            opacity: 1,
            position: "relative",
            width: 500,
        });

        act(() => {
            renderer.unmount();
        });
    });

    it("cancels the gap after the last row of a vertical single-column list, as on native", async () => {
        const renderer = await renderContainers(false, true, 1);

        const div = renderer.root.findByType("div");
        expect(div.props.style).toEqual({
            height: 500,
            marginBottom: -8,
            minWidth: 100,
            opacity: 1,
            position: "relative",
        });

        act(() => {
            renderer.unmount();
        });
    });

    it("cancels only the trailing gap of a horizontal single-column list, as on native", async () => {
        const renderer = await renderContainers(true, true, 1);

        const div = renderer.root.findByType("div");
        expect(div.props.style).toEqual({
            flexShrink: 0,
            marginRight: -12,
            minHeight: 100,
            opacity: 1,
            position: "relative",
            width: 500,
        });

        act(() => {
            renderer.unmount();
        });
    });

    it("hides content until the initial render state is ready", async () => {
        const renderer = await renderContainers(false, false);

        const div = renderer.root.findByType("div");
        expect(div.props.style).toEqual({
            height: 500,
            marginBottom: -8,
            minWidth: 100,
            opacity: 0,
            pointerEvents: "none",
            position: "relative",
        });

        act(() => {
            renderer.unmount();
        });
    });
});
