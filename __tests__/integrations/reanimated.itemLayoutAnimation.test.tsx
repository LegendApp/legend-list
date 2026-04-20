import { beforeEach, describe, expect, it, mock } from "bun:test";
import "../setup";

import * as React from "react";

import { getStickyPushLimit } from "../../src/components/stickyPositionUtils";
import { POSITION_OUT_OF_VIEW } from "../../src/constants";
import { IsNewArchitecture } from "../../src/constants-platform";
import { useCombinedRef } from "../../src/hooks/useCombinedRef";
import { peek$, StateProvider, set$, useArr$, useStateContext } from "../../src/state/state";
import { typedMemo } from "../../src/types.internal";
import { getComponent } from "../../src/utils/getComponent";
import TestRenderer, { act } from "../helpers/testRenderer";

let legendListPropsRenders: any[] = [];
let reanimatedViewRenders: any[] = [];
let reanimatedScrollViewRenders: any[] = [];

const LegendListMock = React.forwardRef(function LegendListStub(props: any, _ref: React.Ref<any>) {
    legendListPropsRenders.push(props);
    return null;
});

const ReanimatedViewMock = React.forwardRef(function ReanimatedViewStub(props: any, _ref: React.Ref<any>) {
    reanimatedViewRenders.push(props);
    return null;
});

const ReanimatedScrollViewMock = React.forwardRef(function ReanimatedScrollViewStub(_props: any, _ref: React.Ref<any>) {
    reanimatedScrollViewRenders.push(_props);
    return null;
});

const createAnimatedComponentMock = <T extends React.ComponentType<any>>(Component: T): T => Component;
const createReanimatedModuleMock = () => {
    const shared = {
        createAnimatedComponent: createAnimatedComponentMock,
        ScrollView: ReanimatedScrollViewMock,
        useAnimatedRef: () => ({ current: null }),
        useAnimatedStyle: (updater: () => unknown) => updater(),
        useScrollViewOffset: () => {},
        useSharedValue: <T,>(value: T) => ({ value }),
        View: ReanimatedViewMock,
    };

    return {
        __esModule: true,
        ...shared,
        default: shared,
    };
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
            useStateContext,
        },
        LegendList: LegendListMock,
    }));
}

registerLegendListModuleMock();

mock.module("react-native-reanimated", createReanimatedModuleMock);
mock.module("react-native-reanimated/lib/module/index.js", createReanimatedModuleMock);

