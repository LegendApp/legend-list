import * as React from "react";

import { beforeEach, describe, expect, it, mock } from "bun:test";
import "../setup";

import { scheduleContainerLayout } from "@/core/scheduleContainerLayout";
import { type StateContext, StateProvider, set$, useStateContext } from "@/state/state";
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
    ctx.state ??= createMockState();
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
    it("preserves the old-architecture update path in a fresh process", () => {
        const proc = Bun.spawnSync(["bun", "test", "./__tests__/components/Containers.oldarch.cases.tsx"], {
            cwd: process.cwd(),
            stderr: "pipe",
            stdout: "pipe",
        });
        expect({ exitCode: proc.exitCode, stderr: proc.stderr.toString() }).toEqual({
            exitCode: 0,
            stderr: expect.any(String),
        });
    });

    beforeEach(() => {
        measureCalls.length = 0;
        observeMeasurement = undefined;
        registerContainerMock();
        registerMeasureContainersMock();
    });

    for (const horizontal of [false, true]) {
        it(`commits a shrinking content extent with Fabric row positions (horizontal: ${horizontal})`, async () => {
            const { PositionView } = await import("@/components/PositionView");
            mock.module("@/components/Container", () => ({
                Container: ({ id }: { id: number }) => {
                    const refView = React.useRef<any>(null);
                    return (
                        <PositionView
                            horizontal={horizontal}
                            id={id}
                            onLayout={() => {}}
                            refView={refView}
                            style={horizontal ? { width: 100 } : { height: 100 }}
                        >
                            last row
                        </PositionView>
                    );
                },
            }));
            const { Containers } = await import("@/components/Containers");
            let ctx: StateContext;
            function GeometrySetup({ children }: { children: React.ReactNode }) {
                ctx = useStateContext();
                ctx.state = createMockState();
                ctx.values.set("numColumns", 1);
                ctx.values.set("numContainersPooled", 1);
                ctx.values.set("readyToRender", true);
                ctx.values.set("totalSize", 1000);
                ctx.values.set("containerItemKey0", "last");
                ctx.values.set("containerPosition0", 900);
                return children;
            }
            const { toJSON, unmount } = render(
                <StateProvider>
                    <GeometrySetup>
                        <Containers
                            freshDataTransitionEpoch={0}
                            getRenderedItem={() => null}
                            horizontal={horizontal}
                            recycleItems={false}
                        />
                    </GeometrySetup>
                </StateProvider>,
            );
            const geometry = () => {
                const tree = toJSON() as any;
                const size = tree.props.style[horizontal ? "width" : "height"];
                return {
                    // Animated updates change this value outside a React commit.
                    extent: typeof size === "number" ? size : size.getValue(),
                    rowPosition: tree.children[0].props.style[1][horizontal ? "left" : "top"],
                };
            };
            expect(geometry()).toEqual({ extent: 1000, rowPosition: 900 });
            let beforeCommit: ReturnType<typeof geometry> | undefined;
            act(() => {
                // A row above shrinks by 300px. Both signals change in one batch,
                // but Fabric cannot move the row until the React commit.
                set$(ctx!, "containerPosition0", 600);
                set$(ctx!, "totalSize", 700);
                beforeCommit = geometry();
            });
            expect(beforeCommit).toEqual({ extent: 1000, rowPosition: 900 });
            expect(geometry()).toEqual({ extent: 700, rowPosition: 600 });
            unmount();
        });
    }

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
        expect(props?.style?.opacity).toBeUndefined();
        expect(props?.style?.transform).toEqual([{ translateX: -100000 }]);
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

    for (const horizontal of [false, true]) {
        it(`renders the size component in place of the native layer (horizontal: ${horizontal})`, async () => {
            const { Containers } = await import("@/components/Containers");
            const sizeRenders: any[] = [];
            const SizeComponent = (sizeProps: any) => {
                sizeRenders.push(sizeProps);
                return <>{sizeProps.children}</>;
            };
            let ctx: StateContext | undefined;

            const { unmount } = render(
                <StateProvider>
                    <Setup
                        columnWrapperStyle={{}}
                        numColumns={1}
                        onContext={(value) => {
                            ctx = value;
                            value.state.props.sizeComponentInternal = SizeComponent;
                        }}
                        readyToRender={false}
                    >
                        <Containers
                            freshDataTransitionEpoch={0}
                            getRenderedItem={() => null}
                            horizontal={horizontal}
                            recycleItems={false}
                        />
                    </Setup>
                </StateProvider>,
            );

            const props = sizeRenders.at(-1);
            expect(props.signalName).toBe("totalSize");
            expect(props.horizontal).toBe(horizontal);
            expect(props.pointerEvents).toBe("none");
            expect(props.style).not.toHaveProperty(horizontal ? "width" : "height");
            expect(props.style.opacity).toBeUndefined();
            expect(props.style.transform).toEqual([{ [horizontal ? "translateY" : "translateX"]: -100000 }]);

            // The containers subtree, including its layout coordinator, mounts inside the size component.
            act(() => {
                scheduleContainerLayout(ctx!);
            });
            expect(measureCalls).toHaveLength(1);
            unmount();
        });
    }
});
