import * as React from "react";
import { Text, View } from "react-native";

import { describe, expect, it, mock, spyOn } from "bun:test";
import * as doMaintainScrollAtEndModule from "../../src/core/doMaintainScrollAtEnd";
import { type StateContext, StateProvider, set$, useStateContext } from "../../src/state/state";
import type { MaintainScrollAtEndOptions } from "../../src/types.base";
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

function getContentContainerStyle(renderer: TestRenderer.ReactTestRenderer) {
    const styles = renderer.root.findAllByType(View)[0]?.props.contentContainerStyle;
    return Object.assign({}, ...styles.filter(Boolean));
}

function ListComponentHarness({
    alignItemsAtEndPaddingEnabled,
    contentContainerStyle,
    events,
    label,
    ListComponent,
    ListFooterComponent,
    maintainScrollAtEnd,
    onContext,
    onInternalScrollBeginDrag,
    onLayoutFooter,
    onRenderScrollComponent,
}: {
    alignItemsAtEndPaddingEnabled?: boolean;
    contentContainerStyle?: Record<string, unknown>;
    events: string[];
    label: string;
    ListComponent: React.ComponentType<any>;
    ListFooterComponent?: React.ReactNode;
    maintainScrollAtEnd?: boolean | MaintainScrollAtEndOptions;
    onContext?: (ctx: StateContext) => void;
    onInternalScrollBeginDrag?: (event: unknown) => void;
    onLayoutFooter?: (rect: { height: number; width: number; x: number; y: number }) => void;
    onRenderScrollComponent?: () => void;
}) {
    const ctx = useStateContext();
    const state = React.useMemo(() => createMockState(), []);
    state.props.alignItemsAtEnd = !!alignItemsAtEndPaddingEnabled;
    state.props.alignItemsAtEndPaddingEnabled = !!alignItemsAtEndPaddingEnabled;
    state.props.maintainScrollAtEnd = maintainScrollAtEnd;
    ctx.state = state;
    onContext?.(ctx);

    return (
        <ListComponent
            canRender={false}
            contentContainerStyle={contentContainerStyle}
            drawDistance={0}
            estimatedItemSize={100}
            getRenderedItem={() => null}
            horizontal={false}
            initialContentOffset={undefined}
            ListFooterComponent={ListFooterComponent}
            ListHeaderComponent={<Header events={events} />}
            onInternalScrollBeginDrag={onInternalScrollBeginDrag}
            onLayout={() => {}}
            onLayoutFooter={onLayoutFooter}
            onScroll={() => {}}
            recycleItems={false}
            refScrollView={{ current: null }}
            renderScrollComponent={(scrollProps) => {
                onRenderScrollComponent?.();
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
        />
    );
}

describe("ListComponent renderScrollComponent", () => {
    it("uses border-box sizing for web content containers", async () => {
        const { Platform } = await import("react-native");
        const previousPlatform = Platform.OS;
        const { ListComponent } = await import("../../src/components/ListComponent?custom-scroll-web-end-space");
        const events: string[] = [];
        let renderer!: TestRenderer.ReactTestRenderer;

        try {
            Platform.OS = "web" as any;
            act(() => {
                renderer = TestRenderer.create(
                    <StateProvider>
                        <ListComponentHarness
                            contentContainerStyle={{ boxSizing: "content-box", paddingBottom: 12 }}
                            events={events}
                            ListComponent={ListComponent}
                            label="web"
                        />
                    </StateProvider>,
                );
            });

            expect(getContentContainerStyle(renderer)).toMatchObject({
                boxSizing: "border-box",
                paddingBottom: 12,
            });
        } finally {
            Platform.OS = previousPlatform;
            act(() => {
                renderer?.unmount();
            });
        }
    });

    it("forwards the internal drag boundary to native scroll components", async () => {
        const { Platform } = await import("../../src/platform/Platform");
        const { ListComponent } = await import("../../src/components/ListComponent?native-edge-drag-boundary");
        const events: string[] = [];
        let receivedScrollProps: Record<string, unknown> | undefined;
        let renderer!: TestRenderer.ReactTestRenderer;
        const originalPlatform = Platform.OS;

        try {
            Platform.OS = "ios";
            act(() => {
                renderer = TestRenderer.create(
                    <StateProvider>
                        <ListComponentHarness
                            events={events}
                            ListComponent={ListComponent}
                            label="native"
                            onInternalScrollBeginDrag={() => events.push("drag")}
                            onRenderScrollComponent={() => {}}
                        />
                    </StateProvider>,
                );
            });

            const renderedView = renderer.root.findAllByType(View)[0];
            receivedScrollProps = renderedView?.props;
            act(() => {
                (receivedScrollProps?.onScrollBeginDrag as ((event: unknown) => void) | undefined)?.({
                    nativeEvent: {},
                });
            });

            expect(typeof receivedScrollProps?.onScrollBeginDrag).toBe("function");
            expect(events).toContain("drag");
        } finally {
            Platform.OS = originalPlatform;
            act(() => {
                renderer?.unmount();
            });
        }
    });

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

    it("does not rerender the custom scroll wrapper when alignItemsAtEnd padding changes", async () => {
        const { ListComponent } = await import("../../src/components/ListComponent?align-items-at-end-spacer");
        const events: string[] = [];
        let renderScrollComponentCount = 0;
        let ctx!: StateContext;
        let renderer!: TestRenderer.ReactTestRenderer;

        act(() => {
            renderer = TestRenderer.create(
                <StateProvider>
                    <ListComponentHarness
                        alignItemsAtEndPaddingEnabled
                        events={events}
                        ListComponent={ListComponent}
                        label="first"
                        onContext={(nextCtx) => {
                            ctx = nextCtx;
                        }}
                        onRenderScrollComponent={() => {
                            renderScrollComponentCount++;
                        }}
                    />
                </StateProvider>,
            );
        });

        expect(renderScrollComponentCount).toBe(1);

        act(() => {
            set$(ctx, "alignItemsAtEndPadding", 200);
        });

        expect(renderScrollComponentCount).toBe(1);
        expect(collectTextFromTree(renderer.toJSON())).toContain("first");

        act(() => {
            renderer.unmount();
        });
    });

    it("updates footer metrics before bootstrap footer layout and maintains scroll after it", async () => {
        const layoutViews: Array<{
            children: React.ReactNode;
            onLayoutChange: (
                rect: { height: number; width: number; x: number; y: number },
                fromLayoutEffect: boolean,
            ) => void;
        }> = [];
        mock.module("@/platform/LayoutView", () => ({
            LayoutView: (props: (typeof layoutViews)[number]) => {
                layoutViews.push(props);
                return <View>{props.children}</View>;
            },
        }));

        const { ListComponent } = await import("../../src/components/ListComponent?footer-layout-order");
        const events: string[] = [];
        let ctx!: StateContext;
        let renderer!: TestRenderer.ReactTestRenderer;
        const doMaintainScrollAtEndSpy = spyOn(doMaintainScrollAtEndModule, "doMaintainScrollAtEnd").mockImplementation(
            () => {
                events.push("maintain");
                return true;
            },
        );

        try {
            act(() => {
                renderer = TestRenderer.create(
                    <StateProvider>
                        <ListComponentHarness
                            events={events}
                            ListComponent={ListComponent}
                            ListFooterComponent={<Text>Footer</Text>}
                            label="first"
                            maintainScrollAtEnd
                            onContext={(nextCtx) => {
                                ctx = nextCtx;
                            }}
                            onLayoutFooter={() => {
                                events.push(`bootstrap:${ctx.values.get("footerSize")}`);
                            }}
                        />
                    </StateProvider>,
                );
            });

            const footerLayout = layoutViews.at(-1);
            expect(footerLayout).toBeDefined();

            act(() => {
                footerLayout?.onLayoutChange({ height: 40, width: 320, x: 0, y: 0 }, false);
            });

            expect(events).toEqual(["mount:header", "bootstrap:40", "maintain"]);
            expect(doMaintainScrollAtEndSpy).toHaveBeenCalledWith(ctx);
        } finally {
            doMaintainScrollAtEndSpy.mockRestore();
            act(() => {
                renderer?.unmount();
            });
        }
    });
});
