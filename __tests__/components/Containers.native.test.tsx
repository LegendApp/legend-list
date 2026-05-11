import type React from "react";

import { beforeEach, describe, expect, it, mock } from "bun:test";
import "../setup";

import { StateProvider, useStateContext } from "@/state/state";
import { render } from "../helpers/testingLibrary";

function registerContainerMock() {
    mock.module("@/components/Container", () => ({
        Container: () => null,
    }));
}

type SetupProps = {
    columnWrapperStyle: Record<string, any>;
    numColumns: number;
    otherAxisSize?: number;
    children: React.ReactNode;
};

const Setup = ({ columnWrapperStyle, numColumns, otherAxisSize = 0, children }: SetupProps) => {
    const ctx = useStateContext();
    ctx.columnWrapperStyle = columnWrapperStyle;
    ctx.values.set("numColumns", numColumns);
    ctx.values.set("numContainersPooled", 1);
    ctx.values.set("otherAxisSize", otherAxisSize);
    ctx.values.set("totalSize", 0);
    return <>{children}</>;
};

describe("Containers gap handling", () => {
    beforeEach(() => {
        registerContainerMock();
    });

    it("applies row gap for single column without horizontal margin", async () => {
        const { Containers } = await import("@/components/Containers");

        const { toJSON, unmount } = render(
            <StateProvider>
                <Setup columnWrapperStyle={{ gap: 20 }} numColumns={1}>
                    <Containers
                        getRenderedItem={() => null}
                        horizontal={false}
                        recycleItems={false}
                        updateItemSize={() => {}}
                    />
                </Setup>
            </StateProvider>,
        );

        const style = (toJSON() as any)?.props?.style;
        expect(style?.marginBottom).toBe(-20);
        expect(style?.marginHorizontal).toBeUndefined();

        unmount();
    });

    it("applies column gap margin when multiple columns", async () => {
        const { Containers } = await import("@/components/Containers");

        const { toJSON, unmount } = render(
            <StateProvider>
                <Setup columnWrapperStyle={{ gap: 16 }} numColumns={2}>
                    <Containers
                        getRenderedItem={() => null}
                        horizontal={false}
                        recycleItems={false}
                        updateItemSize={() => {}}
                    />
                </Setup>
            </StateProvider>,
        );

        const style = (toJSON() as any)?.props?.style;
        expect(style?.marginBottom).toBe(-16);
        expect(style?.marginHorizontal).toBe(-16);

        unmount();
    });

    it("keeps horizontal native content at full height before item measurement", async () => {
        const { Containers } = await import("@/components/Containers");

        const { toJSON, unmount } = render(
            <StateProvider>
                <Setup columnWrapperStyle={{}} numColumns={1}>
                    <Containers
                        getRenderedItem={() => null}
                        horizontal
                        recycleItems={false}
                        updateItemSize={() => {}}
                    />
                </Setup>
            </StateProvider>,
        );

        const style = (toJSON() as any)?.props?.style;
        expect(style?.height).toBe("100%");
        expect(style?.minHeight).toBe(0);

        unmount();
    });

    it("uses measured cross-axis size for horizontal native content", async () => {
        const { Containers } = await import("@/components/Containers");

        const { toJSON, unmount } = render(
            <StateProvider>
                <Setup columnWrapperStyle={{}} numColumns={1} otherAxisSize={180}>
                    <Containers
                        getRenderedItem={() => null}
                        horizontal
                        recycleItems={false}
                        updateItemSize={() => {}}
                    />
                </Setup>
            </StateProvider>,
        );

        const style = (toJSON() as any)?.props?.style;
        expect(style?.height).toBe(180);
        expect(style?.minHeight).toBe(180);

        unmount();
    });
});
