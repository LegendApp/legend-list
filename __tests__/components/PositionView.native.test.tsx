import "../setup";

import * as React from "react";

import { describe, expect, it } from "bun:test";
import { PositionView, PositionViewSticky } from "../../src/components/PositionView.native";
import { updateItemSizes } from "../../src/core/updateItemSizes";
import { type StateContext, StateProvider, set$, useStateContext } from "../../src/state/state";
import { createMockState } from "../__mocks__/createMockState";
import { Animated } from "../__mocks__/react-native";
import { setLayoutValue } from "../helpers/layoutArrays";
import { act, render } from "../helpers/testingLibrary";

let currentCtx: StateContext | undefined;

function flattenStyle(style: any) {
    return Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : style;
}

function translateYAt(json: any, animatedScrollY: InstanceType<typeof Animated.Value>, scrolls: number[]) {
    const translateY = flattenStyle(json?.props?.style)?.transform?.[0]?.translateY;
    return scrolls.map((scroll) => {
        animatedScrollY.setValue(scroll);
        return translateY.__getValue();
    });
}

function StickyHarness({
    animatedScrollY,
    currentSize,
    index,
    itemIndex,
    itemKey,
    nextStickyPosition,
    position,
    stickyHeaderIndices,
}: {
    animatedScrollY: InstanceType<typeof Animated.Value>;
    currentSize: number;
    index: number;
    itemIndex?: number;
    itemKey: string;
    nextStickyPosition: number;
    position: number;
    stickyHeaderIndices: number[];
}) {
    const ctx = useStateContext();
    currentCtx = ctx;

    if (!ctx.state) {
        ctx.state = createMockState({
            positions: [],
            props: {
                stickyHeaderIndicesArr: stickyHeaderIndices,
            },
        }) as any;
    }

    const resolvedIndex = itemIndex ?? index;
    ctx.state.positions[resolvedIndex] = position;
    ctx.state.positions[stickyHeaderIndices[stickyHeaderIndices.indexOf(resolvedIndex) + 1]] = nextStickyPosition;
    ctx.state.props.stickyHeaderIndicesArr = stickyHeaderIndices;
    ctx.state.sizes.set(itemKey, currentSize);

    ctx.values.set(`containerPosition7`, position);
    ctx.values.set(`containerItemKey7`, itemKey);
    ctx.values.set(`containerItemIndex7`, resolvedIndex);
    ctx.values.set("headerSize", 0);
    ctx.values.set("stylePaddingTop", 0);
    ctx.values.set("totalSize", nextStickyPosition + currentSize);

    return (
        <PositionViewSticky
            animatedScrollY={animatedScrollY as any}
            horizontal={false}
            id={7}
            onLayout={() => {}}
            refView={{ current: null }}
            style={{}}
        >
            {null}
        </PositionViewSticky>
    );
}

function ReplacementMeasurementHarness() {
    const ctx = useStateContext();
    const didSetupRef = React.useRef(false);
    currentCtx = ctx;

    if (!didSetupRef.current) {
        const data = Array.from({ length: 5 }, (_, index) => ({ id: index }));
        const state = createMockState({
            didContainersLayout: true,
            endBuffered: 4,
            endNoBuffer: 4,
            lastLayout: { height: 300, width: 400, x: 0, y: 0 },
            props: {
                data,
                drawDistance: 0,
                estimatedItemSize: 100,
            },
            queuedInitialLayout: true,
            scrollLength: 300,
            startBuffered: 0,
            startNoBuffer: 0,
            totalSize: 500,
            userScrollAnchorReset: {
                keys: new Set(["item_0", "item_1", "item_2", "item_3", "item_4"]),
            },
        });

        for (let index = 0; index < data.length; index++) {
            const itemKey = `item_${index}`;
            state.idCache[index] = itemKey;
            state.indexByKey.set(itemKey, index);
            state.sizes.set(itemKey, 100);
            state.sizesKnown.set(itemKey, 100);
            state.containerItemKeys.set(itemKey, index);
            setLayoutValue(state, "positions", itemKey, index * 100);
            ctx.values.set(`containerItemKey${index}`, itemKey);
            ctx.values.set(`containerPosition${index}`, index * 100);
        }

        ctx.state = state;
        ctx.values.set("numContainers", data.length);
        ctx.values.set("numContainersPooled", data.length);
        ctx.values.set("otherAxisSize", 400);
        ctx.values.set("totalSize", 500);
        didSetupRef.current = true;
    }

    return (
        <PositionView horizontal={false} id={1} onLayout={() => {}} refView={{ current: null }} style={{}}>
            {null}
        </PositionView>
    );
}

function LayoutReadyHarness() {
    const ctx = useStateContext();
    const didSetupRef = React.useRef(false);
    currentCtx = ctx;

    if (!didSetupRef.current) {
        ctx.values.set("containerItemKey7", "dynamic-item");
        ctx.values.set("containerLayoutReady7", false);
        ctx.values.set("containerPosition7", 100);
        didSetupRef.current = true;
    }

    return (
        <PositionView horizontal={false} id={7} onLayout={() => {}} refView={{ current: null }} style={{}}>
            {null}
        </PositionView>
    );
}

