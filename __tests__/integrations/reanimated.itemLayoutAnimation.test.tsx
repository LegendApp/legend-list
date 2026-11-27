import { beforeEach, describe, expect, it, mock } from "bun:test";
import "../setup";

import * as React from "react";
import { View } from "react-native";

import { getStickyPushLimit } from "../../src/components/stickyPositionUtils";
import { POSITION_OUT_OF_VIEW } from "../../src/constants";
import { IsNewArchitecture } from "../../src/constants-platform";
import { useCombinedRef } from "../../src/hooks/useCombinedRef";
import { useLatestRef } from "../../src/hooks/useLatestRef";
import { useStableRenderComponent } from "../../src/hooks/useStableRenderComponent";
import { peek$, StateProvider, set$, useArr$, useStateContext } from "../../src/state/state";
import { typedMemo } from "../../src/types.internal";
import { getComponent } from "../../src/utils/getComponent";
import { createMockState } from "../__mocks__/createMockState";
import { registerReanimatedModuleMock } from "../__mocks__/reanimated";
import TestRenderer, { act } from "../helpers/testRenderer";

let legendListPropsRenders: any[] = [];
let reanimatedViewRenders: any[] = [];
let reanimatedScrollViewRenders: any[] = [];

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

const LegendListMock = React.forwardRef(function LegendListStub(props: any, _ref: React.Ref<any>) {
    legendListPropsRenders.push(props);
    return props.renderItem?.();
});

const ReanimatedViewMock = React.forwardRef(function ReanimatedViewStub(props: any, _ref: React.Ref<any>) {
    reanimatedViewRenders.push(props);
    return props.children;
});

const ReanimatedScrollViewMock = React.forwardRef(function ReanimatedScrollViewStub(_props: any, _ref: React.Ref<any>) {
    reanimatedScrollViewRenders.push(_props);
    return null;
});

const createAnimatedComponentMock = <T extends React.ComponentType<any>>(Component: T): T => Component;
const createReanimatedOverrides = () => {
    const shared = {
        createAnimatedComponent: createAnimatedComponentMock,
        ScrollView: ReanimatedScrollViewMock,
        useAnimatedRef: () => ({ current: null }),
        useAnimatedStyle: (updater: () => unknown) => updater(),
        useScrollViewOffset: () => {},
        useSharedValue: <T,>(value: T) => React.useRef({ value }).current,
        View: ReanimatedViewMock,
    };

    return shared;
};

function registerLegendListModuleMock(isNewArchitecture = IsNewArchitecture) {
    mock.module("@legendapp/list/react-native", () => ({
        internal: {
            getComponent,
            getStickyPushLimit,
            IsNewArchitecture: isNewArchitecture,
            POSITION_OUT_OF_VIEW,
            peek$,
            typedMemo,
            useArr$,
            useCombinedRef,
            useLatestRef,
            useStableRenderComponent,
            useStateContext,
        },
        LegendList: LegendListMock,
    }));
}

registerLegendListModuleMock();

beforeEach(() => registerReanimatedModuleMock(createReanimatedOverrides()));

const PositionComponentHarness = React.memo(function RenderPositionComponent({
    children,
    containerId,
    itemKey,
    layoutReady,
    position,
    PositionComponent,
}: {
    children?: React.ReactNode;
    containerId: number;
    itemKey: string;
    layoutReady?: boolean;
    position: number;
    PositionComponent: React.ComponentType<any>;
}) {
    const ctx = useStateContext();
    const refView = React.useRef<any>(null);
    if (!ctx.state) ctx.state = createMockState() as any;

    React.useLayoutEffect(() => {
        set$(ctx, `containerItemKey${containerId}` as any, itemKey as any);
        set$(ctx, `containerItemIndex${containerId}` as any, 0 as any);
        set$(ctx, `containerPosition${containerId}` as any, position as any);
        if (layoutReady !== undefined) {
            set$(ctx, `containerLayoutReady${containerId}` as any, layoutReady as any);
        }
    }, [containerId, ctx, itemKey, layoutReady, position]);

    return (
        <PositionComponent horizontal={false} id={containerId} onLayout={() => {}} refView={refView} style={{}}>
            {children}
        </PositionComponent>
    );
});

type AnimatedList = typeof import("../../src/integrations/reanimated").AnimatedLegendList;
const positionTestData = [{ id: "a" }];

