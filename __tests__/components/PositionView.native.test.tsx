import "../setup";

import * as React from "react";

import { describe, expect, it, mock } from "bun:test";
import { PositionView, PositionViewSticky } from "../../src/components/PositionView.native";
import { updateItemSizes } from "../../src/core/updateItemSizes";
import { type StateContext, StateProvider, useStateContext } from "../../src/state/state";
import { createMockState } from "../__mocks__/createMockState";
import { setLayoutValue } from "../helpers/layoutArrays";
import { act, render } from "../helpers/testingLibrary";

let currentCtx: StateContext | undefined;

function flattenStyle(style: any) {
    return Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : style;
}

function StickyHarness({
    animatedScrollY,
    currentSize,
    index,
    itemKey,
    nextStickyPosition,
    position,
    stickyHeaderIndices,
}: {
    animatedScrollY: { interpolate: (config: any) => any };
    currentSize: number;
    index: number;
    itemKey: string;
    nextStickyPosition: number;
    position: number;
    stickyHeaderIndices: number[];
}) {
    const ctx = useStateContext();

    if (!ctx.state) {
        ctx.state = createMockState({
            positions: [],
            props: {
                stickyHeaderIndicesArr: stickyHeaderIndices,
            },
        }) as any;
    }

    ctx.state.positions[index] = position;
    ctx.state.positions[stickyHeaderIndices[stickyHeaderIndices.indexOf(index) + 1]] = nextStickyPosition;
    ctx.state.props.stickyHeaderIndicesArr = stickyHeaderIndices;
    ctx.state.sizes.set(itemKey, currentSize);

    ctx.values.set(`containerPosition7`, position);
    ctx.values.set(`containerItemKey7`, itemKey);
    ctx.values.set("headerSize", 0);
    ctx.values.set("stylePaddingTop", 0);
    ctx.values.set("totalSize", nextStickyPosition + currentSize);

    return (
        <PositionViewSticky
            animatedScrollY={animatedScrollY as any}
            horizontal={false}
            id={7}
            index={index}
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

describe("PositionView.native", () => {
    it("pushes a tall sticky header out when the next sticky header arrives", () => {
        const interpolate = mock((config: any) => config);
        const animatedScrollY = { interpolate };
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

        const expectedInterpolation = {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            inputRange: [100, 180],
            outputRange: [100, 180],
        };

        expect(interpolate).toHaveBeenCalledTimes(1);
        expect(interpolate).toHaveBeenCalledWith(expectedInterpolation);

        const flattenedStyle = flattenStyle((toJSON() as any)?.props?.style);
        expect(flattenedStyle?.transform).toEqual([{ translateY: expectedInterpolation }]);

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
