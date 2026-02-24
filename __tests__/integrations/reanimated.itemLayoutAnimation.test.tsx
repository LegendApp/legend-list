import { beforeEach, describe, expect, it, mock } from "bun:test";
import "../setup";

import * as React from "react";

import TestRenderer, { act } from "../helpers/testRenderer";

let legendListPropsRenders: any[] = [];

const LegendListMock = React.forwardRef(function LegendListStub(props: any, _ref: React.Ref<any>) {
    legendListPropsRenders.push(props);
    return null;
});

const ReanimatedViewMock = React.forwardRef(function ReanimatedViewStub(_props: any, _ref: React.Ref<any>) {
    return null;
});

const ReanimatedScrollViewMock = React.forwardRef(function ReanimatedScrollViewStub(_props: any, _ref: React.Ref<any>) {
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

mock.module("@legendapp/list/react-native", () => ({
    LegendList: LegendListMock,
}));

mock.module("react-native-reanimated", createReanimatedModuleMock);
mock.module("react-native-reanimated/lib/module/index.js", createReanimatedModuleMock);

describe("AnimatedLegendList itemLayoutAnimation integration", () => {
    beforeEach(() => {
        legendListPropsRenders = [];
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
});