function renderPositionList(
    List: AnimatedList,
    {
        itemLayoutAnimation,
        recycleItems,
        ...positionProps
    }: Omit<React.ComponentProps<typeof PositionComponentHarness>, "PositionComponent"> &
        Pick<React.ComponentProps<AnimatedList>, "itemLayoutAnimation" | "recycleItems">,
) {
    return (
        <List
            data={positionTestData}
            estimatedItemSize={10}
            itemLayoutAnimation={itemLayoutAnimation}
            recycleItems={recycleItems}
            renderItem={() => (
                <StateProvider>
                    <PositionComponentHarness
                        {...positionProps}
                        PositionComponent={legendListPropsRenders.at(-1).positionComponentInternal ?? View}
                    />
                </StateProvider>
            )}
        />
    );
}

function StickyPositionComponentHarness({
    containerId,
    index,
    itemKey,
    position,
    PositionComponent,
}: {
    containerId: number;
    index: number;
    itemKey: string;
    position: number;
    PositionComponent: React.ComponentType<any>;
}) {
    const ctx = useStateContext();
    const refView = React.useRef<any>(null);

    if (!ctx.state) {
        ctx.state = createMockState({
            positions: [],
            props: {
                stickyHeaderIndicesArr: [index],
            },
        }) as any;
    }

    React.useLayoutEffect(() => {
        ctx.state.positions[index] = position;
        ctx.state.props.stickyHeaderIndicesArr = [index];
        ctx.state.sizes.set(itemKey, 120);

        set$(ctx, `containerItemKey${containerId}` as any, itemKey as any);
        set$(ctx, `containerItemIndex${containerId}` as any, index as any);
        set$(ctx, `containerPosition${containerId}` as any, position as any);
        set$(ctx, "headerSize" as any, 0 as any);
        set$(ctx, "stylePaddingTop" as any, 0 as any);
        set$(ctx, "totalSize" as any, (position + 120) as any);
    }, [containerId, ctx, index, itemKey, position]);

    return (
        <PositionComponent horizontal={false} id={containerId} onLayout={() => {}} refView={refView} style={{}}>
            {null}
        </PositionComponent>
    );
}

