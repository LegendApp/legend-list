import * as React from "react";

import { beforeEach, describe, expect, it, mock } from "bun:test";
import "../setup";

import { scheduleContainerLayout } from "@/core/scheduleContainerLayout";
import { type StateContext, StateProvider, useStateContext } from "@/state/state";
import { createMockState } from "../__mocks__/createMockState";
import { act, render } from "../helpers/testingLibrary";

const measureCalls: number[] = [];
let observeMeasurement: (() => void) | undefined;

function registerContainerMock() {
    mock.module("@/components/Container", () => ({
        Container: () => null,
    }));
}

function registerMeasureContainersMock() {
    mock.module("@/core/measureContainersInLayoutEffect", () => ({
        measureContainersInLayoutEffect: () => {
            observeMeasurement?.();
            measureCalls.push(measureCalls.length + 1);
        },
    }));
}

type SetupProps = {
    columnWrapperStyle: Record<string, any>;
    numColumns: number;
    onContext?: (ctx: StateContext) => void;
    otherAxisSize?: number;
    readyToRender?: boolean;
    children: React.ReactNode;
};

const Setup = ({
    columnWrapperStyle,
    numColumns,
    onContext,
    otherAxisSize = 0,
    readyToRender = true,
    children,
}: SetupProps) => {
    const ctx = useStateContext();
    onContext?.(ctx);
    ctx.columnWrapperStyle = columnWrapperStyle;
    ctx.values.set("numColumns", numColumns);
    ctx.values.set("numContainersPooled", 1);
    ctx.values.set("otherAxisSize", otherAxisSize);
    ctx.values.set("readyToRender", readyToRender);
    ctx.values.set("totalSize", 0);
    return <>{children}</>;
};

describe("Containers native", () => {
    beforeEach(() => {
        measureCalls.length = 0;
        observeMeasurement = undefined;
        registerContainerMock();
        registerMeasureContainersMock();
    });

    it("runs coordinated measurement after child layout effects", async () => {
        const { ContainerLayoutCoordinator } = await import("@/components/ContainerLayoutCoordinator");
        let didRunChildLayoutEffect = false;
        let didObserveCommittedChild = false;

        observeMeasurement = () => {
            didObserveCommittedChild = didRunChildLayoutEffect;
        };

        function Child() {
            const ctx = useStateContext();
            ctx.state ??= createMockState();

            React.useLayoutEffect(() => {
                didRunChildLayoutEffect = true;
                scheduleContainerLayout(ctx, 0);
            }, [ctx]);
            return null;
        }

        const { unmount } = render(
            <StateProvider>
                <ContainerLayoutCoordinator>
                    <Child />
                </ContainerLayoutCoordinator>
            </StateProvider>,
        );

        expect(didObserveCommittedChild).toBe(true);
        expect(measureCalls).toHaveLength(1);
        unmount();
    });

    it("applies row gap for single column without horizontal margin", async () => {
        const { Containers } = await import("@/components/Containers");

        const { toJSON, unmount } = render(
            <StateProvider>
                <Setup columnWrapperStyle={{ gap: 20 }} numColumns={1}>
                    <Containers
                        freshDataTransitionEpoch={0}
                        getRenderedItem={() => null}
                        horizontal={false}
                        recycleItems={false}
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
                        freshDataTransitionEpoch={0}
                        getRenderedItem={() => null}
                        horizontal={false}
                        recycleItems={false}
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
                        freshDataTransitionEpoch={0}
                        getRenderedItem={() => null}
                        horizontal
                        recycleItems={false}
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
                        freshDataTransitionEpoch={0}
                        getRenderedItem={() => null}
                        horizontal
                        recycleItems={false}
                    />
                </Setup>
            </StateProvider>,
        );

        const style = (toJSON() as any)?.props?.style;
        expect(style?.height).toBe(180);
        expect(style?.minHeight).toBe(180);

        unmount();
    });

    it("runs the parent measurement pass for a scheduled all-container request", async () => {
        const { Containers } = await import("@/components/Containers");
        let ctx: StateContext | undefined;

        const { unmount } = render(
            <StateProvider>
                <Setup
                    columnWrapperStyle={{}}
                    numColumns={1}
                    onContext={(value) => {
                        ctx = value;
                    }}
                >
                    <Containers
                        freshDataTransitionEpoch={0}
                        getRenderedItem={() => null}
                        horizontal={false}
                        recycleItems={false}
                    />
                </Setup>
            </StateProvider>,
        );

        expect(measureCalls).toHaveLength(0);

        act(() => {
            scheduleContainerLayout(ctx!);
        });

        expect(measureCalls).toHaveLength(1);
        unmount();
    });

    it("disables native interaction while the container layer is hidden", async () => {
        const { Containers } = await import("@/components/Containers");

        const { toJSON, unmount } = render(
            <StateProvider>
                <Setup columnWrapperStyle={{}} numColumns={1} readyToRender={false}>
                    <Containers
                        freshDataTransitionEpoch={0}
                        getRenderedItem={() => null}
                        horizontal={false}
                        recycleItems={false}
                    />
                </Setup>
            </StateProvider>,
        );

        const props = (toJSON() as any)?.props;
        expect(props?.style?.opacity).toBe(0);
        expect(props?.pointerEvents).toBe("none");
        unmount();
    });

    it("keeps the native visual layer stable when only the layout epoch changes", async () => {
        const { Containers } = await import("@/components/Containers");
        let ctx: StateContext | undefined;

        const { toJSON, unmount } = render(
            <StateProvider>
                <Setup
                    columnWrapperStyle={{}}
                    numColumns={1}
                    onContext={(value) => {
                        ctx = value;
                    }}
                >
                    <Containers
                        freshDataTransitionEpoch={0}
                        getRenderedItem={() => null}
                        horizontal={false}
                        recycleItems={false}
                    />
                </Setup>
            </StateProvider>,
        );
        const styleBefore = (toJSON() as any)?.props?.style;

        act(() => {
            scheduleContainerLayout(ctx!);
        });

        expect((toJSON() as any)?.props?.style).toBe(styleBefore);
        unmount();
    });
});
