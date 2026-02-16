import type React from "react";

import { beforeEach, describe, expect, it, mock } from "bun:test";
import "../setup";

import { StateProvider, useStateContext } from "@/state/state";
import TestRenderer from "../helpers/testRenderer";

mock.module("@/components/Container", () => ({
    Container: () => null,
}));

type SetupProps = {
    columnWrapperStyle: Record<string, any>;
    numColumns: number;
    children: React.ReactNode;
};

const Setup = ({ columnWrapperStyle, numColumns, children }: SetupProps) => {
    const ctx = useStateContext();
    ctx.columnWrapperStyle = columnWrapperStyle;
    ctx.values.set("numColumns", numColumns);
    ctx.values.set("numContainersPooled", 1);
    ctx.values.set("otherAxisSize", 0);
    ctx.values.set("totalSize", 0);
    return <>{children}</>;
};

describe("Containers gap handling", () => {
    beforeEach(() => {});

    it("applies row gap for single column without horizontal margin", async () => {
        const { Containers } = await import("@/components/Containers");

        const renderer = TestRenderer.create(
            <StateProvider>
                <Setup columnWrapperStyle={{ gap: 20 }} numColumns={1}>
                    <Containers
                        getRenderedItem={() => null}
                        horizontal={false}
                        recycleItems={false}
                        updateItemSize={() => {}}
                        waitForInitialLayout={false}
                    />
                </Setup>
            </StateProvider>,
        );

        const [animatedView] = renderer.root.findAll((node) => node.props?.style);
        const style = animatedView?.props?.style;
        expect(style?.marginBottom).toBe(-20);
        expect(style?.marginHorizontal).toBeUndefined();

        renderer.unmount();
    });

    it("applies column gap margin when multiple columns", async () => {
        const { Containers } = await import("@/components/Containers");

        const renderer = TestRenderer.create(
            <StateProvider>
                <Setup columnWrapperStyle={{ gap: 16 }} numColumns={2}>
                    <Containers
                        getRenderedItem={() => null}
                        horizontal={false}
                        recycleItems={false}
                        updateItemSize={() => {}}
                        waitForInitialLayout={false}
                    />
                </Setup>
            </StateProvider>,
        );

        const [animatedView] = renderer.root.findAll((node) => node.props?.style);
        const style = animatedView?.props?.style;
        expect(style?.marginBottom).toBe(-16);
        expect(style?.marginHorizontal).toBe(-16);

        renderer.unmount();
    });
});