function PositionComponentHarness({
    containerId,
    itemKey,
    position,
    PositionComponent,
}: {
    containerId: number;
    itemKey: string;
    position: number;
    PositionComponent: React.ComponentType<any>;
}) {
    const ctx = useStateContext();
    const refView = React.useRef<any>(null);

    React.useLayoutEffect(() => {
        set$(ctx, `containerItemKey${containerId}` as any, itemKey as any);
        set$(ctx, `containerPosition${containerId}` as any, position as any);
    }, [containerId, ctx, itemKey, position]);

    return (
        <PositionComponent
            horizontal={false}
            id={containerId}
            index={0}
            onLayout={() => {}}
            refView={refView}
            style={{}}
        >
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
        expect(typeof props.positionComponentInternal).toBe("function");
        expect(typeof props.renderScrollComponent).toBe("function");
        expect(typeof props.stickyPositionComponentInternal).toBe("function");
    });

    it("does not forward a custom position component when itemLayoutAnimation is not set", async () => {
        const { AnimatedLegendList } = await import("../../src/integrations/reanimated?item-layout-disabled");

        act(() => {
            TestRenderer.create(
                <AnimatedLegendList data={[{ id: "a" }]} estimatedItemSize={10} renderItem={() => null} />,
            );
        });

        const props = legendListPropsRenders.at(-1);
        expect(props.positionComponentInternal).toBeUndefined();
    });

    it("keeps positionComponentInternal stable when transition reference is stable", async () => {
        const { AnimatedLegendList } = await import("../../src/integrations/reanimated?item-layout-stable");
        const transition = { type: "linear" } as any;

        let renderer!: TestRenderer.ReactTestRenderer;

        act(() => {
            renderer = TestRenderer.create(
                <AnimatedLegendList
                    data={[{ id: "a" }]}
                    estimatedItemSize={10}
                    extraData={0}
                    itemLayoutAnimation={transition}
                    renderItem={() => null}
                />,
            );
        });

        const firstProps = legendListPropsRenders.at(-1);
        const firstPositionComponent = firstProps.positionComponentInternal;

        act(() => {
            renderer.update(
                <AnimatedLegendList
                    data={[{ id: "a" }]}
                    estimatedItemSize={10}
                    extraData={1}
                    itemLayoutAnimation={transition}
                    renderItem={() => null}
                />,
            );
        });

        const secondProps = legendListPropsRenders.at(-1);
        const secondPositionComponent = secondProps.positionComponentInternal;

        expect(secondPositionComponent).toBe(firstPositionComponent);
    });

    it("keeps positionComponentInternal stable when transition identity changes", async () => {
        const { AnimatedLegendList } = await import("../../src/integrations/reanimated?item-layout-changing-reference");
        const transitionA = { duration: 280, type: "linear" } as any;
        const transitionB = { duration: 280, type: "linear" } as any;

        let renderer!: TestRenderer.ReactTestRenderer;

        act(() => {
            renderer = TestRenderer.create(
                <AnimatedLegendList
                    data={[{ id: "a" }]}
                    estimatedItemSize={10}
                    extraData={0}
                    itemLayoutAnimation={transitionA}
                    renderItem={() => null}
                />,
            );
        });

        const firstProps = legendListPropsRenders.at(-1);
        const firstPositionComponent = firstProps.positionComponentInternal;

        act(() => {
            renderer.update(
                <AnimatedLegendList
                    data={[{ id: "a" }]}
                    estimatedItemSize={10}
                    extraData={1}
                    itemLayoutAnimation={transitionB}
                    renderItem={() => null}
                />,
            );
        });

        const secondProps = legendListPropsRenders.at(-1);
        const secondPositionComponent = secondProps.positionComponentInternal;
        expect(secondPositionComponent).toBe(firstPositionComponent);

        const element = secondPositionComponent({
            children: null,
            horizontal: false,
            id: 0,
            index: 0,
            onLayout: () => {},
            refView: { current: null },
            style: {},
        });
        expect(element.props.layoutTransition).toBe(transitionB);
    });

    it("skips one layout transition when a recycled container is reassigned", async () => {
        const { AnimatedLegendList } = await import("../../src/integrations/reanimated?item-layout-recycle-reassign");
        const transition = { duration: 280, type: "linear" } as any;

        act(() => {
            TestRenderer.create(
                <AnimatedLegendList
                    data={[{ id: "a" }]}
                    estimatedItemSize={10}
                    itemLayoutAnimation={transition}
                    recycleItems
                    renderItem={() => null}
                />,
            );
        });

        const props = legendListPropsRenders.at(-1);
        const PositionComponent = props.positionComponentInternal as React.ComponentType<any>;
        let renderer!: TestRenderer.ReactTestRenderer;

        act(() => {
            renderer = TestRenderer.create(
                <StateProvider>
                    <PositionComponentHarness
                        containerId={7}
                        itemKey="a"
                        PositionComponent={PositionComponent}
                        position={10}
                    />
                </StateProvider>,
            );
        });
        expect(reanimatedViewRenders.at(-1)?.layout).toBe(transition);

        act(() => {
            renderer.update(
                <StateProvider>
                    <PositionComponentHarness
                        containerId={7}
                        itemKey="b"
                        PositionComponent={PositionComponent}
                        position={600}
                    />
                </StateProvider>,
            );
        });
        expect(reanimatedViewRenders.at(-1)?.layout).toBeUndefined();

        act(() => {
            renderer.update(
                <StateProvider>
                    <PositionComponentHarness
                        containerId={7}
                        itemKey="b"
                        PositionComponent={PositionComponent}
                        position={620}
                    />
                </StateProvider>,
            );
        });
        expect(reanimatedViewRenders.at(-1)?.layout).toBe(transition);
    });

    it("does not skip layout transitions on key changes when recycling is disabled", async () => {
        const { AnimatedLegendList } = await import("../../src/integrations/reanimated?item-layout-no-recycle");
        const transition = { duration: 280, type: "linear" } as any;

        act(() => {
            TestRenderer.create(
                <AnimatedLegendList
                    data={[{ id: "a" }]}
                    estimatedItemSize={10}
                    itemLayoutAnimation={transition}
                    recycleItems={false}
                    renderItem={() => null}
                />,
            );
        });

        const props = legendListPropsRenders.at(-1);
        const PositionComponent = props.positionComponentInternal as React.ComponentType<any>;
        let renderer!: TestRenderer.ReactTestRenderer;

        act(() => {
            renderer = TestRenderer.create(
                <StateProvider>
                    <PositionComponentHarness
                        containerId={8}
                        itemKey="a"
                        PositionComponent={PositionComponent}
                        position={15}
                    />
                </StateProvider>,
            );
        });
        expect(reanimatedViewRenders.at(-1)?.layout).toBe(transition);

        act(() => {
            renderer.update(
                <StateProvider>
                    <PositionComponentHarness
                        containerId={8}
                        itemKey="b"
                        PositionComponent={PositionComponent}
                        position={640}
                    />
                </StateProvider>,
            );
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
});