describe("PositionView.native", () => {
    it("keeps an unknown-size Fabric assignment measurable but hidden until its layout is ready", () => {
        currentCtx = undefined;
        const { toJSON, unmount } = render(
            <StateProvider>
                <LayoutReadyHarness />
            </StateProvider>,
        );

        expect(flattenStyle((toJSON() as any)?.props?.style)).toMatchObject({ opacity: 0, top: 100 });
        expect((toJSON() as any)?.props?.pointerEvents).toBe("none");

        act(() => {
            set$(currentCtx!, "containerLayoutReady7", true);
        });

        expect(flattenStyle((toJSON() as any)?.props?.style)).toMatchObject({ top: 100 });
        expect(flattenStyle((toJSON() as any)?.props?.style)?.opacity).toBeUndefined();
        expect((toJSON() as any)?.props?.pointerEvents).toBeUndefined();

        unmount();
    });

    it("pushes a tall sticky header out when the next sticky header arrives", () => {
        const animatedScrollY = new Animated.Value(0);
        const { toJSON, unmount } = render(
            <StateProvider>
                <StickyHarness
                    animatedScrollY={animatedScrollY}
                    currentSize={120}
                    index={1}
                    itemKey="header-1"
                    nextStickyPosition={300}
                    position={100}
                    stickyHeaderIndices={[1, 5]}
                />
            </StateProvider>,
        );

        // Pins at scroll 100, then stops at 180 where the next header (300) pushes its 120px out.
        expect(translateYAt(toJSON(), animatedScrollY, [0, 100, 150, 180, 500])).toEqual([100, 100, 150, 180, 180]);

        unmount();
    });

    it("uses the current container index signal when a sticky item moves", () => {
        const animatedScrollY = new Animated.Value(0);
        const { toJSON, unmount } = render(
            <StateProvider>
                <StickyHarness
                    animatedScrollY={animatedScrollY}
                    currentSize={120}
                    index={3}
                    itemIndex={2}
                    itemKey="header-2"
                    nextStickyPosition={300}
                    position={100}
                    stickyHeaderIndices={[0, 2, 5]}
                />
            </StateProvider>,
        );

        const flattenedStyle = flattenStyle((toJSON() as any)?.props?.style);
        expect(flattenedStyle?.zIndex).toBe(1002);
        expect(translateYAt(toJSON(), animatedScrollY, [0, 150, 500])).toEqual([100, 150, 180]);

        unmount();
    });

    it("keeps one native-driven transform and updates it when a data change moves the header", () => {
        currentCtx = undefined;
        const animatedScrollY = new Animated.Value(0);
        const { toJSON, unmount } = render(
            <StateProvider>
                <StickyHarness
                    animatedScrollY={animatedScrollY}
                    currentSize={48}
                    index={3}
                    itemKey="today"
                    nextStickyPosition={0}
                    position={400}
                    stickyHeaderIndices={[0, 3]}
                />
            </StateProvider>,
        );
        const translateBefore = flattenStyle((toJSON() as any)?.props?.style)?.transform?.[0]?.translateY;
        expect(translateYAt(toJSON(), animatedScrollY, [0])).toEqual([400]);

        // An earlier row moves into this section, so the header's row shifts up without any scroll.
        act(() => {
            set$(currentCtx!, "containerPosition7", 160);
        });

        const translateAfter = flattenStyle((toJSON() as any)?.props?.style)?.transform?.[0]?.translateY;
        // A replaced node is not evaluated by the native driver until the next scroll event.
        expect(translateAfter).toBe(translateBefore);
        expect(translateYAt(toJSON(), animatedScrollY, [0, 160, 300])).toEqual([160, 160, 300]);

        unmount();
    });

    it("rerenders with recalculated positions before the next animation frame", () => {
        const rafCallbacks: FrameRequestCallback[] = [];
        const originalRaf = globalThis.requestAnimationFrame;
        globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
            rafCallbacks.push(callback);
            return rafCallbacks.length;
        }) as typeof requestAnimationFrame;
        currentCtx = undefined;

        try {
            const { toJSON, unmount } = render(
                <StateProvider>
                    <ReplacementMeasurementHarness />
                </StateProvider>,
            );

            expect(flattenStyle((toJSON() as any)?.props?.style)?.top).toBe(100);

            act(() => {
                updateItemSizes(currentCtx!, { itemKey: "item_0", size: { height: 150, width: 400 } });
            });

            expect(rafCallbacks).toHaveLength(0);
            expect(currentCtx!.values.get("containerPosition1")).toBe(150);
            expect(flattenStyle((toJSON() as any)?.props?.style)?.top).toBe(150);

            unmount();
        } finally {
            globalThis.requestAnimationFrame = originalRaf;
        }
    });
});