describe("AnimatedLegendList itemLayoutAnimation integration", () => {
    beforeEach(() => {
        legendListPropsRenders = [];
        reanimatedViewRenders = [];
        reanimatedScrollViewRenders = [];
        registerLegendListModuleMock();
    });

    it("forwards a custom position component when itemLayoutAnimation is set", async () => {
        const { AnimatedLegendList } = await import("../../src/integrations/reanimated?item-layout-enabled");
        const transition = { type: "linear" } as any;

        act(() => {
            TestRenderer.create(
                <AnimatedLegendList
                    data={[{ id: "a" }]}
                    estimatedItemSize={10}
                    itemLayoutAnimation={transition}
                    renderItem={() => null}
                />,
            );
        });

        const props = legendListPropsRenders.at(-1);
        expect(props.positionComponentInternal).toBeDefined();
        expect(typeof props.renderScrollComponent).toBe("function");
        expect(typeof props.stickyPositionComponentInternal).toBe("function");
    });

    it("adds no reanimated position view to rows of a list without itemLayoutAnimation", async () => {
        const { AnimatedLegendList } = await import("../../src/integrations/reanimated?item-layout-absent");

        act(() => {
            TestRenderer.create(renderPositionList(AnimatedLegendList, { containerId: 0, itemKey: "a", position: 10 }));
        });

        expect(legendListPropsRenders.at(-1).positionComponentInternal).toBeUndefined();
        expect(reanimatedViewRenders).toHaveLength(0);
    });

    it("toggles item layout animation after mount without remounting an existing row", async () => {
        const { AnimatedLegendList } = await import("../../src/integrations/reanimated?item-layout-toggle");
        const transition = { type: "linear" } as any;
        const mounts = mock();
        const unmounts = mock();
        let ctx!: ReturnType<typeof useStateContext>;
        const Row = () => {
            ctx = useStateContext();
            React.useEffect(() => {
                mounts();
                return () => {
                    unmounts();
                };
            }, []);
            return null;
        };
        const row = <Row />;
        const renderList = (itemLayoutAnimation?: typeof transition) =>
            renderPositionList(AnimatedLegendList, {
                children: row,
                containerId: 0,
                itemKey: "a",
                itemLayoutAnimation,
                position: 10,
            });
        let renderer!: TestRenderer.ReactTestRenderer;

        act(() => {
            renderer = TestRenderer.create(renderList(transition));
        });
        expect(mounts).toHaveBeenCalledTimes(1);
        expect(reanimatedViewRenders.at(-1)?.layout).toBe(transition);
        expect(legendListPropsRenders.at(-1).hasItemLayoutAnimationInternal).toBe(true);
        const otherTransition = { ...transition };
        act(() => {
            renderer.update(renderList(otherTransition));
        });
        expect(reanimatedViewRenders.at(-1)?.layout).toBe(otherTransition);

        act(() => {
            renderer.update(renderList());
        });
        expect(reanimatedViewRenders.at(-1)?.layout).toBeUndefined();
        expect(legendListPropsRenders.at(-1).hasItemLayoutAnimationInternal).toBe(false);
        const inactiveRenders = reanimatedViewRenders.length;
        act(() => set$(ctx, "isScrollActive", true));
        expect(reanimatedViewRenders).toHaveLength(inactiveRenders);
        act(() => {
            set$(ctx, "isScrollActive", false);
            set$(ctx, "containerPosition0", 20);
        });
        expect(reanimatedViewRenders.at(-1)?.layout).toBeUndefined();

        act(() => {
            renderer.update(renderList(transition));
        });
        expect(reanimatedViewRenders.at(-1)?.layout).toBe(transition);
        expect(mounts).toHaveBeenCalledTimes(1);
        expect(unmounts).not.toHaveBeenCalled();
        act(() => renderer.unmount());
    });

    it("keeps the custom scroll subtree mounted when the render callback identity changes", async () => {
        const { AnimatedLegendList } = await import("../../src/integrations/reanimated?scroll-component-stability");
        const events: string[] = [];
        const ScrollHarness = ({ children, label }: { children?: React.ReactNode; label: string }) => {
            React.useEffect(() => {
                events.push(`mount:${label}`);
                return () => {
                    events.push(`unmount:${label}`);
                };
            }, []);

            return React.createElement("custom-scroll-view", null, label, children);
        };
        const renderList = (label: string) => (
            <AnimatedLegendList
                data={[{ id: "a" }]}
                estimatedItemSize={10}
                renderItem={() => null}
                renderScrollComponent={(props) => <ScrollHarness {...props} label={label} />}
            />
        );
        let listRenderer!: TestRenderer.ReactTestRenderer;
        let bridgeRenderer!: TestRenderer.ReactTestRenderer;

        act(() => {
            listRenderer = TestRenderer.create(renderList("first"));
        });
        act(() => {
            bridgeRenderer = TestRenderer.create(legendListPropsRenders.at(-1).renderScrollComponent({ ref: null }));
        });

        expect(collectTextFromTree(bridgeRenderer.toJSON())).toContain("first");
        expect(events).toEqual(["mount:first"]);

        act(() => {
            listRenderer.update(renderList("second"));
        });
        act(() => {
            bridgeRenderer.update(legendListPropsRenders.at(-1).renderScrollComponent({ ref: null }));
        });

        expect(collectTextFromTree(bridgeRenderer.toJSON())).toContain("second");
        expect(events).toEqual(["mount:first"]);

        act(() => {
            bridgeRenderer.unmount();
            listRenderer.unmount();
        });
    });

    it.each([{ recycleItems: true }, { recycleItems: false }])(
        "skips one transition on reassignment (recycleItems=$recycleItems)",
        async ({ recycleItems }) => {
            const { AnimatedLegendList } = await import("../../src/integrations/reanimated?item-layout-reassign");
            const transition = { duration: 280, type: "linear" } as any;
            const renderList = (itemKey: string, position: number) =>
                renderPositionList(AnimatedLegendList, {
                    containerId: 7,
                    itemKey,
                    itemLayoutAnimation: transition,
                    position,
                    recycleItems,
                });
            let renderer!: TestRenderer.ReactTestRenderer;

            act(() => {
                renderer = TestRenderer.create(renderList("a", 10));
            });
            expect(reanimatedViewRenders.at(-1)?.layout).toBe(transition);

            act(() => {
                renderer.update(renderList("b", 600));
            });
            expect(reanimatedViewRenders.at(-1)?.layout).toBeUndefined();

            act(() => {
                renderer.update(renderList("b", 620));
            });
            expect(reanimatedViewRenders.at(-1)?.layout).toBe(transition);
        },
    );

    it("skips layout transitions while scrolling and for one render after a scroll adjustment", async () => {
        const { AnimatedLegendList } = await import("../../src/integrations/reanimated?item-layout-scroll-active");
        const transition = { duration: 280, type: "linear" } as any;

        let context!: ReturnType<typeof useStateContext>;
        const CaptureContext = () => {
            context = useStateContext();
            return null;
        };

        act(() => {
            TestRenderer.create(
                renderPositionList(AnimatedLegendList, {
                    children: <CaptureContext />,
                    containerId: 9,
                    itemKey: "a",
                    itemLayoutAnimation: transition,
                    position: 10,
                }),
            );
        });
        expect(reanimatedViewRenders.at(-1)?.layout).toBe(transition);

        act(() => {
            set$(context, "isScrollActive", true);
        });
        expect(reanimatedViewRenders.at(-1)?.layout).toBeUndefined();
        act(() => {
            set$(context, "isScrollActive", false);
        });
        expect(reanimatedViewRenders.at(-1)?.layout).toBe(transition);

        context.state.layoutAdjustmentEpoch = (context.state.layoutAdjustmentEpoch ?? 0) + 1;
        act(() => {
            set$(context, "containerPosition9", 20);
        });
        expect(reanimatedViewRenders.at(-1)?.layout).toBeUndefined();
        act(() => {
            set$(context, "containerPosition9", 30);
        });
        expect(reanimatedViewRenders.at(-1)?.layout).toBe(transition);

        context.state.scrollingTo = { animated: true, offset: 100 } as any;
        act(() => {
            set$(context, "containerPosition9", 40);
        });
        expect(reanimatedViewRenders.at(-1)?.layout).toBeUndefined();
        context.state.scrollingTo = undefined;
        act(() => {
            set$(context, "containerPosition9", 50);
        });
        expect(reanimatedViewRenders.at(-1)?.layout).toBe(transition);
    });

    it("uses the reanimated scroll bridge on old architecture so animated contentContainerStyle reaches Reanimated.ScrollView", async () => {
        registerLegendListModuleMock(false);

        const { AnimatedLegendList } = await import(
            "../../src/integrations/reanimated?animated-content-container-old-arch"
        );
        const contentContainerStyle = { opacity: 0.5 } as any;

        act(() => {
            TestRenderer.create(
                <AnimatedLegendList
                    contentContainerStyle={contentContainerStyle}
                    data={[{ id: "a" }]}
                    estimatedItemSize={10}
                    renderItem={() => null}
                />,
            );
        });

        const props = legendListPropsRenders.at(-1);
        expect(typeof props.renderScrollComponent).toBe("function");

        act(() => {
            TestRenderer.create(
                props.renderScrollComponent({
                    children: null,
                    contentContainerStyle,
                    horizontal: false,
                    onLayout: () => {},
                    onScroll: () => {},
                    ref: { current: null },
                    style: {},
                }),
            );
        });

        expect(reanimatedScrollViewRenders.at(-1)?.contentContainerStyle).toBe(contentContainerStyle);
    });

    it("keeps an unmeasured row laid out but invisible until its layout is ready", async () => {
        const transition = { __transition: true } as any;
        const { AnimatedLegendList } = await import("../../src/integrations/reanimated?position-layout-ready");

        const flattenLastStyle = () => {
            const style = reanimatedViewRenders.at(-1)?.style;
            return Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : style;
        };
        const renderHarness = (layoutReady: boolean) =>
            renderPositionList(AnimatedLegendList, {
                containerId: 5,
                itemKey: "a",
                itemLayoutAnimation: transition,
                layoutReady,
                position: 40,
                recycleItems: true,
            });
        let renderer!: TestRenderer.ReactTestRenderer;

        act(() => {
            renderer = TestRenderer.create(renderHarness(false));
        });

        // Still positioned, so it measures where it will actually land.
        expect(flattenLastStyle()).toMatchObject({ opacity: 0, top: 40 });
        expect(reanimatedViewRenders.at(-1)?.pointerEvents).toBe("none");

        act(() => {
            renderer.update(renderHarness(true));
        });

        expect(flattenLastStyle()?.opacity).toBeUndefined();
        expect(flattenLastStyle()?.top).toBe(40);
        expect(reanimatedViewRenders.at(-1)?.pointerEvents).toBeUndefined();
    });

    it("uses transform-based sticky styles for the reanimated sticky bridge", async () => {
        const { AnimatedLegendList } = await import("../../src/integrations/reanimated?sticky-position-style");

        act(() => {
            TestRenderer.create(
                <AnimatedLegendList data={[{ id: "a" }]} estimatedItemSize={10} renderItem={() => null} />,
            );
        });

        const props = legendListPropsRenders.at(-1);
        const StickyPositionComponent = props.stickyPositionComponentInternal as React.ComponentType<any>;

        act(() => {
            TestRenderer.create(
                <StateProvider>
                    <StickyPositionComponentHarness
                        containerId={9}
                        index={1}
                        itemKey="header-1"
                        PositionComponent={StickyPositionComponent}
                        position={100}
                    />
                </StateProvider>,
            );
        });

        const style = reanimatedViewRenders.at(-1)?.style;
        const flattenedStyle = Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : style;
        expect(flattenedStyle?.transform).toEqual([{ translateY: 100 }]);
    });
});
