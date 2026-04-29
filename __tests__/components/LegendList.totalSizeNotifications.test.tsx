import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import "../setup";

import * as React from "react";
import { Animated, Text, View } from "react-native";

import { updateItemPositions } from "../../src/core/updateItemPositions";
import { useValue$ } from "../../src/hooks/useValue$";
import { type StateContext, useStateContext } from "../../src/state/state";
import TestRenderer, { act } from "../helpers/testRenderer";
import { registerBaseModuleMocks } from "../setup";

let getItemSizeCallCount = 0;
let animatedSetValueCallCount = 0;
const originalAnimatedSetValue = Animated.Value.prototype.setValue;

interface LargeListNotificationMetrics {
    animatedSetValueCalls: number;
    sizeLookupCalls: number;
}

function registerOldArchMock() {
    mock.module("@/constants-platform", () => ({
        IsNewArchitecture: false,
    }));
}

function ListComponentWithTotalSizeListener(props: any) {
    useValue$("totalSize");

    if (!props.renderScrollComponent) {
        return null;
    }

    return props.renderScrollComponent({
        children: null,
        contentContainerStyle: props.contentContainerStyle,
        horizontal: props.horizontal,
        onLayout: props.onLayout,
        onScroll: props.onScroll,
        ref: props.refScrollView,
        style: props.style,
    });
}

function registerListComponentMock() {
    mock.module("@/components/ListComponent", () => ({
        ListComponent: ListComponentWithTotalSizeListener,
    }));
}

function installAnimatedSetValueCounter() {
    animatedSetValueCallCount = 0;
    Animated.Value.prototype.setValue = function setValueWithCount(value: number) {
        animatedSetValueCallCount += 1;
        return originalAnimatedSetValue.call(this, value);
    };
}

function createData(length: number) {
    return Array.from({ length }, (_value, index) => ({
        id: `item-${index}`,
        label: `Item ${index}`,
    }));
}

async function updateMountedListAndMeasureNotifications(length: number): Promise<LargeListNotificationMetrics> {
    getItemSizeCallCount = 0;
    const initialData = createData(1);
    const largeData = createData(length);
    const { LegendList } = await import("../../src/components/LegendList?mounted-update-performance-test");
    let ctx: StateContext | undefined;

    const CapturedScrollComponent = React.forwardRef(function ScrollComponentWithCapturedContext(
        props: { children?: React.ReactNode },
        ref: React.ForwardedRef<any>,
    ) {
        ctx = useStateContext();
        return <View ref={ref}>{props.children}</View>;
    });

    let renderer: ReturnType<typeof TestRenderer.create> | undefined;
    await act(async () => {
        renderer = TestRenderer.create(
            <LegendList
                data={initialData}
                estimatedItemSize={100}
                getEstimatedItemSize={() => 100}
                keyExtractor={(item: { id: string }) => item.id}
                recycleItems={false}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
                renderScrollComponent={(props) => <CapturedScrollComponent {...props} />}
            />,
        );
    });

    expect(ctx?.listeners.get("totalSize")?.size ?? 0).toBeGreaterThan(0);

    ctx!.state.props.data = largeData;
    ctx!.state.props.getEstimatedItemSize = (_item: { id: string }, _index: number) => {
        getItemSizeCallCount += 1;
        return 100;
    };
    ctx!.state.idCache.length = 0;
    ctx!.state.indexByKey.clear();
    ctx!.state.positions.length = 0;
    ctx!.state.sizes.clear();
    ctx!.state.sizesKnown.clear();
    ctx!.state.totalSize = 0;
    ctx!.values.set("totalSize", 0);

    animatedSetValueCallCount = 0;
    updateItemPositions(ctx!, true);

    const callCount = getItemSizeCallCount;
    const animatedCalls = animatedSetValueCallCount;
    await act(async () => {
        renderer?.unmount();
    });

    return {
        animatedSetValueCalls: animatedCalls,
        sizeLookupCalls: callCount,
    };
}

describe("LegendList large-list totalSize notifications", () => {
    beforeEach(() => {
        mock.restore();
        registerBaseModuleMocks();
        registerOldArchMock();
        registerListComponentMock();
        installAnimatedSetValueCounter();
        getItemSizeCallCount = 0;
    });

    afterEach(() => {
        Animated.Value.prototype.setValue = originalAnimatedSetValue;
    });

    it("does not publish totalSize per item during mounted large-list position updates", async () => {
        const largeList = await updateMountedListAndMeasureNotifications(5000);

        expect(largeList.sizeLookupCalls).toBe(5000);
        expect(largeList.animatedSetValueCalls).toBeLessThanOrEqual(1);
    });
});
